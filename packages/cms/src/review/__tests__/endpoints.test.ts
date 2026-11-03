import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'

import { answerEndpoint, cancelEndpoint, decideEndpoint, retryEndpoint } from '../endpoints'
import { answerBody, decideBody } from '../shared'

const slugs = { proposalsSlug: 'proposals', runsSlug: 'runs', usersSlug: 'users' }

describe('decideBody', () => {
  test('accepts a map of accepted/rejected', () => {
    expect(decideBody.safeParse({ decisions: { bio: 'accepted', 'seo.title': 'rejected' } }).success).toBe(true)
  })
  test('rejects empty, unknown values and missing keys', () => {
    expect(decideBody.safeParse({ decisions: {} }).success).toBe(false)
    expect(decideBody.safeParse({ decisions: { bio: 'maybe' } }).success).toBe(false)
    expect(decideBody.safeParse({ decisions: { '': 'accepted' } }).success).toBe(false)
    expect(decideBody.safeParse({}).success).toBe(false)
    expect(decideBody.safeParse(null).success).toBe(false)
  })
})

describe('answerBody', () => {
  test('trims and requires text', () => {
    expect(answerBody.parse({ answer: '  Yes  ' })).toEqual({ answer: 'Yes' })
    expect(answerBody.safeParse({ answer: '   ' }).success).toBe(false)
    expect(answerBody.safeParse({ answer: 'x'.repeat(2001) }).success).toBe(false)
    expect(answerBody.safeParse({}).success).toBe(false)
  })
})

/** A request with a users-collection account, route params and a JSON body, plus a recording payload stub. */
function stub(options: {
  id?: string
  body?: unknown
  user?: unknown
  docs?: Record<string, Record<string, unknown>>
  collections?: Record<string, { drafts?: boolean }>
}) {
  const calls: { op: string; args: Record<string, unknown> }[] = []
  const docs = options.docs ?? {}
  const payload = {
    collections: Object.fromEntries(
      Object.entries(options.collections ?? { proposals: {}, runs: {}, people: { drafts: true } }).map(([slug, c]) => [
        slug,
        { config: { slug, versions: c.drafts ? { drafts: true } : undefined } },
      ]),
    ),
    findByID: async (args: { collection: string; id: string | number }) => {
      calls.push({ op: 'findByID', args })
      const doc = docs[`${args.collection}:${args.id}`]
      if (!doc) throw Object.assign(new Error('Not Found'), { status: 404 })
      return doc
    },
    update: async (args: { collection: string; id: string | number; data: Record<string, unknown> }) => {
      calls.push({ op: 'update', args })
      const key = `${args.collection}:${args.id}`
      docs[key] = { ...(docs[key] ?? {}), ...args.data }
      return docs[key]
    },
    create: async (args: { collection: string; data: Record<string, unknown> }) => {
      calls.push({ op: 'create', args })
      return { id: 'new-1', ...args.data }
    },
  }
  const req = {
    user: options.user === undefined ? { id: 'u1', collection: 'users' } : options.user,
    routeParams: { id: options.id ?? 'p1' },
    json: async () => options.body,
    payload,
  } as unknown as PayloadRequest
  return { req, calls, docs }
}

const proposal = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  status: 'open',
  targetCollection: 'people',
  targetId: 'person-1',
  patch: { bio: { value: 'New bio' }, 'seo.title': { value: 'New title' } },
  decisions: {},
  ...over,
})

