import type { CollectionBeforeValidateHook, Where } from 'payload'
import { ValidationError } from 'payload'

/** "Reform the Rules!" → "reform-the-rules". ASCII only, 80 characters at most. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** The first of `base`, `base-2`, `base-3`, … not in `taken`. */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let slug = base
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
  return slug
}

export type AutoSlugOptions = {
  /** Field(s) the slug is made from when blank, in order of preference. Default `title`, then `name`. */
  from?: string | string[]
  /** The slug field. Default `slug`. */
  field?: string
  /**
   * Where the slug must be unique. Default: the whole collection. Return a
   * `where` clause to scope it (per site, per parent), or `null` to skip the
   * uniqueness check for this doc.
   */
  scope?: (doc: Record<string, unknown>) => Where | null
  /** Slugs no document may take (coded routes, reserved prefixes). */
  reserved?: Iterable<string>
}

/**
 * beforeValidate: fill a blank slug from the title (editors shouldn't have to
 * think about URLs), tidy a typed one, reject reserved segments, and keep it
 * unique with "-2", "-3", … — so a duplicated document, which arrives with
 * its original's slug, gets its own. Set once and then kept: corrections to
 * the title don't move links. A DB unique index is what makes uniqueness
 * race-proof; this hook is the readable behaviour.
 *
 *   hooks: { beforeValidate: [autoSlug({ from: 'title' })] }
 */
export const autoSlug =
  (options: AutoSlugOptions = {}): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req, collection }) => {
    if (!data) return data
    const field = options.field ?? 'slug'
    const sources = Array.isArray(options.from) ? options.from : options.from ? [options.from] : ['title', 'name']
    const incoming = data as Record<string, unknown>
    const original = (originalDoc ?? {}) as Record<string, unknown>

    let slug = typeof incoming[field] === 'string' ? (incoming[field] as string).trim() : undefined
    if (slug === undefined) slug = typeof original[field] === 'string' ? (original[field] as string) : ''
    if (!slug) {
      for (const key of sources) {
        const source = incoming[key] ?? original[key]
        if (typeof source === 'string' && source.trim()) {
          slug = slugify(source)
          break
        }
      }
    }
    if (slug) slug = slugify(slug) || slug
    if (!slug) return data // a fresh draft — `required` bites at publish

    const reserved = new Set(options.reserved ?? [])
    if (reserved.has(slug)) {
      throw new ValidationError({
        collection: collection.slug,
        errors: [{ path: field, message: `“${slug}” is reserved for site routing — pick a different slug.` }],
        req,
      })
    }

    const scope = options.scope ? options.scope({ ...original, ...incoming }) : {}
    if (scope !== null) {
      const originalId = original.id
      const { docs } = await req.payload.find({
        collection: collection.slug,
        where: {
          and: [
            { [field]: { like: slug } },
            ...(originalId != null ? [{ id: { not_equals: originalId } }] : []),
            ...(Object.keys(scope).length ? [scope] : []),
          ],
        },
        select: { [field]: true },
        limit: 200,
        depth: 0,
        pagination: false,
        draft: true,
        req,
        overrideAccess: true,
      })
      const taken = docs.map((d) => (d as unknown as Record<string, unknown>)[field]).filter((s): s is string => typeof s === 'string')
      slug = nextFreeSlug(slug, taken)
    }

    return { ...incoming, [field]: slug }
  }
