import type { Payload } from 'payload'
import { z } from 'zod'

import { altText, rewrite, seo, shorten, translate } from './actions'
import { runDraft } from './agents/draft'
import { nameOf, runEnrich } from './agents/enrich'
import type { AgentPayload } from './payload'
import type { Runner } from './runner'
import { AgentsDisabledError, agentsDisabled, getRun, startRun } from './runs'

/**
 * Web-standard handlers for the admin's agent buttons. The playground mounts
 * them at `/api/agents/[op]` (see README). Auth is Payload's own user cookie:
 * `payload.auth({ headers })` must yield a user. `enqueue` creates the run and
 * kicks the runner in the background; on Vercel that is `waitUntil` from
 * @vercel/functions when it is installed, else fire-and-forget. Either way the
 * durable path is the workflow adapter; this is the zero-infrastructure one.
 */
const enqueueBody = z.discriminatedUnion('agent', [
  z.object({ agent: z.literal('enrich'), input: z.object({ targetCollection: z.string().min(1), targetId: z.union([z.string(), z.number()]) }) }),
  z.object({
    agent: z.literal('draft'),
    input: z.object({
      targetCollection: z.string().min(1),
      notes: z.string().max(20_000).optional(),
      url: z.url().optional(),
      transcript: z.string().max(200_000).optional(),
      title: z.string().max(200).optional(),
    }),
  }),
])
export type EnqueueBody = z.infer<typeof enqueueBody>

const target = z.object({ collection: z.string().min(1), id: z.union([z.string(), z.number()]).optional(), field: z.string().min(1) }).optional()
const actionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('altText'), input: z.object({ mediaId: z.union([z.string(), z.number()]), collection: z.string().optional() }) }),
  z.object({ action: z.literal('seo'), input: z.object({ collection: z.string().min(1), id: z.union([z.string(), z.number()]) }) }),
  z.object({ action: z.literal('rewrite'), input: z.object({ text: z.string().min(1).max(20_000), instruction: z.string().min(1).max(500), target }) }),
  z.object({ action: z.literal('shorten'), input: z.object({ text: z.string().min(1).max(20_000), maxChars: z.number().int().positive().optional(), target }) }),
  z.object({ action: z.literal('translate'), input: z.object({ text: z.string().min(1).max(20_000), to: z.string().min(2).max(40), target }) }),
])
export type ActionBody = z.infer<typeof actionBody>

export type AgentRoutes = {
  enqueue(req: Request): Promise<Response>
  action(req: Request): Promise<Response>
  status(req: Request): Promise<Response>
  /** Dispatch by the `[op]` segment: enqueue | action | status. */
  handle(req: Request, op: string): Promise<Response>
}

export type AgentRoutesOptions = {
  payload: Payload | AgentPayload
  runner?: Runner
  /** Keep a promise alive after the response. Default: @vercel/functions' waitUntil when present, else fire-and-forget. */
  background?: (work: Promise<unknown>) => void
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function defaultBackground(): Promise<(work: Promise<unknown>) => void> {
  try {
    // A variable specifier keeps the optional peer out of the type graph and the bundle.
    const specifier = '@vercel/functions'
    const mod = (await import(specifier)) as { waitUntil?: (p: Promise<unknown>) => void }
    if (typeof mod.waitUntil === 'function') return mod.waitUntil
  } catch {
    /* not installed: fall through */
  }
  return (work) => {
    void work.catch(() => {})
  }
}

export function createAgentRoutes(options: AgentRoutesOptions): AgentRoutes {
  // The real client is generic over generated types; the kit uses string slugs.
  const payload = options.payload as AgentPayload
  const background = options.background ? Promise.resolve(options.background) : defaultBackground()

  const authed = async (req: Request) => {
    const { user } = await payload.auth({ headers: req.headers })
    return user ?? null
  }
  const parse = async <T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> => {
    const raw: unknown = await req.json().catch(() => null)
    const parsed = schema.safeParse(raw)
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, res: json({ error: 'Invalid body', issues: parsed.error.issues }, 400) }
  }
  const failure = (err: unknown) => {
    if (err instanceof AgentsDisabledError) return json({ error: err.message }, 503)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }

  const enqueue: AgentRoutes['enqueue'] = async (req) => {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const user = await authed(req)
    if (!user) return json({ error: 'Sign in required' }, 401)
    if (agentsDisabled()) return json({ error: 'Agents are disabled' }, 503)
    const body = await parse(req, enqueueBody)
    if (!body.ok) return body.res
    try {
      const { agent, input } = body.data
      // Titles are what the editor sees in the run list and the inbox.
      const title =
        agent === 'enrich'
          ? `Find details: ${nameOf(await payload.findByID({ collection: input.targetCollection, id: input.targetId, depth: 0, overrideAccess: true, disableErrors: true }))}`
          : `Draft: ${input.title ?? (input.url ? new URL(input.url).hostname : 'from notes')}`
      const run = await startRun(payload, {
        kind: `${agent}@1`,
        title,
        targetCollection: input.targetCollection,
        ...(agent === 'enrich' ? { targetId: input.targetId } : {}),
        input,
        triggeredBy: user.id,
      })
      const common = { runId: run.id, runner: options.runner, triggeredBy: user.id }
      const work = agent === 'enrich' ? runEnrich(payload, input, common) : runDraft(payload, input, common)
      ;(await background)(work.catch(() => {}))
      return json({ runId: run.id }, 202)
    } catch (err) {
      return failure(err)
    }
  }

  const action: AgentRoutes['action'] = async (req) => {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const user = await authed(req)
    if (!user) return json({ error: 'Sign in required' }, 401)
    if (agentsDisabled()) return json({ error: 'Agents are disabled' }, 503)
    const body = await parse(req, actionBody)
    if (!body.ok) return body.res
    try {
      const b = body.data
      const result =
        b.action === 'altText'
          ? await altText({ payload, ...b.input, origin: new URL(req.url).origin })
          : b.action === 'seo'
            ? await seo({ payload, ...b.input })
            : b.action === 'rewrite'
              ? await rewrite({ payload, ...b.input })
              : b.action === 'shorten'
                ? await shorten({ payload, ...b.input })
                : await translate({ payload, ...b.input })
      return json(result)
    } catch (err) {
      return failure(err)
    }
  }

  const status: AgentRoutes['status'] = async (req) => {
    const user = await authed(req)
    if (!user) return json({ error: 'Sign in required' }, 401)
    const id = new URL(req.url).searchParams.get('run')
    if (!id) return json({ error: 'run query parameter required' }, 400)
    const run = await getRun(payload, id)
    if (!run) return json({ error: 'Not found' }, 404)
    const { id: runId, title, kind, status: runStatus, stage, now, steps, question, costUsd, proposal, error, updatedAt } = run
    return json({ id: runId, title, kind, status: runStatus, stage, now, steps, question, costUsd, proposal, error, updatedAt })
  }

  return {
    enqueue,
    action,
    status,
    handle: (req, op) => (op === 'enqueue' ? enqueue(req) : op === 'action' ? action(req) : op === 'status' ? status(req) : Promise.resolve(json({ error: 'Unknown op' }, 404))),
  }
}
