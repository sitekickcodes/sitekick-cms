import type { CollectionAfterDeleteHook, CollectionSlug, Where } from 'payload'

export type PromoteSlugCopyOptions = {
  /** The slug field. Default `slug`. */
  field?: string
  /** Same scope as the collection's autoSlug, if it has one. `null` skips the promotion for this doc. */
  scope?: (doc: Record<string, unknown>) => Where | null
  /**
   * The public path for a slug ("/news/brian-jaffe"). When given, a 301 from
   * the copy's old path to its new one is written to `redirectsCollection`
   * (the shape @payloadcms/plugin-redirects reads), so links already shared
   * keep working.
   */
  redirect?: (slug: string) => string
  /** Default `redirects`. */
  redirectsCollection?: string
}

/**
 * Deleting a duplicate gives the copy the plain URL back. The slug hooks give
 * a clash "-2", "-3", …; when the record holding the plain slug is deleted
 * (usually the duplicate half of a pair), the lowest numbered copy takes it:
 * delete "brian-jaffe" and "brian-jaffe-2" becomes "brian-jaffe". Deleting a
 * numbered copy changes nothing.
 */
export const promoteSlugCopy =
  (options: PromoteSlugCopyOptions = {}): CollectionAfterDeleteHook =>
  async ({ collection, doc, req }) => {
    const field = options.field ?? 'slug'
    const record = (doc ?? {}) as Record<string, unknown>
    const slug = typeof record[field] === 'string' ? (record[field] as string) : ''
    if (!slug || /-\d+$/.test(slug)) return doc
    const scope = options.scope ? options.scope(record) : {}
    if (scope === null) return doc
    const drafts = Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts)
    const { docs } = await req.payload.find({
      collection: collection.slug,
      where: { and: [{ [field]: { like: slug } }, ...(Object.keys(scope).length ? [scope] : [])] },
      select: drafts ? { [field]: true, _status: true } : { [field]: true },
      depth: 0,
      limit: 200,
      pagination: false,
      overrideAccess: true,
      ...(drafts ? { draft: true } : {}),
      req,
    })
    const numbered = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}-(\\d+)$`)
    const copy = (docs as unknown as { id: number | string; _status?: string; [key: string]: unknown }[])
      .map((d) => ({ d, n: Number(numbered.exec(typeof d[field] === 'string' ? (d[field] as string) : '')?.[1]) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.n - b.n)[0]?.d
    if (!copy) return doc

    const old = copy[field] as string
    await req.payload.update({
      collection: collection.slug,
      id: copy.id,
      data: { [field]: slug },
      depth: 0,
      overrideAccess: true,
      ...(drafts ? { draft: copy._status !== 'published' } : {}),
      req,
    })
    if (options.redirect) {
      await req.payload.create({
        collection: (options.redirectsCollection ?? 'redirects') as CollectionSlug,
        data: { from: options.redirect(old), to: { type: 'custom', url: options.redirect(slug) }, type: '301' } as never,
        overrideAccess: true,
        req,
      })
    }
    return doc
  }
