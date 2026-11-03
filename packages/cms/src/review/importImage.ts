import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import type { CollectionSlug, Field, PayloadRequest } from 'payload'

import { fieldAtPath } from './render'

/**
 * Agents propose images they found on the web as `{ sourceUrl, credit }`,
 * because they never write to the media library. When an editor accepts one
 * into an upload field, the image is fetched here and created in that
 * field's collection with the editor's own access; the field gets the new id.
 */
export type WebImage = { sourceUrl: string; credit?: string }

export const isWebImage = (value: unknown): value is WebImage =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as WebImage).sourceUrl === 'string' && /^https?:\/\//i.test((value as WebImage).sourceUrl))

const MAX_BYTES = 10 * 1024 * 1024
const MAX_REDIRECTS = 4

const privateV4 = (ip: string) => {
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}
const privateV6 = (ip: string) => {
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return privateV4(v.slice(7))
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

/** Refuse anything that resolves to a loopback, private or link-local address. */
export async function assertPublicHost(url: URL, resolve: (host: string) => Promise<Array<{ address: string }>> = (h) => lookup(h, { all: true })): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only web images can be imported.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('That image address is not public.')
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host)
  for (const { address } of addresses) {
    if (isIP(address) === 4 ? privateV4(address) : privateV6(address)) throw new Error('That image address is not public.')
  }
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' }

const fileName = (url: URL, mimetype: string) => {
  // Image optimisers (/_next/image?url=/jane.jpg) name the real file in the query.
  const inner = url.searchParams.get('url')
  const path = inner && url.pathname.endsWith('/image') ? inner.split('?')[0]! : url.pathname
  const base =
    decodeURIComponent(path.split('/').pop() ?? '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  return `${base}.${EXT[mimetype] ?? 'img'}`
}

/** Download with the guards above: public hosts on every hop, images only, size capped. */
export async function fetchImage(sourceUrl: string, fetchImpl: typeof fetch = fetch): Promise<{ data: Buffer; mimetype: string; name: string }> {
  let url = new URL(sourceUrl)
  const signal = AbortSignal.timeout(20_000)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url)
    const res = await fetchImpl(url, { redirect: 'manual', signal, headers: { Accept: 'image/*' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel().catch(() => {})
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new Error(`The image could not be downloaded (HTTP ${res.status}).`)
    const mimetype = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!mimetype.startsWith('image/')) {
      await res.body?.cancel().catch(() => {})
      throw new Error('That address is not an image.')
    }
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('The image is larger than 10 MB.')
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = res.body?.getReader()
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => {})
        throw new Error('The image is larger than 10 MB.')
      }
      chunks.push(value)
    }
    return { data: Buffer.concat(chunks), mimetype, name: fileName(url, mimetype) }
  }
  throw new Error('The image address redirected too many times.')
}

/**
 * Replace each accepted web image headed for an upload field with a new
 * media document. `alt` is the document's title ("Photo of Jane Doe" reads
 * worse to a screen reader than the name in context); the credit goes to a
 * `credit` field when the media collection has one.
 */
export async function importAcceptedImages({
  req,
  fields,
  values,
  alt,
  fetchImpl,
  onCreate,
}: {
  req: PayloadRequest
  fields: Field[]
  values: Record<string, unknown>
  alt: string
  fetchImpl?: typeof fetch
  /** Told about each media document created, so a failed write can remove them. */
  onCreate?: (created: { collection: string; id: string | number }) => void
}): Promise<Record<string, unknown>> {
  const out = { ...values }
  for (const [path, value] of Object.entries(values)) {
    const field = fieldAtPath(fields, path)
    if (!field || field.type !== 'upload' || typeof field.relationTo !== 'string' || !isWebImage(value)) continue
    const media = req.payload.collections[field.relationTo as CollectionSlug]
    if (!media) continue
    const file = await fetchImage(value.sourceUrl, fetchImpl)
    const hasCredit = media.config.fields.some((f) => 'name' in f && f.name === 'credit')
    const created = (await req.payload.create({
      collection: field.relationTo as CollectionSlug,
      data: { alt: alt || file.name, ...(hasCredit && value.credit ? { credit: value.credit } : {}) } as never,
      file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.byteLength },
      depth: 0,
      req,
      overrideAccess: false,
    })) as { id: string | number }
    onCreate?.({ collection: field.relationTo, id: created.id })
    out[path] = created.id
  }
  return out
}
