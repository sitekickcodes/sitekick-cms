import { describe, expect, test } from 'bun:test'

import { destinationOf, isNoise, normalizePath, normalizeTarget, parseImport, pathFor, resolveChains } from '../redirects/model'
import { publicPrefixes } from '../redirects/hooks'

describe('normalizePath', () => {
  test('tidies what editors and old sites throw at it', () => {
    expect(normalizePath('/About-Us/')).toBe('/about-us')
    expect(normalizePath('about-us')).toBe('/about-us')
    expect(normalizePath('https://old.example.com/Team.html?ref=x#top')).toBe('/team.html')
    expect(normalizePath('/caf%C3%A9')).toBe('/café')
    expect(normalizePath('//blog//post/')).toBe('/blog/post')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('   ')).toBeNull()
  })
})

describe('normalizeTarget', () => {
  test('keeps the case and query of a target, refuses other schemes', () => {
    expect(normalizeTarget('/Contact/?a=1')).toBe('/Contact?a=1')
    expect(normalizeTarget('contact')).toBe('/contact')
    expect(normalizeTarget('https://example.com/x')).toBe('https://example.com/x')
    expect(normalizeTarget('javascript:alert(1)')).toBeNull()
    expect(normalizeTarget('//evil.com')).toBeNull()
  })
})

test('pathFor joins prefixes', () => {
  expect(pathFor('/', 'about')).toBe('/about')
  expect(pathFor('/news', 'hello')).toBe('/news/hello')
  expect(pathFor('/news/', 'hello')).toBe('/news/hello')
})

describe('resolveChains', () => {
  test('a visitor is sent once, to the end of the chain', () => {
    const out = resolveChains([
      { from: '/a', to: '/b', permanent: true },
      { from: '/b', to: '/C', permanent: true },
    ])
    expect(out.find((r) => r.from === '/a')?.to).toBe('/C')
  })
  test('a temporary hop makes the trip temporary', () => {
    const out = resolveChains([
      { from: '/a', to: '/b', permanent: true },
      { from: '/b', to: '/c', permanent: false },
    ])
    expect(out.find((r) => r.from === '/a')?.permanent).toBe(false)
  })
  test('loops are dropped rather than served', () => {
    expect(
      resolveChains([
        { from: '/a', to: '/b', permanent: true },
        { from: '/b', to: '/a', permanent: true },
      ]),
    ).toEqual([])
  })
  test('external targets end the chain', () => {
    expect(resolveChains([{ from: '/a', to: 'https://x.com/b', permanent: true }])).toEqual([{ from: '/a', to: 'https://x.com/b', permanent: true }])
  })
})

test('destinationOf keeps campaign queries unless the target has its own', () => {
  expect(destinationOf({ from: '/a', to: '/b', permanent: true }, '?utm_source=x')).toBe('/b?utm_source=x')
  expect(destinationOf({ from: '/a', to: '/b#top', permanent: true }, '?x=1')).toBe('/b?x=1#top')
  expect(destinationOf({ from: '/a', to: '/b?y=2', permanent: true }, '?x=1')).toBe('/b?y=2')
  expect(destinationOf({ from: '/a', to: '/b', permanent: true }, '')).toBe('/b')
})

test('isNoise skips bots and files, keeps old pages', () => {
  for (const p of ['/wp-login.php', '/.env', '/xmlrpc.php', '/logo.png', '/.git/config', '/config.json']) expect(isNoise(p)).toBe(true)
  for (const p of ['/about-us', '/team.html', '/contact.php', '/blog/2019/hello', '/.well-known/x']) expect(isNoise(p)).toBe(false)
})

describe('parseImport', () => {
  test('reads commas, tabs, quotes, a header and a temporary flag', () => {
    const { rows, errors } = parseImport('Old,New\n/about-us, /about\nhttps://old.com/team.html\t/people\n"/sale,2024", /shop, temporary\n')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { from: '/about-us', to: '/about', permanent: true, line: 2 },
      { from: '/team.html', to: '/people', permanent: true, line: 3 },
      { from: '/sale,2024', to: '/shop', permanent: false, line: 4 },
    ])
  })
  test('reports bad lines by number and keeps the last duplicate', () => {
    const { rows, errors } = parseImport('/a, /b\n/a, /c\n/x,\n/self, /self/\nnot a url, /x\n/y, contact')
    expect(rows).toEqual([{ from: '/a', to: '/c', permanent: true, line: 2 }])
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6])
  })
})

test('publicPrefixes picks collections with a slug and a public path', () => {
  const slug = { name: 'slug', type: 'text' } as const
  const prefixes = publicPrefixes([
    { slug: 'pages', fields: [slug], custom: { sitekick: { seo: { pathPrefix: '/' } } } },
    { slug: 'posts', fields: [{ type: 'row', fields: [slug] }], custom: { sitekick: { seo: { pathPrefix: '/news' } } } },
    { slug: 'people', fields: [slug] },
    { slug: 'media', fields: [], custom: { sitekick: { seo: { pathPrefix: '/media' } } } },
  ] as never)
  expect(prefixes).toEqual({ pages: '/', posts: '/news' })
})
