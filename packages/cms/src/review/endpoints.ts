import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { isUserAccount } from '../access'
import { importAcceptedImages } from './importImage'
import { fieldAtPath } from './render'
import {
  ACTIVE_RUN_STATUSES,
  REVIEW_AGENT_CONTEXT,
  answerBody,
  asDecisions,
  asPatch,
  computeStatus,
  decideBody,
  isFinal,
  setAtPath,
  topLevelOf,
  type Decisions,
} from './shared'

/**
 * The review endpoints. Every write goes through the Local API with the
 * editor's `req` and `overrideAccess: false`, so access, hooks, versions and
 * authorship behave as for a person typing, and carries
 * `context.sitekickAgent = 'review'` so outbox hooks do not re-enqueue.
 */

export type ReviewEndpointOptions = {
  proposalsSlug: string
  runsSlug: string
  usersSlug: string
}

type Json = Record<string, unknown>

const json = (body: Json, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

const idOf = (req: PayloadRequest): string | null => {
  const id = req.routeParams?.id
  return typeof id === 'string' && id.trim() ? id : typeof id === 'number' ? String(id) : null
}

/** The body as JSON, or nothing when it is missing or malformed. */
async function readBody(req: PayloadRequest): Promise<unknown> {
  try {
    return typeof req.json === 'function' ? await req.json() : null
  } catch {
    return null
  }
}

/** A Payload error as a response: its own status when it has one, else 500. */
function fail(err: unknown, fallback: string): Response {
  const e = err as { status?: unknown; message?: unknown }
  const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500
  const message = status === 403 ? 'You cannot change that document.' : typeof e?.message === 'string' && status !== 500 ? e.message : fallback
  return json({ error: message }, status)
}

/**
 * `POST /api/proposals/:id/decide` `{ decisions: Record<path, 'accepted' | 'rejected'> }`
 *
 * Writes the accepted fields to the target (as a draft when the target has
 * drafts, never publishing), creates the target as a draft on the first
 * acceptance when the proposal has no `targetId`, then stores the merged
 * decisions, who reviewed and the computed status.
 */
export function decideEndpoint({ proposalsSlug, usersSlug }: ReviewEndpointOptions): Endpoint {
  return {
    path: '/:id/decide',
    method: 'post',
    handler: async (req) => {
      if (!isUserAccount(req.user, usersSlug) || !req.user) return json({ error: 'Sign in to review.' }, 401)
      const id = idOf(req)
      if (!id) return json({ error: 'Which proposal?' }, 400)
      const parsed = decideBody.safeParse(await readBody(req))
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Invalid body.', issues: parsed.error.issues }, 400)

      const { payload } = req
      let proposal: Record<string, unknown>
      try {
        proposal = (await payload.findByID({ collection: proposalsSlug as CollectionSlug, id, depth: 0, req, overrideAccess: false })) as unknown as Record<string, unknown>
      } catch (err) {
        return fail(err, 'That proposal could not be loaded.')
      }
      if (isFinal(proposal.status)) return json({ error: 'This proposal has already been decided.' }, 409)

      const patch = asPatch(proposal.patch)
      const unknown = Object.keys(parsed.data.decisions).filter((path) => !(path in patch))
      if (unknown.length) return json({ error: `Not in this proposal: ${unknown.join(', ')}` }, 400)

      const previous = asDecisions(proposal.decisions)
      const merged: Decisions = { ...previous, ...parsed.data.decisions }
      // Only fields newly accepted in this call are written; a path accepted
      // earlier has already landed on the target.
      const toWrite = Object.entries(parsed.data.decisions)
        .filter(([path, d]) => d === 'accepted' && previous[path] !== 'accepted')
        .map(([path]) => path)

      const targetCollection = typeof proposal.targetCollection === 'string' ? proposal.targetCollection : ''
      const target = payload.collections[targetCollection as CollectionSlug]
      if (!target) return json({ error: `Unknown collection "${targetCollection}".` }, 422)
      const drafts = Boolean(target.config.versions?.drafts)
      let targetId: string | number | null =
        typeof proposal.targetId === 'string' && proposal.targetId.trim() ? proposal.targetId : typeof proposal.targetId === 'number' ? proposal.targetId : null

      if (toWrite.length) {
        const imported: Array<{ collection: string; id: string | number }> = []
        try {
          const titleField = target.config.admin?.useAsTitle ?? 'title'
          const accepted = Object.fromEntries(toWrite.map((path) => [path, patch[path]?.value]))
          const importImages = (doc: Record<string, unknown>) =>
            importAcceptedImages({ req, fields: target.config.fields, values: accepted, alt: typeof doc[titleField] === 'string' ? (doc[titleField] as string) : '', onCreate: (m) => imported.push(m) })
          if (targetId !== null) {
            // Read the latest draft so sibling keys and array rows survive a nested write.
            const current = (await payload.findByID({
              collection: target.config.slug as CollectionSlug,
              id: targetId,
              depth: 0,
              draft: drafts,
              req,
              overrideAccess: false,
            })) as unknown as Record<string, unknown>
            assertUnchangedSections(target.config.fields, toWrite, patch, current)
            const values = await importImages(current)
            const whole = toWrite.reduce<Record<string, unknown>>((acc, path) => setAtPath(acc, path, values[path]), current)
            const data: Record<string, unknown> = {}
            for (const key of new Set(toWrite.map(topLevelOf))) data[key] = whole[key]
            await payload.update({
              collection: target.config.slug as CollectionSlug,
              id: targetId,
              data: data as never,
              depth: 0,
              draft: drafts,
              req,
              overrideAccess: false,
              context: { ...REVIEW_AGENT_CONTEXT },
            })
          } else {
            const values = await importImages(Object.fromEntries(toWrite.map((path) => [path, patch[path]?.value])))
            const data = toWrite.reduce<Record<string, unknown>>((acc, path) => setAtPath(acc, path, values[path]), {})
            const created = (await payload.create({
              collection: target.config.slug as CollectionSlug,
              data: data as never,
              depth: 0,
              draft: drafts,
              req,
              overrideAccess: false,
              context: { ...REVIEW_AGENT_CONTEXT },
            })) as { id: string | number }
            targetId = created.id
          }
        } catch (err) {
          // Images fetched for a write that failed would sit orphaned in the library.
          for (const m of imported) await payload.delete({ collection: m.collection as CollectionSlug, id: m.id, req, overrideAccess: false }).catch(() => {})
          return fail(err, 'The change could not be saved to the document.')
        }
      }

      const status = computeStatus(patch, merged)
      const reviewedAt = new Date().toISOString()
      try {
        await payload.update({
          collection: proposalsSlug as CollectionSlug,
          id,
          data: {
            decisions: merged,
            status,
            reviewedBy: req.user.id,
            reviewedAt,
            ...(targetId !== null && !proposal.targetId ? { targetId: String(targetId) } : {}),
          } as never,
          depth: 0,
          req,
          overrideAccess: false,
          context: { ...REVIEW_AGENT_CONTEXT },
        })
      } catch (err) {
        return fail(err, 'The decision was applied but could not be recorded.')
      }
      return json({ id, status, decisions: merged, targetId: targetId === null ? null : String(targetId), reviewedAt })
    },
  }
}

/** Same stored value, ignoring key order and empty keys. */
const canonical = (value: unknown): string =>
  JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== null && x !== undefined).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

