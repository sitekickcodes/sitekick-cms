import type { CollectionSlug, FlattenedField, Payload } from 'payload'

import { fieldAtPath } from './render'
import { PROPOSALS_SLUG, asDecisions, asPatch, setAtPath } from './shared'

/**
 * Render a proposal on the site before it is accepted. The review view links
 * the target's preview URL with `proposal=<id>`; the host's draft route
 * forwards it, and the page calls this with the document it already loaded.
 * It returns the document with the open proposal's fields applied (rejected
 * ones left out) and their uploads and relationships populated one level, as
 * a `depth: 1` read would. Only a signed-in editor who can read the proposal
 * gets it applied; anyone else gets null and sees the page as it is.
 */
export async function applyProposalPreview<T extends { id: string | number }>({
  payload,
  headers,
  proposal: proposalId,
  collection,
  doc,
  proposalsSlug = PROPOSALS_SLUG,
}: {
  payload: Payload
  headers: Headers
  proposal: string | number | null | undefined
  collection: string
  doc: T
  proposalsSlug?: string
}): Promise<{ doc: T; proposal: { id: string; title: string } } | null> {
  if (proposalId === null || proposalId === undefined || proposalId === '') return null
  const { user } = await payload.auth({ headers })
  if (!user) return null
  const proposal = (await payload
    .findByID({ collection: proposalsSlug as CollectionSlug, id: proposalId, depth: 0, user, overrideAccess: false, disableErrors: true })
    .catch(() => null)) as Record<string, unknown> | null
  if (!proposal || proposal.targetCollection !== collection || String(proposal.targetId) !== String(doc.id)) return null
  const target = payload.collections[collection as CollectionSlug]?.config
  if (!target) return null

  const decisions = asDecisions(proposal.decisions)
  let out = doc as unknown as Record<string, unknown>
  for (const [path, field] of Object.entries(asPatch(proposal.patch))) {
    if (decisions[path] === 'rejected') continue
    const value = await populate(payload, user, fieldAtPath(target.fields, path), field.value)
    out = setAtPath(out, path, value)
  }
  return { doc: out as T, proposal: { id: String(proposal.id), title: typeof proposal.title === 'string' ? proposal.title : 'Proposed change' } }
}

type User = NonNullable<Awaited<ReturnType<Payload['auth']>>['user']>

/** Replace ids with documents for uploads and relationships, through blocks, arrays and groups. */
async function populate(payload: Payload, user: User, field: FlattenedField | null, value: unknown): Promise<unknown> {
  if (!field || value === null || value === undefined) return value
  if ((field.type === 'upload' || field.type === 'relationship') && typeof field.relationTo === 'string') {
    const one = async (v: unknown) =>
      typeof v === 'string' || typeof v === 'number'
        ? ((await payload.findByID({ collection: field.relationTo as CollectionSlug, id: v, depth: 0, user, overrideAccess: false, disableErrors: true }).catch(() => null)) ?? v)
        : v
    return Array.isArray(value) ? Promise.all(value.map(one)) : one(value)
  }
  if (field.type === 'blocks' && Array.isArray(value)) {
    return Promise.all(
      value.map(async (row: Record<string, unknown>) => {
        const block = field.blocks.find((b) => typeof b !== 'string' && b.slug === row?.blockType)
        return block && typeof block !== 'string' ? populateRow(payload, user, block.flattenedFields, row) : row
      }),
    )
  }
  if (field.type === 'array' && Array.isArray(value)) return Promise.all(value.map((row: Record<string, unknown>) => populateRow(payload, user, field.flattenedFields, row)))
  if (field.type === 'group' && typeof value === 'object') return populateRow(payload, user, field.flattenedFields, value as Record<string, unknown>)
  return value
}

async function populateRow(payload: Payload, user: User, fields: FlattenedField[], row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!row || typeof row !== 'object') return row
  const out: Record<string, unknown> = { ...row }
  for (const f of fields) if ('name' in f && f.name in row) out[f.name] = await populate(payload, user, f, row[f.name])
  return out
}
