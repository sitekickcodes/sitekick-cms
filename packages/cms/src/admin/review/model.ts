import type { Decision, Decisions, ProposalStatus, Receipt, RunQuestion, RunStatus, RunStep } from '../../review/shared'
import type { Rendered, SectionChange } from '../../review/render'

/**
 * What the server views hand to their client halves: plain, serialisable
 * data with every title, label and link already resolved with the editor's
 * access, so the client never queries the schema.
 */

export type DocLink = { title: string; href: string }

export type FieldView = {
  path: string
  label: string
  current: Rendered
  proposed: Rendered
  receipts: Receipt[]
  note?: string
  /** Blocks fields: the change section by section, in place of the two panes. */
  sections?: SectionChange[]
}

export type ProposalView = {
  id: string
  title: string
  status: ProposalStatus
  kind?: string
  /** A translation's language, as the site names it (`Français`). */
  language?: string
  agent?: string
  summary?: string
  createdAt?: string
  reviewedAt?: string
  reviewedBy?: string
  target: { collectionLabel: string; collectionSlug: string; doc: DocLink | null }
  run: DocLink | null
  fields: FieldView[]
  decisions: Decisions
  /** Where the client posts decisions. */
  decideURL: string
  /** For linking a target the first acceptance created. */
  adminRoute: string
  /** The target's preview with and without the proposal applied, when the collection has one. */
  preview?: { proposed: string; current: string }
}

export type RunView = {
  id: string
  title: string
  status: RunStatus
  kind: string
  stage?: string
  now?: string
  steps: RunStep[]
  question: RunQuestion | null
  answer?: string
  costUsd?: number
  attempts: number
  model?: string
  error?: string
  updatedAt?: string
  target: DocLink | null
  proposal: DocLink | null
  triggeredBy?: string
  /** `GET` for polling; the actions are `${actionsURL}/answer|cancel|retry`. */
  readURL: string
  actionsURL: string
}

export type DecisionState = Record<string, Decision | undefined>

/** "just now", "4 min ago", "3 h ago", "2 days ago"; the input when it is not a date. */
export function relative(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const s = Math.max(0, (now - t) / 1000)
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

/** `$0.0123` → "$0.01"; under a cent shows three decimals so small runs are not "$0.00". */
export function money(usd: number | undefined): string {
  if (typeof usd !== 'number' || Number.isNaN(usd)) return ''
  return usd > 0 && usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`
}
