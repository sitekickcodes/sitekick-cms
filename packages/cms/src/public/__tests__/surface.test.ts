import { describe, expect, test } from 'bun:test'

import { createPublicSurface } from '../index'
import { fakePayload, sampleDocs, sampleGlobals } from './fakePayload'

const site = { name: 'Demo Co.', url: 'https://demo.test/', description: 'A demo site.' }
const surface = (limit = 100) => {
  const { payload } = fakePayload(sampleDocs, sampleGlobals)
  return createPublicSurface({ payload: async () => payload, site, rateLimit: { limit, windowSeconds: 60 } })
}
/** The legacy (2025) transport frames JSON-RPC results as SSE; modern clients get plain JSON. */
const rpcResult = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    const data = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())
    return JSON.parse(data.at(-1) ?? 'null')
  }
  return JSON.parse(text)
}
const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://demo.test${path}`, { headers })

describe('llms.txt and openapi.json', () => {
  test('llms.txt names the site and every tool, with MCP and OpenAPI links', async () => {
    const s = surface()
    const res = await s.llmsTxt(get('/llms.txt'))
    const text = await res.text()
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text.startsWith('# Demo Co.')).toBe(true)
    for (const tool of (await s.catalog()).tools) expect(text).toContain(`\`${tool.name}\``)
    expect(text).toContain('https://demo.test/mcp')
    expect(text).toContain('https://demo.test/openapi.json')
    expect(text).toContain('https://demo.test/md/posts/<slug>')
  })
  test('openapi.json is 3.1 with one GET path per tool and no security', async () => {
    const s = surface()
    const doc = (await (await s.openapi(get('/openapi.json'))).json()) as { openapi: string; security: unknown[]; servers: { url: string }[]; paths: Record<string, { get: { operationId: string; parameters: { name: string }[]; responses: Record<string, unknown> } }> }
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.security).toEqual([])
    expect(doc.servers).toEqual([{ url: 'https://demo.test' }])
    const tools = (await s.catalog()).tools
    expect(Object.keys(doc.paths).sort()).toEqual(tools.map((t) => `/api/public/v1/${t.name}`).sort())
    const list = doc.paths['/api/public/v1/list_posts']!.get
    expect(list.operationId).toBe('listPosts')
    expect(list.parameters.map((p) => p.name)).toEqual(['q', 'limit', 'page'])
    expect(Object.keys(list.responses)).toEqual(['200', '400', '404', '429', '503'])
  })
  test('server card points at the MCP remote', async () => {
    const card = (await (await surface().serverCard(get('/.well-known/mcp/server-card.json'))).json()) as { name: string; remotes: { url: string }[] }
    expect(card.name).toBe('test.demo/demo')
    expect(card.remotes[0]?.url).toBe('https://demo.test/mcp')
  })
})

describe('rest', () => {
  test('serves a tool from query params with coercion, problem+json on bad input, 404 on miss', async () => {
    const s = surface()
    const ok = await s.rest(get('/api/public/v1/list_posts?limit=1&page=2'), 'list_posts')
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe('*')
    expect(ok.headers.get('ratelimit')).toContain('"public";r=99')
    expect(await ok.json()).toMatchObject({ total: 2, page: 2, limit: 1, items: [{ slug: 'parking' }] })
    const bad = await s.rest(get('/api/public/v1/list_posts?limit=999'), 'list_posts')
    expect(bad.status).toBe(400)
    expect(bad.headers.get('content-type')).toContain('application/problem+json')
    expect((await s.rest(get('/api/public/v1/get_posts?slug=draft-only'), 'get_posts')).status).toBe(404)
    expect((await s.rest(get('/api/public/v1/nope'), 'nope')).status).toBe(404)
  })
  test('is read-only and rate limited per client', async () => {
    const s = surface(3)
    expect((await s.rest(new Request('https://demo.test/api/public/v1/search', { method: 'POST' }), 'search')).status).toBe(405)
    const ip = { 'x-real-ip': '10.0.0.1' }
    for (let i = 0; i < 3; i++) expect((await s.rest(get('/api/public/v1/list_people', ip), 'list_people')).status).toBe(200)
    const limited = await s.rest(get('/api/public/v1/list_people', ip), 'list_people')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/)
    expect((await s.rest(get('/api/public/v1/list_people', { 'x-real-ip': '10.0.0.2' }), 'list_people')).status).toBe(200)
  })
})

describe('mcp', () => {
  const rpc = (s: ReturnType<typeof surface>, body: unknown, headers: Record<string, string> = {}) =>
    s.mcp(
      new Request('https://demo.test/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify(body),
      }),
    )
  test('lists read-only tools and calls one', async () => {
    const s = surface()
    const list = await rpc(s, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(list.status).toBe(200)
    const listed = (await rpcResult(list)) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } }
    expect(listed.result.tools.map((t) => t.name)).toContain('get_posts')
    expect(listed.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true)
    const call = await rpc(s, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_posts', arguments: { slug: 'hello-world' } } })
    const called = (await rpcResult(call)) as { result: { structuredContent: { title: string }; isError?: boolean } }
    expect(called.result.structuredContent.title).toBe('Hello world')
    expect(call.headers.get('ratelimit-policy')).toBe('"public";q=100;w=60')
  })
  test('refuses cross-origin browsers', async () => {
    expect((await rpc(surface(), {}, { origin: 'https://evil.test' })).status).toBe(403)
  })
})

describe('markdown', () => {
  test('renders a published entry and 404s otherwise', async () => {
    const s = surface()
    const ok = await s.markdown(get('/md/posts/hello-world'), ['posts', 'hello-world'])
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toContain('text/markdown')
    const text = await ok.text()
    expect(text).toContain('# Hello world')
    expect(text).toContain('> First post.')
    expect(text).toContain('- Source: https://demo.test/news/hello-world')
    expect((await s.markdown(get('/md/posts/draft-only'), 'posts/draft-only')).status).toBe(404)
    expect((await s.markdown(get('/md/inbox/x'), 'inbox/x')).status).toBe(404)
  })
})
