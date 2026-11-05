import type { AdminViewServerProps, CollectionSlug, FlattenedField, PayloadRequest, SanitizedCollectionConfig } from 'payload'
import { Gutter } from '@payloadcms/ui'

import { labelOf } from '../dashboard/data'
import { BoardClient } from './BoardClient'
import { columnOf, type Card } from './model'

/** Cards per status; past this the column links to the list, filtered. */
const LIMIT = 60

/**
 * `/admin/collections/<slug>/board`, for collections with drafts (lists/index.ts). Reads
 * the latest version of each document with the editor's own access, as the list view does,
 * and sorts it into Draft, Changed and Published; BoardClient does the moving.
 */
export async function BoardView(props: AdminViewServerProps) {
  const { i18n, initPageResult, payload, permissions } = props
  const req = initPageResult.req
  const collection = initPageResult.collectionConfig
  const adminRoute = payload.config.routes.admin
  if (!collection) return null
  const listURL = `${adminRoute}/collections/${collection.slug}`
  if (!req.user) {
    props.server.redirect(`${adminRoute}/login?redirect=${encodeURIComponent(`${listURL}/board`)}`)
    return null
  }

  const { cards, totals } = await loadCards(req, collection, adminRoute)
  const plural = labelOf(collection.labels?.plural, i18n, collection.slug)
  const singular = labelOf(collection.labels?.singular, i18n, collection.slug).toLowerCase()
  const canUpdate = Boolean((permissions ?? initPageResult.permissions)?.collections?.[collection.slug]?.update)

  // Payload renders collection views inside its own template; this is only the page body.
  return (
    <Gutter>
      <BoardClient
        apiRoute={payload.config.routes.api}
        cards={cards}
        canUpdate={canUpdate}
        collection={collection.slug}
        createURL={`${listURL}/create`}
        listURL={listURL}
        now={Date.now()}
        plural={plural}
        singular={singular}
        totals={totals}
      />
    </Gutter>
  )
}

async function loadCards(req: PayloadRequest, collection: SanitizedCollectionConfig, adminRoute: string) {
  const slug = collection.slug as CollectionSlug
  const titleField = collection.admin?.useAsTitle ?? 'id'
  const image = imageFieldOf(collection.flattenedFields)
  const select: Record<string, true> = { [titleField]: true, updatedAt: true, _status: true, ...(image ? { [image]: true } : {}) }
  const find = (status: 'draft' | 'published') =>
    req.payload.find({
      collection: slug,
      draft: true,
      depth: image ? 1 : 0,
      limit: LIMIT,
      sort: '-updatedAt',
      select,
      where: { _status: { equals: status } },
      overrideAccess: false,
      user: req.user,
      req,
    })
  const [drafts, published] = await Promise.all([find('draft'), find('published')])

  // A draft is Changed when the site still shows a published copy: the main document (not
  // the latest version) is published. "Has a published version" isn't enough, because an
  // unpublished document keeps its old published versions.
  const draftIDs = drafts.docs.map((doc) => doc.id)
  const live = draftIDs.length
    ? await req.payload.find({
        collection: slug,
        depth: 0,
        limit: 0,
        pagination: false,
        select: {},
        where: { and: [{ id: { in: draftIDs } }, { _status: { equals: 'published' } }] },
        overrideAccess: false,
        user: req.user,
        req,
      })
    : { docs: [] }
  const hasPublished = new Set(live.docs.map((doc) => doc.id))

  const toCard = (doc: Record<string, unknown>): Card => {
    const id = doc.id as number | string
    const title = doc[titleField]
    return {
      id,
      title: typeof title === 'string' && title.trim() ? title : `Untitled ${String(id)}`,
      column: columnOf(doc._status, id, hasPublished),
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
      href: `${adminRoute}/collections/${collection.slug}/${encodeURIComponent(String(id))}`,
      image: image ? thumbnailOf(doc[image]) : undefined,
    }
  }
  const cards = [...drafts.docs, ...published.docs].map((doc) => toCard(doc as unknown as Record<string, unknown>))
  const changed = cards.filter((c) => c.column === 'changed').length
  return {
    cards,
    // Payload can count drafts but not split them; past the limit "changed" is what was seen.
    totals: { draft: drafts.totalDocs - changed, changed, published: published.totalDocs },
  }
}

/** The first single image field outside arrays and blocks: a post's cover, a person's photo. */
function imageFieldOf(fields: FlattenedField[]): string | undefined {
  const field = fields.find((f) => f.type === 'upload' && !f.hasMany && typeof f.relationTo === 'string')
  return field?.name
}

function thumbnailOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const media = value as { url?: string; mimeType?: string; sizes?: Record<string, { url?: string | null; width?: number | null }> }
  if (media.mimeType && !media.mimeType.startsWith('image/')) return undefined
  const sizes = Object.values(media.sizes ?? {})
    .filter((s) => s?.url && (s.width ?? 0) >= 160)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return sizes[0]?.url ?? media.url ?? undefined
}
