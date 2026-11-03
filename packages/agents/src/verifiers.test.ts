import { describe, expect, test } from 'bun:test'

import type { Receipt } from './receipts'
import { claimsSupported, excerptPresent, lengthWithin, runVerifiers, urlAlive } from './verifiers'

const receipt = (excerpt: string, url = 'https://example.org/'): Receipt => ({ url, fetchedAt: 'now', sha256: 'x', excerpt })

describe('deterministic verifiers', () => {
  test('excerptPresent', () => {
    const text = 'Jane Doe is the director of Example Org. She joined in 2019.'
    expect(excerptPresent(receipt('…jane doe is the director…'), text)).toEqual({ ok: true })
    expect(excerptPresent(receipt('Jane is a plumber'), text)).toMatchObject({ ok: false })
    expect(excerptPresent(receipt(''), text)).toMatchObject({ ok: false, reason: 'empty excerpt' })
  })
  test('lengthWithin', () => {
    expect(lengthWithin('abc', { max: 3 })).toEqual({ ok: true })
    expect(lengthWithin('abcd', { max: 3 })).toMatchObject({ ok: false })
    expect(lengthWithin('a', { min: 2, max: 3 })).toMatchObject({ ok: false })
    expect(lengthWithin(42, { max: 3 })).toMatchObject({ ok: false, reason: 'not a string' })
  })
  test('urlAlive uses HEAD, retries GET on 405, reports failures', async () => {
    const calls: string[] = []
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(init?.method))
      return new Response(null, { status: init?.method === 'HEAD' ? 405 : 200 })
    }) as typeof fetch
    expect(await urlAlive('https://example.org/', { fetchImpl })).toEqual({ ok: true })
    expect(calls).toEqual(['HEAD', 'GET'])
    const dead = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch
    expect(await urlAlive('https://example.org/', { fetchImpl: dead })).toMatchObject({ ok: false, reason: 'example.org returned HTTP 410' })
    const boom = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await urlAlive('https://example.org/', { fetchImpl: boom })).toMatchObject({ ok: false })
  })
})

describe('claimsSupported', () => {
  test('fails on any unsupported sentence, passes otherwise, reports the judge cost', async () => {
    const receipts = [receipt('Jane Doe is the director of Example Org.')]
    const judge = async ({ bio }: { bio: string }) => ({
      judgement: { claims: bio.split('. ').map((sentence) => ({ sentence, supported: sentence.includes('director'), receipt: 0 })) },
      costUsd: 0.01,
    })
    expect(await claimsSupported({ bio: 'Jane Doe is the director of Example Org.', receipts, judge })).toMatchObject({ ok: true, costUsd: 0.01 })
    const bad = await claimsSupported({ bio: 'Jane Doe is the director of Example Org. She won a Nobel prize.', receipts, judge })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toContain('Nobel')
    expect(await claimsSupported({ bio: 'x', receipts: [], judge })).toMatchObject({ ok: false, reason: 'no receipts' })
  })
})

describe('runVerifiers', () => {
  test('drops failing fields with the reason in note; * runs on every field', async () => {
    const result = await runVerifiers(
      { a: { value: 'ok' }, b: { value: 'too long' }, c: { value: 'x' } },
      {
        '*': [(f) => lengthWithin(f.value, { max: 8 })],
        b: [() => ({ ok: false, reason: 'always' })],
        c: [async () => ({ ok: true })],
      },
    )
    expect(Object.keys(result.patch)).toEqual(['a', 'c'])
    expect(result.dropped.b).toMatchObject({ value: 'too long', note: 'Dropped: always' })
  })
})
