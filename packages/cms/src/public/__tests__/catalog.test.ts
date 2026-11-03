import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { sampleConfig } from '../../agent/__tests__/fixture'
import { definePublicTool, derivePublicCatalog, isPublicRead, type PublicToolContext } from '../catalog'
import { fakePayload, sampleDocs, sampleGlobals } from './fakePayload'

const site = { name: 'Demo Co.', url: 'https://demo.test' }

describe('derivePublicCatalog', () => {
  test('public slugged collections get list/get, search spans them, public globals get a getter, private and auth are out', async () => {
    const { tools } = await derivePublicCatalog(sampleConfig())
    expect(tools.map((t) => t.name)).toEqual(['list_posts', 'get_posts', 'list_people', 'get_people', 'search', 'get_site-settings'])
    expect(tools.find((t) => t.name === 'list_posts')?.operationId).toBe('listPosts')
  })
  test('isPublicRead: omitted access is not public; where results are', async () => {
    expect(await isPublicRead({ slug: 'x', fields: [] })).toBe(false)
    expect(await isPublicRead({ slug: 'x', fields: [], access: { read: () => ({ a: { equals: 1 } }) } })).toBe(true)
    expect(await isPublicRead({ slug: 'x', fields: [], access: { read: ({ req }) => Boolean(req.user) } })).toBe(false)
  })
  test('appends custom tools and refuses duplicate names', async () => {
    const extra = definePublicTool({
      name: 'hours',
      summary: 'Opening hours',
      description: 'When the shop is open.',
      input: z.object({}),
      output: z.object({ open: z.string() }),
      handler: async () => ({ open: '9-5' }),
    })
    const { tools } = await derivePublicCatalog(sampleConfig(), { tools: [extra] })
    expect(tools.at(-1)?.name).toBe('hours')
    await expect(derivePublicCatalog(sampleConfig(), { tools: [{ ...extra, name: 'search' }] })).rejects.toThrow(/duplicate/)
  })
})

describe('derived tool handlers', () => {
  const run = async (name: string, input: Record<string, unknown>) => {
    const { payload, calls } = fakePayload(sampleDocs, sampleGlobals)
    const { tools } = await derivePublicCatalog(sampleConfig())
    const tool = tools.find((t) => t.name === name)!
    const ctx: PublicToolContext = { payload, site }
    const raw = await tool.handler(input, ctx)
    return { raw, out: raw === null ? null : tool.output.parse(raw), calls }
  }
  test('list_posts returns only published entries in the fixed shape with site URLs', async () => {
    const { out, calls } = await run('list_posts', {})
    expect(out).toEqual({
      total: 2, page: 1, limit: 20,
      items: [
        { id: 1, title: 'Hello world', slug: 'hello-world', url: 'https://demo.test/news/hello-world', excerpt: 'First post.', updatedAt: '2026-01-02T00:00:00.000Z' },
        { id: 3, title: 'Parking reform', slug: 'parking', url: 'https://demo.test/news/parking', excerpt: 'From SEO.', updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    expect(calls[0]).toMatchObject({ collection: 'posts', draft: false, overrideAccess: false, depth: 0, where: { _status: { equals: 'published' } } })
  })
  test('get_people uses useAsTitle and the /<slug> prefix; unknown slug is null', async () => {
    const { out } = await run('get_people', { slug: 'sam' })
    expect(out).toMatchObject({ title: 'Sam', url: 'https://demo.test/people/sam', excerpt: '' })
    expect((await run('get_people', { slug: 'nobody' })).raw).toBeNull()
  })
  test('search filters by q across collections and by type', async () => {
    const { out } = await run('search', { q: 'parking' })
    expect(out).toMatchObject({ query: 'parking', total: 1, results: [{ slug: 'parking', type: 'posts' }] })
    const typed = await run('search', { q: 'sa', type: 'people', limit: 5 })
    expect((typed.out as { results: unknown[] }).results).toHaveLength(1)
  })
  test('get_site-settings projects scalars only', async () => {
    const { out } = await run('get_site-settings', {})
    expect(out).toEqual({ slug: 'site-settings', label: 'Site settings', updatedAt: '2026-01-01T00:00:00.000Z', data: { tagline: 'Hi', phone: '555' } })
  })
  test('rejects unknown input keys', async () => {
    await expect(run('list_posts', { nope: 1 })).rejects.toThrow()
  })
})
