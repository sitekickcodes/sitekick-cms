import type { Payload } from 'payload'

import { sampleConfig } from '../../agent/__tests__/fixture'

type Doc = Record<string, unknown>

/** A Payload with just enough `find`/`findGlobal` for the catalog: in-memory docs, like/equals on text. */
export const fakePayload = (docs: Record<string, Doc[]>, globals: Record<string, Doc> = {}) => {
  const calls: unknown[] = []
  const matches = (doc: Doc, where: unknown): boolean => {
    if (!where || typeof where !== 'object') return true
    const w = where as Record<string, unknown>
    if (Array.isArray(w.and)) return w.and.every((part) => matches(doc, part))
    if (Array.isArray(w.or)) return w.or.some((part) => matches(doc, part))
    return Object.entries(w).every(([field, cond]) => {
      const c = cond as { equals?: unknown; like?: string }
      const value = doc[field]
      if ('equals' in c) return value === c.equals
      if (c.like !== undefined) return typeof value === 'string' && value.toLowerCase().includes(c.like.toLowerCase())
      return true
    })
  }
  const payload = {
    config: sampleConfig(),
    collections: {},
    find: async (args: { collection: string; where?: unknown; limit?: number; page?: number }) => {
      calls.push(args)
      const all = (docs[args.collection] ?? []).filter((d) => matches(d, args.where))
      const limit = args.limit ?? 10
      const page = args.page ?? 1
      return { docs: all.slice((page - 1) * limit, page * limit), totalDocs: all.length, page }
    },
    findGlobal: async (args: { slug: string }) => {
      calls.push(args)
      return globals[args.slug] ?? {}
    },
  }
  return { payload: payload as unknown as Payload, calls }
}

export const sampleDocs = {
  posts: [
    { id: 1, title: 'Hello world', slug: 'hello-world', excerpt: 'First post.', _status: 'published', updatedAt: '2026-01-02T00:00:00.000Z', body: { root: { children: [] } } },
    { id: 2, title: 'Draft only', slug: 'draft-only', excerpt: '', _status: 'draft', updatedAt: '2026-01-03T00:00:00.000Z' },
    { id: 3, title: 'Parking reform', slug: 'parking', meta: { description: 'From SEO.' }, _status: 'published', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  people: [{ id: 'a', name: 'Sam', slug: 'sam', role: 'Editor', updatedAt: '2026-01-01T00:00:00.000Z' }],
  inbox: [{ id: 9, email: 'x@y.z', slug: 'x' }],
}

export const sampleGlobals = { 'site-settings': { tagline: 'Hi', phone: '555', logo: 4, updatedAt: '2026-01-01T00:00:00.000Z' } }
