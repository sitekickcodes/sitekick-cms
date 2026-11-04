import type { Payload } from 'payload'

/**
 * The slice of Payload's Local API the kit touches. Narrow on purpose: a test
 * can stub it with an in-memory map, and the real `Payload` class satisfies it
 * structurally (see `asAgentPayload`). Collection slugs are plain strings because
 * this package never sees a client's generated types.
 */
export type Doc = Record<string, unknown> & { id: string | number }

export type Where = Record<string, unknown>

export type AgentContext = { sitekickAgent: string }

export type CollectionLike = {
  slug: string
  custom?: Record<string, unknown>
  fields: Array<Record<string, unknown>>
  upload?: unknown
}

export interface AgentPayload {
  config: { collections: CollectionLike[]; serverURL?: string }
  findByID(args: {
    collection: string
    id: string | number
    depth?: number
    overrideAccess?: boolean
    disableErrors?: boolean
    /** Latest draft, for collections with drafts. */
    draft?: boolean
  }): Promise<Doc | null>
  find(args: {
    collection: string
    where?: Where
    limit?: number
    depth?: number
    sort?: string
    overrideAccess?: boolean
    draft?: boolean
  }): Promise<{ docs: Doc[] }>
  create(args: { collection: string; data: Record<string, unknown>; overrideAccess?: boolean; context?: AgentContext }): Promise<Doc>
  update(args: {
    collection: string
    id?: string | number
    where?: Where
    data: Record<string, unknown>
    overrideAccess?: boolean
    context?: AgentContext
    depth?: number
  }): Promise<unknown>
  auth(args: { headers: Headers }): Promise<{ user?: ({ id: string | number } & Record<string, unknown>) | null }>
}

/**
 * The real client is generic over generated collection types; the kit only
 * needs the string-slug shape above, so the cast is a view, not a lie.
 */
export const asAgentPayload = (payload: Payload): AgentPayload => payload as unknown as AgentPayload

/** Payload returns `{ docs, errors }` for where-based updates; narrow it without `any`. */
export const bulkDocs = (result: unknown): Doc[] => {
  if (result && typeof result === 'object' && Array.isArray((result as { docs?: unknown }).docs)) {
    return (result as { docs: Doc[] }).docs
  }
  return []
}