describe('POST /proposals/:id/decide', () => {
  test('401 without a users-collection account', async () => {
    const { req } = stub({ user: { id: 'k', collection: 'api-keys' }, body: { decisions: { bio: 'accepted' } } })
    const res = await decideEndpoint(slugs).handler(req)
    expect(res.status).toBe(401)
  })
  test('400 on an invalid body', async () => {
    const { req } = stub({ body: { decisions: {} }, docs: { 'proposals:p1': proposal() } })
    const res = await decideEndpoint(slugs).handler(req)
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Send at least one decision.')
  })
  test('400 when a path is not in the patch', async () => {
    const { req } = stub({ body: { decisions: { nope: 'accepted' } }, docs: { 'proposals:p1': proposal() } })
    const res = await decideEndpoint(slugs).handler(req)
    expect(res.status).toBe(400)
  })
  test('409 once the proposal is final', async () => {
    const { req } = stub({ body: { decisions: { bio: 'accepted' } }, docs: { 'proposals:p1': proposal({ status: 'rejected' }) } })
    expect((await decideEndpoint(slugs).handler(req)).status).toBe(409)
  })
  test('writes accepted fields to the target as a draft, keeps siblings, records the decision', async () => {
    const { req, calls } = stub({
      body: { decisions: { 'seo.title': 'accepted', bio: 'rejected' } },
      docs: { 'proposals:p1': proposal(), 'people:person-1': { id: 'person-1', seo: { title: 'Old', description: 'Keep' }, bio: 'Old bio' } },
    })
    const res = await decideEndpoint(slugs).handler(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; decisions: Record<string, string>; targetId: string }
    expect(body.status).toBe('partial')
    expect(body.decisions).toEqual({ 'seo.title': 'accepted', bio: 'rejected' })
    expect(body.targetId).toBe('person-1')
    const target = calls.find((c) => c.op === 'update' && c.args.collection === 'people')
    expect(target?.args.data).toEqual({ seo: { title: 'New title', description: 'Keep' } })
    expect(target?.args.draft).toBe(true)
    expect(target?.args.overrideAccess).toBe(false)
    expect(target?.args.context).toEqual({ sitekickAgent: 'review' })
    const stored = calls.find((c) => c.op === 'update' && c.args.collection === 'proposals')
    const data = stored?.args.data as Record<string, unknown>
    expect(data.status).toBe('partial')
    expect(data.reviewedBy).toBe('u1')
    expect(typeof data.reviewedAt).toBe('string')
  })
  test('one decision at a time stays open, then closes', async () => {
    const { req, docs } = stub({ body: { decisions: { bio: 'accepted' } }, docs: { 'proposals:p1': proposal(), 'people:person-1': { id: 'person-1' } } })
    const first = (await (await decideEndpoint(slugs).handler(req)).json()) as { status: string }
    expect(first.status).toBe('open')
    expect(docs['proposals:p1']?.decisions).toEqual({ bio: 'accepted' })
    const next = stub({ body: { decisions: { 'seo.title': 'accepted' } }, docs })
    const second = (await (await decideEndpoint(slugs).handler(next.req)).json()) as { status: string }
    expect(second.status).toBe('accepted')
    // The earlier acceptance is not written again.
    expect(next.calls.filter((c) => c.op === 'update' && c.args.collection === 'people').map((c) => c.args.data)).toEqual([{ seo: { title: 'New title' } }])
  })
  test('creates the target as a draft on the first acceptance when targetId is empty', async () => {
    const { req, calls } = stub({ body: { decisions: { bio: 'accepted' } }, docs: { 'proposals:p1': proposal({ targetId: '' }) } })
    const res = await decideEndpoint(slugs).handler(req)
    const body = (await res.json()) as { targetId: string }
    expect(body.targetId).toBe('new-1')
    const created = calls.find((c) => c.op === 'create')
    expect(created?.args).toMatchObject({ collection: 'people', draft: true, data: { bio: 'New bio' } })
    const stored = calls.find((c) => c.op === 'update' && c.args.collection === 'proposals')
    expect((stored?.args.data as Record<string, unknown>).targetId).toBe('new-1')
  })
  test('rejecting everything touches no target', async () => {
    const { req, calls } = stub({ body: { decisions: { bio: 'rejected', 'seo.title': 'rejected' } }, docs: { 'proposals:p1': proposal({ targetId: '' }) } })
    const body = (await (await decideEndpoint(slugs).handler(req)).json()) as { status: string; targetId: null }
    expect(body.status).toBe('rejected')
    expect(body.targetId).toBeNull()
    expect(calls.some((c) => c.op === 'create' || (c.op === 'update' && c.args.collection === 'people'))).toBe(false)
  })
  test('a forbidden target write becomes 403 and records nothing', async () => {
    const { req, calls } = stub({ body: { decisions: { bio: 'accepted' } }, docs: { 'proposals:p1': proposal(), 'people:person-1': { id: 'person-1' } } })
    const original = req.payload.update
    req.payload.update = (async () => {
      throw Object.assign(new Error('Forbidden'), { status: 403 })
    }) as typeof original
    const res = await decideEndpoint(slugs).handler(req)
    expect(res.status).toBe(403)
    expect(calls.some((c) => c.op === 'update' && c.args.collection === 'proposals')).toBe(false)
  })
  test('422 for an unknown target collection', async () => {
    const { req } = stub({ body: { decisions: { bio: 'accepted' } }, docs: { 'proposals:p1': proposal({ targetCollection: 'ghosts' }) } })
    expect((await decideEndpoint(slugs).handler(req)).status).toBe(422)
  })
})

