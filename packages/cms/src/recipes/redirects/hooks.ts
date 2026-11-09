import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig, CollectionSlug, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { REDIRECTS_SLUG, normalizePath, pathFor } from './model'

const CONTEXT_KEY = 'sitekickRedirectFrom'

const hasDrafts = (collection: CollectionConfig) => Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts)

/**
 * Before a publish: the address the public sees now. With drafts, that's the published
 * version (the draft may have changed the slug several saves ago), so it's read from the
 * database rather than taken from `originalDoc`.
 */
const rememberPublished =
  (collection: CollectionConfig): CollectionBeforeChangeHook =>
  async ({ data, operation, originalDoc, req }) => {
    if (operation !== 'update' || !originalDoc?.id) return data
    const drafts = hasDrafts(collection)
    if (drafts && data._status !== 'published') return data
    if (!drafts) {
      if (typeof originalDoc.slug === 'string') req.context[CONTEXT_KEY] = { ...(req.context[CONTEXT_KEY] as object), [`${collection.slug}:${originalDoc.id}`]: originalDoc.slug }
      return data
    }
    try {
      const live = await req.payload.findByID({ collection: collection.slug as CollectionSlug, id: originalDoc.id, draft: false, depth: 0, select: { slug: true, _status: true } as never, overrideAccess: true, req })
      const doc = live as unknown as { slug?: unknown; _status?: unknown }
      if (doc._status === 'published' && typeof doc.slug === 'string') req.context[CONTEXT_KEY] = { ...(req.context[CONTEXT_KEY] as object), [`${collection.slug}:${originalDoc.id}`]: doc.slug }
    } catch {
      // Not found published: nothing public to redirect from.
    }
    return data
  }

/**
 * After a publish that moved the page: the old address now sends people to the new one,
 * anything that pointed at the old address points at the new one, and a redirect sitting
 * on the new address is removed (the page lives there now; the proxy would otherwise send
 * visitors away from it).
 */
const writeRedirect =
  (collection: CollectionConfig, prefix: string): CollectionAfterChangeHook =>
  async ({ doc, req }) => {
    const before = (req.context[CONTEXT_KEY] as Record<string, string> | undefined)?.[`${collection.slug}:${doc.id}`]
    if (hasDrafts(collection) && doc._status !== 'published') return doc
    const now = typeof doc.slug === 'string' ? doc.slug : ''
    if (!now) return doc
    const to = pathFor(prefix, now)
    await clearAt(req, to)
    if (!before || before === now) return doc
    const from = normalizePath(pathFor(prefix, before))
    if (!from || from === '/') return doc
    await upsertRedirect(req, { from, to, source: 'slug', note: `Address changed on ${new Date().toISOString().slice(0, 10)}` })
    // Earlier redirects to the old address skip the hop.
    await req.payload.update({ collection: REDIRECTS_SLUG as CollectionSlug, where: { to: { equals: pathFor(prefix, before) } }, data: { to } as never, overrideAccess: true, req })
    return doc
  }

/** A live page at `path` wins over a redirect from it: remove the redirect. */
async function clearAt(req: PayloadRequest, path: string) {
  const at = normalizePath(path)
  if (!at) return
  await req.payload.delete({ collection: REDIRECTS_SLUG as CollectionSlug, where: { from: { equals: at } }, overrideAccess: true, req })
}

export async function upsertRedirect(req: PayloadRequest, data: { from: string; to: string; permanent?: boolean; source?: string; note?: string }) {
  const { docs } = await req.payload.find({ collection: REDIRECTS_SLUG as CollectionSlug, where: { from: { equals: data.from } }, limit: 1, depth: 0, overrideAccess: true, req })
  if (docs[0]) return req.payload.update({ collection: REDIRECTS_SLUG as CollectionSlug, id: docs[0].id, data: data as never, overrideAccess: true, req })
  return req.payload.create({ collection: REDIRECTS_SLUG as CollectionSlug, data: data as never, overrideAccess: true, req })
}

/** The redirect hooks on one public collection. Exported for tests. */
export function withSlugRedirects(collection: CollectionConfig, prefix: string): CollectionConfig {
  const hooks = collection.hooks ?? {}
  return {
    ...collection,
    hooks: {
      ...hooks,
      beforeChange: [...(hooks.beforeChange ?? []), rememberPublished(collection)],
      afterChange: [...(hooks.afterChange ?? []), writeRedirect(collection, prefix)],
    },
  }
}

/** Public collections and their address prefix: an explicit list, else every `custom.sitekick.seo.pathPrefix`. */
export function publicPrefixes(collections: CollectionConfig[], explicit?: Record<string, string>): Record<string, string> {
  if (explicit) return explicit
  const out: Record<string, string> = {}
  for (const c of collections) {
    const seo = (c.custom as { sitekick?: { seo?: unknown } } | undefined)?.sitekick?.seo
    const prefix = seo && typeof seo === 'object' ? (seo as { pathPrefix?: unknown }).pathPrefix : undefined
    if (typeof prefix === 'string' && hasSlugField(c)) out[c.slug] = prefix
  }
  return out
}

const hasSlugField = (c: CollectionConfig): boolean => {
  const walk = (fields: CollectionConfig['fields']): boolean =>
    fields.some((f) => {
      if (f.type === 'tabs') return f.tabs.some((t) => !('name' in t && t.name) && walk(t.fields))
      if (f.type === 'row' || f.type === 'collapsible') return walk(f.fields)
      return 'name' in f && f.name === 'slug'
    })
  return walk(c.fields)
}

/**
 * A redirect can't sit on an address a published page has: the proxy runs first, so the
 * page would vanish. Say so, and say how to move it.
 */
export const guardLivePages =
  (prefixes: Record<string, string>): CollectionBeforeValidateHook =>
  async ({ data, req }) => {
    const from = typeof data?.from === 'string' ? normalizePath(data.from) : null
    if (!from) return data
    for (const [slug, prefix] of Object.entries(prefixes)) {
      const base = normalizePath(pathFor(prefix, '')) ?? '/'
      const rest = base === '/' ? from.slice(1) : from.startsWith(`${base}/`) ? from.slice(base.length + 1) : null
      if (!rest || rest.includes('/')) continue
      const collection = req.payload.collections[slug as CollectionSlug]?.config
      if (!collection) continue
      const drafts = hasDrafts(collection as unknown as CollectionConfig)
      const { totalDocs } = await req.payload.count({
        collection: slug as CollectionSlug,
        where: { slug: { equals: rest }, ...(drafts ? { _status: { equals: 'published' } } : {}) },
        overrideAccess: true,
        req,
      })
      if (totalDocs) {
        const label = typeof collection.labels?.singular === 'string' ? collection.labels.singular.toLowerCase() : 'page'
        throw new APIError(`A published ${label} lives at ${from}, and it would win. Change that ${label}’s address or unpublish it first.`, 400, undefined, true)
      }
    }
    return data
  }
