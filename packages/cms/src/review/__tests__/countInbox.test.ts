import { describe, expect, test } from 'bun:test'
import type { Payload, PayloadRequest } from 'payload'

import { countInbox, reviewPlugin } from '../index'

type CountArgs = { collection: string; where: Record<string, unknown>; user: unknown; overrideAccess: boolean }

function stubPayload(counts: Record<string, number>, options: { missing?: string[]; throwFor?: string[] } = {}) {
  const calls: CountArgs[] = []
  const collections = Object.fromEntries(
    ['proposals', 'runs', 'jobs'].filter((s) => !options.missing?.includes(s)).map((s) => [s, { config: { slug: s } }]),
  )
  const payload = {
    collections,
    count: async (args: CountArgs) => {
      calls.push(args)
      if (options.throwFor?.includes(args.collection)) throw new Error('db down')
      return { totalDocs: counts[args.collection] ?? 0 }
    },
  } as unknown as Payload
  return { payload, calls }
}

const user = { id: 'u1', collection: 'users' } as unknown as NonNullable<PayloadRequest['user']>

describe('countInbox', () => {
  test('counts open proposals and waiting runs with the user, access on', async () => {
    const { payload, calls } = stubPayload({ proposals: 4, runs: 2 })
    expect(await countInbox(payload, user)).toEqual({ proposals: 4, runs: 2 })
    expect(calls).toHaveLength(2)
    const proposals = calls.find((c) => c.collection === 'proposals')
    expect(proposals?.where).toEqual({ status: { equals: 'open' } })
    expect(proposals?.user).toBe(user)
    expect(proposals?.overrideAccess).toBe(false)
    expect(calls.find((c) => c.collection === 'runs')?.where).toEqual({ status: { equals: 'waiting' } })
  })
  test('zeros without a user, without a query', async () => {
    const { payload, calls } = stubPayload({ proposals: 4, runs: 2 })
    expect(await countInbox(payload, null)).toEqual({ proposals: 0, runs: 0 })
    expect(await countInbox(payload, undefined)).toEqual({ proposals: 0, runs: 0 })
    expect(calls).toHaveLength(0)
  })
  test('a collection that is not installed, or a failing count, reads as zero', async () => {
    const missing = stubPayload({ proposals: 4, runs: 2 }, { missing: ['runs'] })
    expect(await countInbox(missing.payload, user)).toEqual({ proposals: 4, runs: 0 })
    expect(missing.calls.map((c) => c.collection)).toEqual(['proposals'])
    const failing = stubPayload({ proposals: 4, runs: 2 }, { throwFor: ['proposals'] })
    expect(await countInbox(failing.payload, user)).toEqual({ proposals: 0, runs: 2 })
  })
  test('honours custom slugs', async () => {
    const { payload, calls } = stubPayload({ jobs: 7, proposals: 1 })
    expect(await countInbox(payload, user, { runsSlug: 'jobs' })).toEqual({ proposals: 1, runs: 7 })
    expect(calls.map((c) => c.collection).sort()).toEqual(['jobs', 'proposals'])
  })
})

describe('reviewPlugin', () => {
  test('adds both collections once and the inbox view', () => {
    const plugin = reviewPlugin({ site: { name: 'Demo' } })
    const once = plugin({ collections: [], admin: {} } as never) as { collections: { slug: string; admin?: { group?: string } }[]; admin: { components: { views: Record<string, { path?: string }> } } }
    expect(once.collections.map((c) => c.slug)).toEqual(['proposals', 'runs'])
    expect(once.collections.every((c) => c.admin?.group === 'Inbox')).toBe(true)
    expect(once.admin.components.views.inbox?.path).toBe('/inbox')
    const twice = plugin(once as never) as typeof once
    expect(twice.collections.map((c) => c.slug)).toEqual(['proposals', 'runs'])
  })
  test('the json fields the review UI owns are hidden from the form', () => {
    const config = reviewPlugin({ site: { name: 'Demo' } })({ collections: [] } as never) as { collections: { slug: string; fields: { name?: string; type: string; admin?: { hidden?: boolean } }[] }[] }
    const hidden = config.collections.flatMap((c) => c.fields.filter((f) => f.type === 'json').map((f) => `${c.slug}.${f.name}:${f.admin?.hidden === true}`))
    expect(hidden.sort()).toEqual(['proposals.decisions:true', 'proposals.patch:true', 'runs.input:true', 'runs.question:true', 'runs.steps:true'])
  })
})
