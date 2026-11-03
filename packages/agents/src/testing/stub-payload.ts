import type { AgentPayload, CollectionLike, Doc, Where } from '../payload'

/**
 * An in-memory Payload for tests: enough of the Local API (create, find,
 * findByID, update by id or where) and the `where` operators the kit uses.
 * No hooks, no access control; `context` is recorded so a test can assert the
 * loop guard was passed.
 */
export type StubPayload = AgentPayload & {
  store: Map<string, Doc[]>
  writes: Array<{ op: 'create' | 'update'; collection: string; context?: { sitekickAgent: string }; data: Record<string, unknown> }>
  user: ({ id: string | number } & Record<string, unknown>) | null
}

const get = (doc: Doc, key: string) => key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), doc)

const same = (a: unknown, b: unknown) => a === b || String(a) === String(b)

export function matches(doc: Doc, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'and') return (cond as Where[]).every((w) => matches(doc, w))
    if (key === 'or') return (cond as Where[]).some((w) => matches(doc, w))
    const value = get(doc, key)
    const ops = cond as Record<string, unknown>
    return Object.entries(ops).every(([op, expected]) => {
      switch (op) {
        case 'equals':
          return same(value, expected)
        case 'not_equals':
          return !same(value, expected)
        case 'in':
          return (expected as unknown[]).some((e) => same(value, e))
        case 'exists':
          return expected ? value !== undefined && value !== null : value === undefined || value === null
        case 'less_than':
          return value !== undefined && value !== null && Date.parse(String(value)) < Date.parse(String(expected))
        case 'greater_than':
          return value !== undefined && value !== null && Date.parse(String(value)) > Date.parse(String(expected))
        default:
          throw new Error(`stub payload: unsupported operator ${op}`)
      }
    })
  })
}

const assign = (doc: Doc, data: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && doc[k] && typeof doc[k] === 'object' && !Array.isArray(doc[k])) {
      doc[k] = { ...(doc[k] as Record<string, unknown>), ...(v as Record<string, unknown>) }
    } else doc[k] = v
  }
  doc.updatedAt = new Date().toISOString()
}

export function stubPayload({ collections = [], user = { id: 'u1', email: 'editor@example.org' } }: { collections?: CollectionLike[]; user?: StubPayload['user'] } = {}): StubPayload {
  const store = new Map<string, Doc[]>()
  const list = (c: string) => store.get(c) ?? store.set(c, []).get(c)!
  let seq = 0
  const builtins: CollectionLike[] = [
    { slug: 'proposals', fields: [] },
    { slug: 'runs', fields: [] },
  ]
  const payload: StubPayload = {
    store,
    writes: [],
    user,
    config: { collections: [...builtins, ...collections], serverURL: 'http://localhost:3100' },
    async findByID({ collection, id }) {
      return list(collection).find((d) => same(d.id, id)) ?? null
    },
    async find({ collection, where, limit }) {
      const docs = list(collection).filter((d) => matches(d, where))
      return { docs: limit ? docs.slice(0, limit) : docs }
    },
    async create({ collection, data, context }) {
      const doc: Doc = { id: `${collection.slice(0, 1)}${++seq}`, createdAt: new Date().toISOString(), ...structuredClone(data) }
      list(collection).push(doc)
      payload.writes.push({ op: 'create', collection, context, data })
      return doc
    },
    async update({ collection, id, where, data, context }) {
      payload.writes.push({ op: 'update', collection, context, data })
      if (id !== undefined) {
        const doc = list(collection).find((d) => same(d.id, id))
        if (!doc) throw new Error(`stub payload: ${collection}/${id} not found`)
        assign(doc, structuredClone(data))
        return doc
      }
      const docs = list(collection).filter((d) => matches(d, where))
      docs.forEach((d) => assign(d, structuredClone(data)))
      return { docs, errors: [] }
    },
    async auth() {
      return { user: payload.user }
    },
  }
  return payload
}

/** Call a tool's execute the way the SDK would. */
export const execTool = async (tool: { execute?: (input: never, options: never) => unknown } | undefined, input: unknown): Promise<unknown> => {
  if (!tool?.execute) throw new Error('tool has no execute')
  return tool.execute(input as never, { toolCallId: 'call', messages: [] } as never)
}
