/**
 * What AI costs, from the runs collection (each run records its spend in `costUsd`). Pure,
 * so the sums are tested on their own; admin/review/UsageView.tsx renders them.
 *
 * Months are calendar months in UTC. The projection is this month's spend so far, spread
 * over the whole month: crude, but it answers "will we go over?" early.
 */
export type UsageRun = {
  id: string | number
  title?: string
  kind?: string
  model?: string
  status?: string
  costUsd?: number | null
  createdAt: string
  triggeredBy?: unknown
}

export type UsageRow = { key: string; label: string; costUsd: number; runs: number }
export type UsageDay = { date: string; costUsd: number; runs: number }

export type Usage = {
  month: { costUsd: number; runs: number; projectedUsd: number; label: string }
  lastMonth: { costUsd: number; runs: number; label: string }
  budgetUsd: number | null
  /** The last 30 days, oldest first, every day present. */
  days: UsageDay[]
  byAgent: UsageRow[]
  byModel: UsageRow[]
  byPerson: UsageRow[]
  /** Spend on runs that failed or were cancelled this month. */
  failedUsd: number
  top: UsageRun[]
  /** Runs this month with no cost recorded (a direct provider, or not measured). */
  unmeasured: number
}

/** What editors call each agent; the run's `kind` is `<agent>@<version>`. */
const AGENTS: Record<string, string> = {
  enrich: 'Find details',
  draft: 'Draft from notes',
  edit: 'Edit with words',
  'alt-text': 'Describe image',
  alt: 'Describe image',
  seo: 'Write search details',
  rewrite: 'Rewrite',
}

export function agentLabel(kind: string | undefined): string {
  const base = (kind ?? '').split('@')[0] || 'Other'
  return AGENTS[base] ?? base.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
const monthLabel = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const cents = (n: number) => Math.round(n * 10_000) / 10_000

export function usageOf(runs: UsageRun[], { now = new Date(), budgetUsd = null, people = {} }: { now?: Date; budgetUsd?: number | null; people?: Record<string, string> } = {}): Usage {
  const thisMonth = monthKey(now)
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastMonth = monthKey(prev)
  const inMonth = runs.filter((r) => monthKey(new Date(r.createdAt)) === thisMonth)
  const inLast = runs.filter((r) => monthKey(new Date(r.createdAt)) === lastMonth)
  const sum = (rs: UsageRun[]) => cents(rs.reduce((a, r) => a + (r.costUsd ?? 0), 0))

  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const elapsed = Math.max(1, now.getUTCDate() - 1 + now.getUTCHours() / 24)
  const monthCost = sum(inMonth)

  const days: UsageDay[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    days.push({ date: d.toISOString().slice(0, 10), costUsd: 0, runs: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  for (const r of runs) {
    const i = dayIndex.get(r.createdAt.slice(0, 10))
    if (i === undefined) continue
    days[i]!.costUsd = cents(days[i]!.costUsd + (r.costUsd ?? 0))
    days[i]!.runs++
  }

  const group = (keyOf: (r: UsageRun) => string, labelOf: (key: string) => string): UsageRow[] => {
    const rows = new Map<string, UsageRow>()
    for (const r of inMonth) {
      const key = keyOf(r)
      const row = rows.get(key) ?? { key, label: labelOf(key), costUsd: 0, runs: 0 }
      row.costUsd = cents(row.costUsd + (r.costUsd ?? 0))
      row.runs++
      rows.set(key, row)
    }
    return [...rows.values()].sort((a, b) => b.costUsd - a.costUsd || b.runs - a.runs)
  }

  return {
    month: { costUsd: monthCost, runs: inMonth.length, projectedUsd: cents((monthCost / elapsed) * daysInMonth), label: monthLabel(now) },
    lastMonth: { costUsd: sum(inLast), runs: inLast.length, label: monthLabel(prev) },
    budgetUsd,
    days,
    byAgent: group((r) => (r.kind ?? '').split('@')[0] || 'other', (k) => agentLabel(k)),
    byModel: group((r) => r.model || 'unrecorded', (k) => (k === 'unrecorded' ? 'Not recorded' : k)),
    byPerson: group((r) => personOf(r.triggeredBy) ?? 'agent', (k) => (k === 'agent' ? 'Scheduled or automatic' : (people[k] ?? `User ${k}`))),
    failedUsd: sum(inMonth.filter((r) => r.status === 'failed' || r.status === 'cancelled')),
    top: [...inMonth].filter((r) => (r.costUsd ?? 0) > 0).sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)).slice(0, 5),
    unmeasured: inMonth.filter((r) => r.costUsd === null || r.costUsd === undefined).length,
  }
}

/** `triggeredBy` is a user id, a populated user, or a polymorphic `{ relationTo, value }`. */
export function personOf(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object') return null
  if ('value' in value) return personOf((value as { value: unknown }).value)
  if ('id' in value) return String((value as { id: unknown }).id)
  return null
}

/** `SITEKICK_AI_BUDGET_USD`: a monthly budget to measure against. Blank or invalid = none. */
export function budgetFromEnv(env: Record<string, string | undefined> = process.env): number | null {
  const n = Number(env.SITEKICK_AI_BUDGET_USD)
  return Number.isFinite(n) && n > 0 ? n : null
}

export const money = (usd: number): string => (usd > 0 && usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`)
