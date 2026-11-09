import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'
import { timingSafeEqual } from 'node:crypto'

import { HIT_PATH, IMPORT_PATH, MISSING_SLUG, REDIRECTS_SLUG, TABLE_PATH, hitKey, isNoise, normalizePath, parseImport, resolveChains, type RedirectRule } from './model'
import { upsertRedirect } from './hooks'

/** How long the CDN may serve the table before asking again. Edits show up within this. */
export const TABLE_MAX_AGE = 60

/**
 * `GET /api/redirects/table`: every redirect, chains followed, for the proxy. Public on
 * purpose (a redirect is visible to anyone who visits the old address) and cached at the
 * edge, so the site reads it about once a minute, not once a visit.
 */
export function tableEndpoint(): Endpoint {
  return {
    path: TABLE_PATH,
    method: 'get',
    handler: async (req) => {
      const rules = await loadRules(req)
      return Response.json(
        { rules: resolveChains(rules) },
        { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${TABLE_MAX_AGE}, stale-while-revalidate=600` } },
      )
    },
  }
}

export async function loadRules(req: PayloadRequest): Promise<RedirectRule[]> {
  const { docs } = await req.payload.find({
    collection: REDIRECTS_SLUG as CollectionSlug,
    depth: 0,
    limit: 0,
    pagination: false,
    select: { from: true, to: true, permanent: true } as never,
    overrideAccess: true,
    req,
  })
  return (docs as unknown as { from?: string; to?: string; permanent?: boolean | null }[])
    .filter((d) => d.from && d.to)
    .map((d) => ({ from: d.from!, to: d.to!, permanent: d.permanent !== false }))
}

const keyMatches = async (req: PayloadRequest): Promise<boolean> => {
  const given = req.headers.get('x-sitekick-key') ?? ''
  const secret = req.payload.config.secret
  if (!given || !secret) return false
  const want = await hitKey(secret)
  return given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want))
}

/** `POST /api/redirects/hit` `{ from }`: the proxy counting a use. Only the site itself can call it. */
export function hitEndpoint(): Endpoint {
  return {
    path: HIT_PATH,
    method: 'post',
    handler: async (req) => {
      if (!(await keyMatches(req))) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const body = (await req.json?.().catch(() => null)) as { from?: unknown } | null
      const from = typeof body?.from === 'string' ? normalizePath(body.from) : null
      if (!from) return Response.json({ error: 'from is required' }, { status: 400 })
      const { docs } = await req.payload.find({ collection: REDIRECTS_SLUG as CollectionSlug, where: { from: { equals: from } }, limit: 1, depth: 0, select: { hits: true } as never, overrideAccess: true, req })
      const doc = docs[0] as unknown as { id: number | string; hits?: number | null } | undefined
      // Straight to the database: a count is not an edit (no hooks, no history, no "updated").
      // Two visitors in the same instant may count once; close enough for "is this still used?".
      if (doc) await req.payload.db.updateOne({ collection: REDIRECTS_SLUG as CollectionSlug, id: doc.id, data: { hits: (doc.hits ?? 0) + 1, lastHitAt: new Date().toISOString() }, req, returning: false })
      return new Response(null, { status: 204 })
    },
  }
}

/**
 * `POST /api/redirects/import` `{ text }`: rows pasted from a spreadsheet (old, new,
 * optional "temporary"). Signed-in editors only. Existing old addresses are updated, so
 * pasting a corrected sheet again is safe.
 */
export function importEndpoint(): Endpoint {
  return {
    path: IMPORT_PATH,
    method: 'post',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in to import redirects.' }, { status: 401 })
      const body = (await req.json?.().catch(() => null)) as { text?: unknown } | null
      const text = typeof body?.text === 'string' ? body.text : ''
      if (!text.trim()) return Response.json({ error: 'Paste at least one line: old address, new address.' }, { status: 400 })
      const { rows, errors } = parseImport(text)
      if (rows.length > 5000) return Response.json({ error: 'That’s more than 5,000 rows. Split it into smaller pastes.' }, { status: 400 })
      let created = 0
      let updated = 0
      for (const row of rows) {
        if (row.from === '/') {
          errors.push({ line: row.line, message: 'The home page can’t be redirected.' })
          continue
        }
        try {
          const before = await req.payload.count({ collection: REDIRECTS_SLUG as CollectionSlug, where: { from: { equals: row.from } }, overrideAccess: true, req })
          await upsertRedirect(req, { from: row.from, to: row.to, permanent: row.permanent, source: 'import' })
          if (before.totalDocs) updated++
          else created++
        } catch (error) {
          errors.push({ line: row.line, message: error instanceof Error ? error.message : 'Couldn’t save this row.' })
        }
      }
      return Response.json({ created, updated, errors: errors.sort((a, b) => a.line - b.line) })
    },
  }
}

/** Open missing pages kept at most; past this only ones already listed are counted. */
export const MISSING_CAP = 1000

/**
 * Note that a visitor hit a page that isn't there, for the Missing pages list. Call it
 * where the site 404s (`notFound()` in a page, the global not-found page). Noise (bots
 * probing for WordPress, missing images) is skipped, and the list is capped so a crawler
 * can't fill the database. Never throws: a 404 must still render.
 */
export async function recordMissing(
  payload: PayloadRequest['payload'],
  input: { path: string; referrer?: string | null },
): Promise<void> {
  try {
    if (!payload.collections[MISSING_SLUG as CollectionSlug]) return
    const path = normalizePath(input.path)
    if (!path || isNoise(path)) return
    const referrer = input.referrer && /^https?:\/\//.test(input.referrer) ? input.referrer.slice(0, 500) : undefined
    const { docs } = await payload.find({ collection: MISSING_SLUG as CollectionSlug, where: { path: { equals: path } }, limit: 1, depth: 0, overrideAccess: true })
    const doc = docs[0] as unknown as { id: number | string; hits?: number; status?: string } | undefined
    const now = new Date().toISOString()
    if (doc) {
      await payload.db.updateOne({ collection: MISSING_SLUG as CollectionSlug, id: doc.id, data: { hits: (doc.hits ?? 0) + 1, lastSeenAt: now, ...(referrer ? { referrer } : {}) }, returning: false })
      return
    }
    const open = await payload.count({ collection: MISSING_SLUG as CollectionSlug, where: { status: { equals: 'open' } }, overrideAccess: true })
    if (open.totalDocs >= MISSING_CAP) return
    await payload.create({ collection: MISSING_SLUG as CollectionSlug, data: { path, hits: 1, lastSeenAt: now, referrer, status: 'open' } as never, overrideAccess: true })
  } catch (error) {
    // A unique clash means another request just added it; anything else is only logged.
    if (!(error instanceof Error && /unique|duplicate/i.test(error.message))) payload.logger.warn(`Missing pages: couldn’t record ${input.path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
