import type { AgentPayload, Doc } from './payload'
import type { Patch, ProposedField } from './verifiers'

/**
 * Proposals are how an agent's work reaches an editor (D6). This module
 * enforces the per-collection agent contract (`custom.sitekick.agent`) before
 * anything is written, supersedes older open proposals for the same target,
 * and writes the row in the shape docs/REVIEW-SPEC.md describes.
 */
export type AgentContract = {
  description?: string
  writable?: string[]
  fillEmptyOnly?: string[]
  review?: 'required' | 'optional' | 'none'
  notes?: string
}

export type ProposalKind = 'enrich' | 'draft' | 'edit' | 'translate' | 'field-action'

export function agentContractFor(payload: Pick<AgentPayload, 'config'>, collection: string): AgentContract | null {
  const config = payload.config.collections.find((c) => c.slug === collection)
  const sitekick = (config?.custom as { sitekick?: { agent?: AgentContract; private?: boolean } } | undefined)?.sitekick
  if (!config || sitekick?.private) return null
  return sitekick?.agent ?? null
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

/** Dotted path lookup, for `meta.title` and friends. */
export const getPath = (doc: Record<string, unknown> | null | undefined, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), doc ?? undefined)

export type FilteredPatch = {
  /** Fields that go into the proposal for review. */
  propose: Patch
  /** Fields the contract lets the agent write without review (fillEmptyOnly + review: 'none'). */
  direct: Patch
  /** Fields refused, with the reason. */
  dropped: Record<string, string>
}

/**
 * Apply the contract to a patch. Pure, so the rules are testable without
 * Payload: only `writable` or `fillEmptyOnly` fields pass; `fillEmptyOnly`
 * fields are refused when the target already has a value; every proposed
 * value needs a receipt unless the contract's review is 'none'.
 */
export function filterPatchByContract({
  contract,
  patch,
  current,
}: {
  contract: AgentContract | null
  patch: Patch
  current: Record<string, unknown> | null
}): FilteredPatch {
  const out: FilteredPatch = { propose: {}, direct: {}, dropped: {} }
  if (!contract) {
    for (const path of Object.keys(patch)) out.dropped[path] = 'collection has no agent contract'
    return out
  }
  const writable = new Set(contract.writable ?? [])
  const fillEmpty = new Set(contract.fillEmptyOnly ?? [])
  const noReview = contract.review === 'none'
  for (const [path, field] of Object.entries(patch)) {
    const root = path.split('.')[0] ?? path
    const allowed = (set: Set<string>) => set.has(path) || set.has(root)
    if (!allowed(writable) && !allowed(fillEmpty)) {
      out.dropped[path] = 'field is not writable by agents'
      continue
    }
    if (isEmpty(field.value)) {
      out.dropped[path] = 'empty value'
      continue
    }
    const existing = getPath(current, path)
    if (allowed(fillEmpty) && !allowed(writable) && !isEmpty(existing)) {
      out.dropped[path] = 'field already has a value (fillEmptyOnly)'
      continue
    }
    if (!field.receipts?.length && !noReview) {
      out.dropped[path] = 'no receipt'
      continue
    }
    const entry: ProposedField = { ...field, ...(existing !== undefined ? { current: existing } : {}) }
    if (noReview && allowed(fillEmpty)) out.direct[path] = entry
    else out.propose[path] = entry
  }
  return out
}

export type CreateProposalArgs = {
  targetCollection: string
  targetId?: string | number
  kind: ProposalKind
  title: string
  patch: Patch
  summary?: string
  runId?: string | number
  agent: string
  /** Pre-read target, to save a round trip; read when omitted and targetId is set. */
  target?: Doc | null
  /** The language the proposal writes, on a localised site. Omitted = the default language. */
  locale?: string
  /**
   * In place of the collection's own contract, for an agent whose scope is decided another way
   * (Translate: every localised field). Private collections are still refused.
   */
  contract?: AgentContract
}

export type CreateProposalResult = {
  /** Null when the contract refused every field; nothing was written. */
  id: string | number | null
  proposed: Patch
  direct: Patch
  dropped: Record<string, string>
}

/** Turn a dotted-path patch into a nested `data` object for `payload.update`. */
export function patchToData(patch: Patch): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [path, field] of Object.entries(patch)) {
    const keys = path.split('.')
    let cursor = data
    keys.slice(0, -1).forEach((key) => {
      const next = cursor[key]
      cursor = (next && typeof next === 'object' ? next : (cursor[key] = {})) as Record<string, unknown>
    })
    cursor[keys[keys.length - 1] ?? path] = field.value
  }
  return data
}

/**
 * A new proposal replaces the open ones for the same document, in the same language: a French
 * translation doesn't retire research waiting in the default language, or the other way round.
 */
export async function supersedeOpenProposals(payload: AgentPayload, targetCollection: string, targetId: string | number, agent: string, locale?: string): Promise<void> {
  await payload.update({
    collection: 'proposals',
    where: {
      and: [
        { targetCollection: { equals: targetCollection } },
        { targetId: { equals: String(targetId) } },
        { status: { equals: 'open' } },
        locale ? { locale: { equals: locale } } : { locale: { exists: false } },
      ],
    },
    data: { status: 'superseded' },
    overrideAccess: true,
    context: { sitekickAgent: agent },
  })
}

export async function createProposal(payload: AgentPayload, args: CreateProposalArgs): Promise<CreateProposalResult> {
  const own = agentContractFor(payload, args.targetCollection)
  const isPrivate = Boolean((payload.config.collections.find((c) => c.slug === args.targetCollection)?.custom as { sitekick?: { private?: boolean } } | undefined)?.sitekick?.private)
  const contract = args.contract && !isPrivate ? args.contract : own
  const target =
    args.target !== undefined
      ? args.target
      : args.targetId !== undefined
        ? await payload.findByID({ collection: args.targetCollection, id: args.targetId, depth: 0, overrideAccess: true, disableErrors: true, ...(args.locale ? { locale: args.locale, fallbackLocale: false as const } : {}) })
        : null
  const { propose, direct, dropped } = filterPatchByContract({ contract, patch: args.patch, current: target })
  const context = { sitekickAgent: args.agent }

  if (Object.keys(direct).length && args.targetId !== undefined) {
    // review: 'none' + fillEmptyOnly: the contract says these never need eyes.
    await payload.update({ collection: args.targetCollection, id: args.targetId, data: patchToData(direct), overrideAccess: true, context, ...(args.locale ? { locale: args.locale } : {}) })
  }

  if (!Object.keys(propose).length) return { id: null, proposed: {}, direct, dropped }

  if (args.targetId !== undefined) await supersedeOpenProposals(payload, args.targetCollection, args.targetId, args.agent, args.locale)

  const droppedLines = Object.entries(dropped).map(([path, why]) => `${path}: ${why}`)
  const summary = [args.summary?.trim(), droppedLines.length ? `Not proposed: ${droppedLines.join('; ')}.` : null].filter(Boolean).join('\n\n')
  const doc = await payload.create({
    collection: 'proposals',
    data: {
      title: args.title,
      kind: args.kind,
      status: 'open',
      targetCollection: args.targetCollection,
      ...(args.targetId !== undefined ? { targetId: String(args.targetId) } : {}),
      patch: propose,
      ...(summary ? { summary } : {}),
      ...(args.runId !== undefined ? { run: args.runId } : {}),
      ...(args.locale ? { locale: args.locale } : {}),
      agent: args.agent,
    },
    overrideAccess: true,
    context,
  })
  return { id: doc.id, proposed: propose, direct, dropped }
}
