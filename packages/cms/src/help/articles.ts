import type { CollectionSlug, PayloadRequest } from 'payload'

import { HELP_SLUG, type HelpArticle } from './shared'

type HelpDoc = {
  id: number | string
  title: string
  slug: string
  topic: string
  summary?: string | null
  body: HelpArticle['body']
  related?: (number | string | { id: number | string })[] | null
  aliases?: { slug: string }[] | null
}

type UploadNode = { type?: string; relationTo?: string; value?: unknown; children?: unknown[]; root?: unknown }

/**
 * Reads the published articles as the requesting user, in `_order`. A draft
 * is included only through the separately authorised `preview` id, so staff
 * see what readers see unless they ask for a preview.
 *
 * Images inside an article are resolved to public file metadata with
 * `overrideAccess` on the upload collection: a published help image is for
 * every reader, even where the media library itself is restricted. Only the
 * referenced files are read; the reader's media permissions never widen.
 */
export async function readHelpArticles(
  req: PayloadRequest,
  { slug = HELP_SLUG, preview }: { slug?: string; preview?: string } = {},
): Promise<HelpArticle[]> {
  const { docs } = (await req.payload.find({
    collection: slug as CollectionSlug,
    where: { _status: { equals: 'published' } },
    draft: false,
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '_order',
    overrideAccess: false,
    req,
  })) as unknown as { docs: HelpDoc[] }

  if (preview) {
    const draft = (await req.payload.findByID({
      collection: slug as CollectionSlug,
      id: preview,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    })) as unknown as HelpDoc
    const index = docs.findIndex((doc) => doc.id === draft.id)
    if (index === -1) docs.push(draft)
    else docs[index] = draft
  }

  await resolveUploads(req, docs)

  const slugs = new Map(docs.map((doc) => [doc.id, doc.slug]))
  return docs.map((doc) => ({
    id: doc.slug,
    title: doc.title,
    topic: doc.topic,
    summary: doc.summary ?? '',
    body: doc.body,
    aliases: (doc.aliases ?? []).map((alias) => alias.slug),
    related: (doc.related ?? []).flatMap((item) => {
      const related = slugs.get(typeof item === 'object' ? item.id : item)
      return related && related !== doc.slug ? [related] : []
    }),
  }))
}

async function resolveUploads(req: PayloadRequest, docs: HelpDoc[]) {
  const uploads = new Map<string, UploadNode[]>()
  const uploadCollections = new Set(req.payload.config.collections.filter((c) => c.upload).map((c) => c.slug))
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const node = value as UploadNode
    if (node.type === 'upload' && node.relationTo && uploadCollections.has(node.relationTo as CollectionSlug) && node.value && typeof node.value !== 'object') {
      uploads.set(node.relationTo, [...(uploads.get(node.relationTo) ?? []), node])
    }
    node.children?.forEach(collect)
    if (node.root) collect(node.root)
  }
  docs.forEach((doc) => collect(doc.body))

  for (const [collection, nodes] of uploads) {
    const ids = [...new Set(nodes.map((node) => node.value as number | string))]
    const { docs: files } = (await req.payload.find({
      collection: collection as CollectionSlug,
      where: { id: { in: ids } },
      select: { url: true, filename: true, mimeType: true, alt: true, width: true, height: true } as never,
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })) as unknown as { docs: { id: number | string }[] }
    const byId = new Map(files.map((file) => [String(file.id), file]))
    nodes.forEach((node) => {
      node.value = byId.get(String(node.value)) ?? {}
    })
  }
}
