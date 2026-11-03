import { describe, expect, test } from 'bun:test'

import { archiveUrlFor, assertPublicUrl, excerptFor, fetchWithReceipt, htmlToText, isPrivateIP, sha256, syntheticReceipt, titleOf } from './receipts'

const publicLookup = async () => [{ address: '93.184.216.34' }]
const privateLookup = async () => [{ address: '10.1.2.3' }]

const html = (body: string, title = 'Example Org') =>
  `<!doctype html><html><head><title>${title}</title><script>var x = 1</script><style>p{}</style></head><body><nav><a href="/about">About</a></nav>${body}<footer><a href="https://twitter.com/example">Twitter</a></footer></body></html>`

const responder = (handlers: Record<string, () => Response>) => {
  const calls: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    const handler = Object.entries(handlers).find(([prefix]) => url.startsWith(prefix))?.[1]
    if (!handler) throw new TypeError('fetch failed')
    return handler()
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('guards', () => {
  test('private and loopback ranges are private', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.5', '192.168.1.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateIP(ip)).toBe(true)
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111', '172.32.0.1']) expect(isPrivateIP(ip)).toBe(false)
  })
  test('rejects non-http schemes, credentials, localhost, literal private IPs and names that resolve privately', async () => {
    const bad = ['ftp://example.org/x', 'file:///etc/passwd', 'https://user:pw@example.org/', 'http://localhost/', 'http://127.0.0.1/admin', 'http://[::1]/', 'http://10.0.0.5/', 'http://foo.internal/', 'http://box.local/']
    for (const url of bad) await expect(assertPublicUrl(new URL(url), publicLookup)).rejects.toThrow()
    await expect(assertPublicUrl(new URL('https://intranet.example.org/'), privateLookup)).rejects.toThrow('Private network')
    await expect(assertPublicUrl(new URL('https://example.org/'), publicLookup)).resolves.toBeUndefined()
  })
  test('fetchWithReceipt never calls fetch for a refused URL, and does not try the archive', async () => {
    const { fetchImpl, calls } = responder({})
    await expect(fetchWithReceipt('http://127.0.0.1/secret', { fetchImpl, lookup: publicLookup })).rejects.toThrow('Private network')
    expect(calls).toEqual([])
  })
  test('a redirect to a private host is refused', async () => {
    const { fetchImpl } = responder({
      'https://example.org/': () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }),
    })
    await expect(fetchWithReceipt('https://example.org/', { fetchImpl, lookup: publicLookup, archive: false })).rejects.toThrow('Private network')
  })
  test('size cap', async () => {
    const { fetchImpl } = responder({ 'https://example.org/': () => new Response('x'.repeat(5000), { status: 200, headers: { 'content-type': 'text/plain' } }) })
    await expect(fetchWithReceipt('https://example.org/', { fetchImpl, lookup: publicLookup, archive: false, maxBytes: 1000 })).rejects.toThrow('larger than')
  })
})

describe('receipt', () => {
  test('sha256 is stable and text/title are extracted', async () => {
    const page = html('<p>Jane Doe is the <b>director</b> of Example Org.</p><img src="/jane.jpg" alt="Jane">')
    const { fetchImpl } = responder({ 'https://example.org/': () => new Response(page, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }) })
    const a = await fetchWithReceipt('https://example.org/', { fetchImpl, lookup: publicLookup })
    const b = await fetchWithReceipt('https://example.org/', { fetchImpl, lookup: publicLookup })
    expect(a.receipt.sha256).toBe(b.receipt.sha256)
    expect(a.receipt.sha256).toBe(sha256(page))
    expect(a.receipt.url).toBe('https://example.org/')
    expect(a.receipt.title).toBe('Example Org')
    expect(a.text).toContain('Jane Doe is the director of Example Org.')
    expect(a.text).not.toContain('var x')
    expect(a.text).not.toContain('About')
    expect(a.text).toContain('Twitter [https://twitter.com/example]')
    expect(a.text).toContain('[image: Jane https://example.org/jane.jpg]')
    expect(a.status).toBe(200)
    expect(a.archived).toBeUndefined()
  })
  test('falls back to the Internet Archive on 404 and names the snapshot in the receipt', async () => {
    const { fetchImpl, calls } = responder({
      'https://example.org/gone': () => new Response('nope', { status: 404 }),
      'https://web.archive.org/web/2/https://example.org/gone': () => new Response(null, { status: 302, headers: { location: 'https://web.archive.org/web/20240101000000/https://example.org/gone' } }),
      'https://web.archive.org/web/20240101000000/': () => new Response(html('<p>Old campaign page</p>'), { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    const r = await fetchWithReceipt('https://example.org/gone', { fetchImpl, lookup: publicLookup })
    expect(calls[1]).toBe(archiveUrlFor('https://example.org/gone'))
    expect(r.archived?.liveError).toBe('HTTP 404')
    expect(r.receipt.url).toBe('https://web.archive.org/web/20240101000000/https://example.org/gone')
    expect(r.text).toContain('Old campaign page')
  })
  test('reports both failures when the archive has nothing', async () => {
    const { fetchImpl } = responder({ 'https://example.org/': () => new Response('', { status: 500 }), 'https://web.archive.org/': () => new Response('', { status: 404 }) })
    await expect(fetchWithReceipt('https://example.org/', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/HTTP 500; archive returned HTTP 404/)
  })
})

describe('text helpers', () => {
  test('excerptFor finds a quote ignoring case, whitespace and curly quotes, and keeps the source casing', () => {
    const text = 'Welcome.\n\nJane Doe  is the  director of Example Org’s programme. She joined in 2019.'
    expect(excerptFor(text, "jane doe is the director of example org's programme")).toContain("Jane Doe is the director of Example Org's programme")
    expect(excerptFor(text, 'Jane is a plumber')).toBeNull()
    expect(excerptFor('a'.repeat(1000) + ' needle ' + 'b'.repeat(1000), 'needle', 10)).toBe('…aaaaaaaaa needle bbbbbbbbb…')
  })
  test('htmlToText decodes entities and collapses whitespace; titleOf prefers og:title', () => {
    expect(htmlToText('<p>Fish &amp; Chips&nbsp;&#8212; &quot;yes&quot;</p>\n\n\n<p>Next</p>')).toBe('Fish & Chips — "yes"\n\nNext')
    expect(titleOf('<head><meta property="og:title" content="OG Title"><title>Plain</title></head>')).toBe('OG Title')
  })
  test('synthetic receipts carry the text hash and a notes: url', () => {
    const r = syntheticReceipt('notes', 'Meeting at 10, launch moved to May.')
    expect(r.url).toBe('notes:')
    expect(r.sha256).toBe(sha256('Meeting at 10, launch moved to May.'))
  })
})
