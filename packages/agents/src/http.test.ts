import { describe, expect, test } from 'bun:test'

import { createAgentRoutes } from './http'
import type { Runner } from './runner'
import { stubPayload } from './testing/stub-payload'

const post = (path: string, body: unknown) => new Request(`http://localhost/api/agents/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const people = { slug: 'people', fields: [{ name: 'name', type: 'text' }, { name: 'bio', type: 'textarea' }], custom: { sitekick: { agent: { writable: ['bio'], review: 'required' } } } }

describe('createAgentRoutes', () => {
  test('requires a signed-in user', async () => {
    const routes = createAgentRoutes({ payload: stubPayload({ user: null }) })
    expect((await routes.enqueue(post('enqueue', { agent: 'enrich', input: { targetCollection: 'people', targetId: 1 } }))).status).toBe(401)
    expect((await routes.action(post('action', { action: 'rewrite', input: { text: 'x', instruction: 'y' } }))).status).toBe(401)
    expect((await routes.status(new Request('http://localhost/api/agents/status?run=1'))).status).toBe(401)
  })
  test('validates the body', async () => {
    const routes = createAgentRoutes({ payload: stubPayload() })
    const res = await routes.enqueue(post('enqueue', { agent: 'nope', input: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid body' })
    expect((await routes.handle(post('x', {}), 'x')).status).toBe(404)
  })
  test('enqueue creates the run, answers 202 and hands the work to background', async () => {
    const payload = stubPayload({ collections: [people] })
    const jane = await payload.create({ collection: 'people', data: { name: 'Jane' } })
    const work: Promise<unknown>[] = []
    const runner: Runner = { name: 'noop', run: async () => ({ text: '', costUsd: null, steps: 0, finishReason: 'stop', finished: true, model: 'stub' }) }
    const routes = createAgentRoutes({ payload, runner, background: (p) => void work.push(p) })
    const res = await routes.handle(post('enqueue', { agent: 'enrich', input: { targetCollection: 'people', targetId: jane.id } }), 'enqueue')
    expect(res.status).toBe(202)
    const { runId } = (await res.json()) as { runId: string }
    expect(work).toHaveLength(1)
    await work[0]
    const status = await routes.status(new Request(`http://localhost/api/agents/status?run=${runId}`))
    expect(await status.json()).toMatchObject({ id: runId, status: 'done', kind: 'enrich@1' })
    const run = (await payload.findByID({ collection: 'runs', id: runId }))!
    expect(run.triggeredBy).toBe('u1')
  })
  test('kill switch answers 503', async () => {
    process.env.SITEKICK_AGENTS_DISABLED = 'true'
    try {
      const routes = createAgentRoutes({ payload: stubPayload() })
      expect((await routes.enqueue(post('enqueue', { agent: 'draft', input: { targetCollection: 'posts', notes: 'x' } }))).status).toBe(503)
    } finally {
      delete process.env.SITEKICK_AGENTS_DISABLED
    }
  })
  test('actions run inline with an injected model and log an accepted proposal', async () => {
    const payload = stubPayload()
    const routes = createAgentRoutes({ payload })
    const { rewrite } = await import('./actions')
    const result = await rewrite({ payload, text: 'hello there', instruction: 'make formal', target: { collection: 'posts', id: 3, field: 'excerpt' }, generate: async () => ({ text: 'Good day.', providerMetadata: { gateway: { cost: '0.001' } } }) })
    expect(result).toMatchObject({ value: 'Good day.', costUsd: 0.001 })
    const logged = (await payload.findByID({ collection: 'proposals', id: result.proposalId! }))!
    expect(logged).toMatchObject({ kind: 'field-action', status: 'accepted', agent: 'field-action', targetCollection: 'posts', targetId: '3', decisions: { excerpt: 'accepted' } })
    expect((await routes.action(post('action', { action: 'seo', input: { collection: 'posts', id: 'missing' } }))).status).toBe(500)
  })
})
