import { describe, expect, test } from 'bun:test'

import { clientKey, createRateLimiter } from '../rateLimit'

describe('createRateLimiter', () => {
  test('counts per client and window, advertising the IETF fields', () => {
    const take = createRateLimiter({ limit: 2, windowSeconds: 10 })
    const t0 = 1_000_000
    expect(take('a', t0)).toMatchObject({ limited: false, headers: { 'RateLimit-Policy': '"public";q=2;w=10', RateLimit: '"public";r=1;t=10', 'RateLimit-Remaining': '1' } })
    expect(take('a', t0 + 1000).headers.RateLimit).toBe('"public";r=0;t=9')
    const third = take('a', t0 + 2000)
    expect(third.limited).toBe(true)
    expect(third.headers['Retry-After']).toBe('8')
    expect(third.retryAfter).toBe(8)
    expect(take('b', t0).limited).toBe(false)
    expect(take('a', t0 + 10_000).limited).toBe(false)
  })
  test('clientKey prefers x-real-ip, then the first forwarded hop', () => {
    expect(clientKey(new Request('https://x', { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }))).toBe('1.1.1.1')
    expect(clientKey(new Request('https://x', { headers: { 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '1.1.1.1' } }))).toBe('3.3.3.3')
    expect(clientKey(new Request('https://x'))).toBe('anonymous')
  })
})
