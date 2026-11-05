import type { PayloadRequest, SanitizedCollectionConfig, SanitizedPermissions, ServerProps } from 'payload'

type I18nClient = ServerProps['i18n']

/** Everything a card needs that the view already has. */
export type CardContext = {
  req: PayloadRequest
  permissions: SanitizedPermissions
  i18n: I18nClient
  adminRoute: string
}

export type Row = {
  key: string
  title: string
  kind: string
  at: string
  href: string
  draft: boolean
  /** Replaces the "2 days ago" on the right, e.g. an event's date. */
  aside?: string
}

/** A collection label (string, locale map or function) as text. */
export function labelOf(label: SanitizedCollectionConfig['labels']['singular'] | undefined, i18n: I18nClient, fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  if (typeof label === 'function') return label({ t: i18n.t as never, i18n })
  return label[i18n.language] ?? label.en ?? Object.values(label)[0] ?? fallback
}

/** Internal collections (`payload-*`) never belong on a client's dashboard. */
const internal = (slug: string) => slug.startsWith('payload-')

/** Hidden for this user, per `admin.hidden`. */
export function isHidden(collection: SanitizedCollectionConfig, user: unknown): boolean {
  const { hidden } = collection.admin
  return typeof hidden === 'function' ? hidden({ user } as never) : Boolean(hidden)
}

/** Collections this user may read, visible in the admin, in config order. */
export function readableCollections({ req, permissions }: Pick<CardContext, 'req' | 'permissions'>): SanitizedCollectionConfig[] {
  return req.payload.config.collections.filter(
    (c) => !internal(c.slug) && !isHidden(c, req.user) && permissions.collections?.[c.slug]?.read,
  )
}

/** Collections this user may create in, visible in the admin. */
export function creatableCollections({ req, permissions }: Pick<CardContext, 'req' | 'permissions'>): SanitizedCollectionConfig[] {
  return req.payload.config.collections.filter(
    (c) => !internal(c.slug) && !isHidden(c, req.user) && permissions.collections?.[c.slug]?.create,
  )
}

/** "3 min ago", "5 h ago", "12 days ago". */
export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

/**
 * The newest documents of one collection as rows, read as the user. A
 * collection the user cannot read yields nothing rather than an error.
 */
export async function recentRows(
  { req, i18n, adminRoute }: CardContext,
  collection: SanitizedCollectionConfig,
  { where, limit }: { where?: Record<string, unknown>; limit: number },
): Promise<Row[]> {
  const titleField = collection.admin.useAsTitle && collection.admin.useAsTitle !== 'id' ? collection.admin.useAsTitle : null
  const drafts = Boolean(collection.versions?.drafts)
  const kind = labelOf(collection.labels?.singular, i18n, collection.slug)
  try {
    const { docs } = await req.payload.find({
      collection: collection.slug,
      where: where as never,
      sort: '-updatedAt',
      limit,
      depth: 0,
      overrideAccess: false,
      req,
      select: { updatedAt: true, ...(titleField ? { [titleField]: true } : {}), ...(drafts ? { _status: true } : {}) } as never,
    })
    return docs.map((d) => {
      const doc = d as Record<string, unknown> & { id: number | string; updatedAt: string }
      const title = titleField && typeof doc[titleField] === 'string' && doc[titleField] ? (doc[titleField] as string) : `${kind} #${doc.id}`
      return {
        key: `${collection.slug}:${doc.id}`,
        title,
        kind,
        at: doc.updatedAt,
        href: `${adminRoute}/collections/${collection.slug}/${doc.id}`,
        draft: doc._status === 'draft',
      }
    })
  } catch {
    return []
  }
}

/** Merge per-collection rows newest first, at most `perCollection` each so one import cannot fill the list. */
export function newest(rows: Row[][], n: number, perCollection = 3): Row[] {
  return rows
    .flatMap((r) => r.slice(0, perCollection))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, n)
}