/**
 * A blocks proposal replaces the whole field, so accepting it after someone
 * edited the sections would silently undo their work (principle 3: an agent
 * never overwrites a human's edit). Refuse when the field no longer matches
 * the snapshot the agent worked from.
 */
export function assertUnchangedSections(fields: Parameters<typeof fieldAtPath>[0], paths: string[], patch: ReturnType<typeof asPatch>, doc: Record<string, unknown>): void {
  for (const path of paths) {
    const proposed = patch[path]
    if (!proposed || proposed.current === undefined || fieldAtPath(fields, path)?.type !== 'blocks') continue
    const now = path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), doc)
    if (canonical(now) !== canonical(proposed.current)) {
      throw Object.assign(new Error('The sections changed after this was proposed, so accepting it would undo those edits. Ask for the change again.'), { status: 409 })
    }
  }
}

type RunTransition = {
  path: string
  /** Statuses the run must be in for this to apply. */
  from: readonly string[]
  /** Fields to set; `answer` is filled from the body for the answer route. */
  data: (body: unknown) => Record<string, unknown> | { error: string }
  denied: string
}

function runEndpoint({ runsSlug, usersSlug }: ReviewEndpointOptions, t: RunTransition): Endpoint {
  return {
    path: `/:id/${t.path}`,
    method: 'post',
    handler: async (req) => {
      if (!isUserAccount(req.user, usersSlug)) return json({ error: 'Sign in to manage runs.' }, 401)
      const id = idOf(req)
      if (!id) return json({ error: 'Which run?' }, 400)
      const data = t.data(await readBody(req))
      if ('error' in data && typeof data.error === 'string' && Object.keys(data).length === 1) return json({ error: data.error }, 400)
      const { payload } = req
      let run: Record<string, unknown>
      try {
        run = (await payload.findByID({ collection: runsSlug as CollectionSlug, id, depth: 0, req, overrideAccess: false })) as unknown as Record<string, unknown>
      } catch (err) {
        return fail(err, 'That run could not be loaded.')
      }
      if (!t.from.includes(String(run.status))) return json({ error: t.denied }, 409)
      try {
        const updated = (await payload.update({
          collection: runsSlug as CollectionSlug,
          id,
          data: data as never,
          depth: 0,
          req,
          overrideAccess: false,
          context: { ...REVIEW_AGENT_CONTEXT },
        })) as unknown as Record<string, unknown>
        return json({ id, status: updated.status, run: updated })
      } catch (err) {
        return fail(err, 'The run could not be updated.')
      }
    },
  }
}

/** `POST /api/runs/:id/answer` `{ answer }`: stores the answer, clears the question, resumes. */
export const answerEndpoint = (o: ReviewEndpointOptions): Endpoint =>
  runEndpoint(o, {
    path: 'answer',
    from: ['waiting'],
    data: (body) => {
      const parsed = answerBody.safeParse(body)
      return parsed.success ? { answer: parsed.data.answer, question: null, status: 'running' } : { error: parsed.error.issues[0]?.message ?? 'Invalid body.' }
    },
    denied: 'This run is not waiting for an answer.',
  })

/** `POST /api/runs/:id/cancel`: a queued, running or waiting run becomes `cancelled`. */
export const cancelEndpoint = (o: ReviewEndpointOptions): Endpoint =>
  runEndpoint(o, {
    path: 'cancel',
    from: ACTIVE_RUN_STATUSES,
    data: () => ({ status: 'cancelled', question: null, now: 'Cancelled by an editor' }),
    denied: 'This run has already finished.',
  })

/** `POST /api/runs/:id/retry`: a failed or cancelled run goes back to `queued`; attempts are kept. */
export const retryEndpoint = (o: ReviewEndpointOptions): Endpoint =>
  runEndpoint(o, {
    path: 'retry',
    from: ['failed', 'cancelled'],
    data: () => ({ status: 'queued', error: null, question: null, leaseUntil: null, now: 'Waiting for a worker' }),
    denied: 'Only a failed or cancelled run can be retried.',
  })