describe('run endpoints', () => {
  const run = (status: string) => ({ 'runs:r1': { id: 'r1', status, question: { text: 'Which?', options: ['A'] } } })

  test('answer stores the answer, clears the question and resumes', async () => {
    const { req, calls } = stub({ id: 'r1', body: { answer: ' A ' }, docs: run('waiting') })
    const res = await answerEndpoint(slugs).handler(req)
    expect(res.status).toBe(200)
    const update = calls.find((c) => c.op === 'update')
    expect(update?.args.data).toEqual({ answer: 'A', question: null, status: 'running' })
    expect(update?.args.context).toEqual({ sitekickAgent: 'review' })
  })
  test('answer needs a waiting run and a body', async () => {
    expect((await answerEndpoint(slugs).handler(stub({ id: 'r1', body: { answer: 'A' }, docs: run('running') }).req)).status).toBe(409)
    expect((await answerEndpoint(slugs).handler(stub({ id: 'r1', body: {}, docs: run('waiting') }).req)).status).toBe(400)
  })
  test('cancel from any active status; not once finished', async () => {
    for (const s of ['queued', 'running', 'waiting']) {
      const { req, calls } = stub({ id: 'r1', docs: run(s) })
      expect((await cancelEndpoint(slugs).handler(req)).status).toBe(200)
      expect((calls.find((c) => c.op === 'update')?.args.data as Record<string, unknown>).status).toBe('cancelled')
    }
    expect((await cancelEndpoint(slugs).handler(stub({ id: 'r1', docs: run('done') }).req)).status).toBe(409)
  })
  test('retry re-queues failed or cancelled runs and leaves attempts alone', async () => {
    const { req, calls } = stub({ id: 'r1', docs: { 'runs:r1': { id: 'r1', status: 'failed', attempts: 3, error: 'boom' } } })
    expect((await retryEndpoint(slugs).handler(req)).status).toBe(200)
    const data = calls.find((c) => c.op === 'update')?.args.data as Record<string, unknown>
    expect(data.status).toBe('queued')
    expect(data.error).toBeNull()
    expect('attempts' in data).toBe(false)
    expect((await retryEndpoint(slugs).handler(stub({ id: 'r1', docs: run('running') }).req)).status).toBe(409)
  })
  test('401 without a users account, 404 for a missing run', async () => {
    expect((await cancelEndpoint(slugs).handler(stub({ id: 'r1', user: null, docs: run('running') }).req)).status).toBe(401)
    expect((await cancelEndpoint(slugs).handler(stub({ id: 'nope', docs: run('running') }).req)).status).toBe(404)
  })
})
