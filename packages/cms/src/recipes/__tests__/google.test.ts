import { describe, expect, test } from 'bun:test'
import type { Config } from 'payload'

import { authorizeURL, checkClaims, decodeJwt, domainAllows, googleSignIn, openState, sealState, settingsOf } from '../google'

const claims = { iss: 'https://accounts.google.com', aud: 'client-1', exp: 2_000, nonce: 'n1', email: 'Lee@Acme.com', email_verified: true, name: 'Lee', hd: 'acme.com' }
const check = (over: Record<string, unknown> = {}) => checkClaims({ ...claims, ...over }, { clientId: 'client-1', nonce: 'n1', now: 1_000 })

describe('googleSignIn', () => {
  test('stays off without credentials, and says so to the sign-in screen', () => {
    expect(settingsOf({}, {})).toBeNull()
    const env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }
    expect(settingsOf({ domains: ['@Acme.com'] }, env)).toEqual({ clientId: 'id', clientSecret: 'secret', domains: ['acme.com'], role: 'editor' })
  })

  test('adds both endpoints to the users collection only', () => {
    const out = googleSignIn({ clientId: 'id', clientSecret: 's' })({ admin: { user: 'users' }, collections: [{ slug: 'users', fields: [] }, { slug: 'pages', fields: [] }] } as unknown as Config) as Config
    const [users, pages] = out.collections!
    expect((users!.endpoints as { path: string }[]).map((e) => e.path)).toEqual(['/google', '/google/callback'])
    expect(pages!.endpoints).toBeUndefined()
    expect((out.admin?.custom as { sitekick: { google: unknown } }).sitekick.google).toEqual({ start: '/users/google' })
  })

  test('asks Google for an ID token with state and nonce, hinting a single domain', () => {
    const url = new URL(authorizeURL({ clientId: 'id', redirectURI: 'https://acme.com/api/users/google/callback', state: 's', nonce: 'n', domains: ['acme.com'] }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ response_type: 'code', scope: 'openid email profile', state: 's', nonce: 'n', hd: 'acme.com' })
  })
})

describe('ID token claims', () => {
  test('a verified address for this client passes, lowercased', () => {
    expect(check()).toEqual({ email: 'lee@acme.com', name: 'Lee', hd: 'acme.com' })
    expect(check({ aud: ['other', 'client-1'] })).toMatchObject({ email: 'lee@acme.com' })
  })

  test('anything off is refused', () => {
    expect(check({ iss: 'https://evil.example' })).toBe('wrong issuer')
    expect(check({ aud: 'other' })).toBe('wrong audience')
    expect(check({ exp: 100 })).toBe('expired token')
    expect(check({ nonce: 'replayed' })).toBe('nonce mismatch')
    expect(check({ email_verified: false })).toBe('email not verified')
  })

  test('decodes the payload part', () => {
    const jwt = `x.${Buffer.from(JSON.stringify({ a: 1 })).toString('base64url')}.y`
    expect(decodeJwt(jwt)).toEqual({ a: 1 })
  })

  test('domains let in that Workspace only', () => {
    expect(domainAllows({ email: 'lee@acme.com', hd: 'acme.com' }, ['acme.com'])).toBe(true)
    expect(domainAllows({ email: 'lee@gmail.com' }, ['acme.com'])).toBe(false)
    expect(domainAllows({ email: 'lee@acme.com' }, [])).toBe(false)
    // A consumer account can't claim a Workspace domain it isn't in.
    expect(domainAllows({ email: 'lee@evil.com', hd: 'acme.com' }, ['acme.com'])).toBe(false)
  })
})

describe('state cookie', () => {
  const state = { state: 's', nonce: 'n', redirect: '/admin/collections/pages', exp: 2_000 }
  test('round-trips, and refuses tampering, another secret or expiry', () => {
    const sealed = sealState(state, 'secret')
    expect(openState(sealed, 'secret', 1_000)).toEqual(state)
    expect(openState(sealed, 'other', 1_000)).toBeNull()
    expect(openState(sealed, 'secret', 3_000)).toBeNull()
    const [body, mac] = sealed.split('.')
    const forged = Buffer.from(JSON.stringify({ ...state, redirect: 'https://evil.example' })).toString('base64url')
    expect(openState(`${forged}.${mac}`, 'secret', 1_000)).toBeNull()
    expect(openState(body, 'secret', 1_000)).toBeNull()
    expect(openState(undefined, 'secret')).toBeNull()
  })
})
