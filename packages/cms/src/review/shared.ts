import { z } from 'zod'

import type { StatusMap } from '../admin/StatusTag'

/**
 * The review inbox contract (docs/REVIEW-SPEC.md), as code. Pure values and
 * functions only: nothing here touches Payload, so both the collections and
 * the admin components can import it, and the tests run without a server.
 */

export const PROPOSALS_SLUG = 'proposals'
export const RUNS_SLUG = 'runs'

/** Every agent or review write names itself so outbox hooks can skip it. */
export const REVIEW_AGENT_CONTEXT = { sitekickAgent: 'review' } as const

export const PROPOSAL_KINDS = ['enrich', 'draft', 'edit', 'field-action'] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

export const PROPOSAL_STATUSES = ['open', 'accepted', 'partial', 'rejected', 'superseded'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const RUN_STATUSES = ['queued', 'running', 'waiting', 'done', 'failed', 'cancelled'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

/** Runs the inbox calls "in progress". */
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ['queued', 'running', 'waiting']

export const STEP_STATUSES = ['running', 'done', 'failed', 'skipped'] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

export type Receipt = { url: string; fetchedAt: string; sha256: string; excerpt: string; title?: string }

export type ProposedField = {
  value: unknown
  current?: unknown
  receipts?: Receipt[]
  note?: string
}

export type Patch = Record<string, ProposedField>

export type Decision = 'accepted' | 'rejected'
export type Decisions = Record<string, Decision>

export type RunStep = { label: string; status: StepStatus; detail?: string; at: string }
export type RunQuestion = { text: string; options: string[] }

/** Tag tones for the two status columns and the review headers. */
export const PROPOSAL_STATUS_MAP: StatusMap = {
  open: { label: 'To review', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  partial: { label: 'Partly accepted', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
  superseded: { label: 'Superseded', tone: 'quiet' },
}

export const RUN_STATUS_MAP: StatusMap = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  waiting: { label: 'Needs an answer', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'quiet' },
}

/**
 * The proposal status that follows from its decisions: `open` until every
 * field in the patch has one, then `accepted` (all accepted), `rejected`
 * (all rejected) or `partial`. A patch with no fields is `rejected`, since
 * there is nothing to accept.
 */
export function computeStatus(patch: Patch, decisions: Decisions): Exclude<ProposalStatus, 'superseded'> {
  const paths = Object.keys(patch)
  if (paths.length === 0) return 'rejected'
  const made = paths.map((path) => decisions[path]).filter((d): d is Decision => d === 'accepted' || d === 'rejected')
  if (made.length < paths.length) return 'open'
  const accepted = made.filter((d) => d === 'accepted').length
  if (accepted === made.length) return 'accepted'
  if (accepted === 0) return 'rejected'
  return 'partial'
}

/** A proposal nobody may decide on any more. */
export function isFinal(status: unknown): boolean {
  return status === 'accepted' || status === 'partial' || status === 'rejected' || status === 'superseded'
}

const decision = z.enum(['accepted', 'rejected'])

/** `POST /api/proposals/:id/decide` */
export const decideBody = z.object({
  decisions: z
    .record(z.string().min(1), decision)
    .refine((d) => Object.keys(d).length > 0, { message: 'Send at least one decision.' }),
})
export type DecideBody = z.infer<typeof decideBody>

/** `POST /api/runs/:id/answer` */
export const answerBody = z.object({ answer: z.string().trim().min(1, 'An answer is needed.').max(2000) })
export type AnswerBody = z.infer<typeof answerBody>

/** The `patch` json as a typed map, or nothing when it is not one. */
export function asPatch(value: unknown): Patch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Patch = {}
  for (const [path, field] of Object.entries(value as Record<string, unknown>)) {
    if (field && typeof field === 'object' && !Array.isArray(field) && 'value' in field) out[path] = field as ProposedField
  }
  return out
}

/** The `decisions` json as a typed map; unknown entries are dropped. */
export function asDecisions(value: unknown): Decisions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Decisions = {}
  for (const [path, d] of Object.entries(value as Record<string, unknown>)) {
    if (d === 'accepted' || d === 'rejected') out[path] = d
  }
  return out
}

export function asSteps(value: unknown): RunStep[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((s): RunStep[] => {
    if (!s || typeof s !== 'object') return []
    const step = s as Partial<RunStep>
    if (typeof step.label !== 'string') return []
    const status = STEP_STATUSES.includes(step.status as StepStatus) ? (step.status as StepStatus) : 'done'
    return [{ label: step.label, status, detail: typeof step.detail === 'string' ? step.detail : undefined, at: typeof step.at === 'string' ? step.at : '' }]
  })
}

export function asQuestion(value: unknown): RunQuestion | null {
  if (!value || typeof value !== 'object') return null
  const q = value as Partial<RunQuestion>
  if (typeof q.text !== 'string' || !q.text.trim()) return null
  const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : []
  return { text: q.text, options }
}

/**
 * Sets `value` at a dotted `path` ("seo.title", "links.0.url") on a copy of
 * `base`, creating objects and arrays as the segments require. Writing the
 * whole top-level value back (rather than a partial) keeps sibling rows of
 * arrays and sibling keys of groups intact through Payload's update.
 */
export function setAtPath(base: unknown, path: string, value: unknown): Record<string, unknown> {
  const segments = path.split('.').filter(Boolean)
  const root: Record<string, unknown> = base && typeof base === 'object' && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {}
  if (segments.length === 0) return root
  let node: Record<string, unknown> | unknown[] = root
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1
    const next = segments[i + 1]
    const key: string | number = Array.isArray(node) ? Number(segment) : segment
    const existing = Array.isArray(node) ? node[key as number] : node[key as string]
    let child: unknown
    if (last) child = value
    else if (Array.isArray(existing)) child = [...existing]
    else if (existing && typeof existing === 'object') child = { ...(existing as Record<string, unknown>) }
    else child = next !== undefined && /^\d+$/.test(next) ? [] : {}
    if (Array.isArray(node)) node[key as number] = child
    else node[key as string] = child
    if (!last) node = child as Record<string, unknown> | unknown[]
  })
  return root
}

/** The first segment of a dotted path: the top-level field the write touches. */
export function topLevelOf(path: string): string {
  return path.split('.')[0] ?? path
}

/** `https://www.example.org/a/b` → `example.org` */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * A receipt excerpt as an editor reads it. Fetched page text carries link
 * targets and images inline ("GitHub [https://…]", "[image: Jane https://…]")
 * so quotes can be matched exactly; the review view drops those. Display
 * only: the stored excerpt stays byte-exact for verification.
 */
export function readableExcerpt(excerpt: string): string {
  return excerpt
    .replace(/\[image:[^\]]*\]/gi, '')
    .replace(/\s*\[https?:\/\/[^\]\s]*\]?/gi, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Where the inbox lives under the admin route. */
export const INBOX_PATH = '/inbox'
/** What the agents cost (admin/review/UsageView.tsx), from runs.costUsd. */
export const USAGE_PATH = '/usage'
