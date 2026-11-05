import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import type { CollectionConfig, CollectionSlug, Config, Endpoint, PayloadRequest, Plugin, SanitizedCollectionConfig } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie, getSafeRedirect, parseCookies } from 'payload/shared'

/**
 * Google sign-in, as a recipe (D8): an extra way in for people who already have an account,
 * next to email and password, which stay. Add it after sitekickCMS:
 *
 *   plugins: [sitekickCMS({ ... }), googleSignIn()]
 *
 * and set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a Google Cloud "Web application" OAuth
 * client whose redirect URI is `<site>/api/<users>/google/callback`). Until both are set the
 * button is hidden and the endpoints answer 404, so the recipe can ship before the client
 * exists.
 *
 * Who gets in: a Google account whose verified email matches a user. Invites stay the way
 * people are added. `domains` lets anyone with a verified address at those domains in as well,
 * creating their account with `role` on first sign-in (a client's own Workspace).
 *
 * The flow is OpenID Connect's code flow: a signed, short-lived cookie carries the state and
 * nonce; the code is exchanged server to server, so the ID token comes straight from Google
 * over TLS and its claims are checked without fetching keys (OIDC Core 3.1.3.7). The session is
 * Payload's own: a session row, the signed JWT and Payload's cookie, made as its login does,
 * and the collection's afterLogin hooks run (so the last sign-in stamp updates).
 */
export type GoogleSignInOptions = {
  clientId?: string
  clientSecret?: string
  /** Workspace domains whose people may sign in without an invite, e.g. `['acme.com']`. */
  domains?: string[]
  /** Role for accounts created through `domains`. Default `editor`. */
  role?: string
}

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const COOKIE = 'sitekick-google'
const STATE_TTL_S = 600

type Settings = { clientId: string; clientSecret: string; domains: string[]; role: string }

export function settingsOf(options: GoogleSignInOptions, env: Record<string, string | undefined> = process.env): Settings | null {
  const clientId = (options.clientId ?? env.GOOGLE_CLIENT_ID)?.trim()
  const clientSecret = (options.clientSecret ?? env.GOOGLE_CLIENT_SECRET)?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, domains: (options.domains ?? []).map((d) => d.toLowerCase().replace(/^@/, '')), role: options.role ?? 'editor' }
}

export const googleSignIn =
  (options: GoogleSignInOptions = {}): Plugin =>
  (config: Config): Config => {
    const usersSlug = config.admin?.user ?? 'users'
    const enabled = settingsOf(options) !== null
    const admin = { ...config.admin, custom: { ...config.admin?.custom } }
    // Read by the sign-in screen (AuthFrame) to show the button.
    admin.custom.sitekick = { ...(admin.custom.sitekick as object | undefined), google: enabled ? { start: `/${usersSlug}/google` } : false }
    return {
      ...config,
      admin,
      collections: (config.collections ?? []).map((c): CollectionConfig =>
        c.slug === usersSlug ? { ...c, endpoints: [...(c.endpoints === false ? [] : (c.endpoints ?? [])), startEndpoint(options), callbackEndpoint(options)] } : c,
      ),
    }
  }

function startEndpoint(options: GoogleSignInOptions): Endpoint {
  return {
    path: '/google',
    method: 'get',
    handler: (req) => {
      const settings = settingsOf(options)
      if (!settings) return Response.json({ error: 'Google sign-in is not set up.' }, { status: 404 })
      const redirect = new URL(req.url ?? '', 'http://x').searchParams.get('redirect') ?? ''
      const state = token()
      const nonce = token()
      const cookie = sealState({ state, nonce, redirect, exp: Math.floor(Date.now() / 1000) + STATE_TTL_S }, req.payload.secret)
      const location = authorizeURL({ clientId: settings.clientId, redirectURI: callbackURL(req), state, nonce, domains: settings.domains })
      return new Response(null, {
        status: 302,
        headers: { Location: location, 'Set-Cookie': stateCookie(req, cookie, STATE_TTL_S) },
      })
    },
  }
}

function callbackEndpoint(options: GoogleSignInOptions): Endpoint {
  return {
    path: '/google/callback',
    method: 'get',
    handler: async (req) => {
      const settings = settingsOf(options)
      if (!settings) return Response.json({ error: 'Google sign-in is not set up.' }, { status: 404 })
      const { admin } = req.payload.config.routes
      const fail = (reason: GoogleFailure) => redirectTo(req, `${admin}/login?google=${reason}`, stateCookie(req, '', 0))

      const params = new URL(req.url ?? '', 'http://x').searchParams
      const saved = openState(parseCookies(req.headers).get(COOKIE), req.payload.secret)
      if (!saved || saved.state !== params.get('state')) return fail('expired')
      if (params.get('error')) return fail('cancelled')
      const code = params.get('code')
      if (!code) return fail('expired')

      let claims: GoogleClaims
      try {
        const idToken = await exchangeCode({ code, settings, redirectURI: callbackURL(req) })
        const checked = checkClaims(decodeJwt(idToken), { clientId: settings.clientId, nonce: saved.nonce, now: Date.now() / 1000 })
        if (typeof checked === 'string') {
          req.payload.logger.warn(`Google sign-in refused: ${checked}`)
          return fail('failed')
        }
        claims = checked
      } catch (err) {
        req.payload.logger.error({ err, msg: 'Google sign-in failed' })
        return fail('failed')
      }

      const collection = req.payload.collections[(req.payload.config.admin.user ?? 'users') as CollectionSlug]?.config
      if (!collection) return fail('failed')
      const user = await findOrCreate(req, collection, claims, settings)
      if (!user) return fail('no-account')

      const cookie = await startSession(req, collection, user)
      const next = getSafeRedirect({ fallbackTo: admin, redirectTo: saved.redirect || admin })
      return redirectTo(req, next, stateCookie(req, '', 0), cookie)
    },
  }
}

/** `?google=` on the sign-in screen after a failure; admin/GoogleButton.tsx words each. */
export type GoogleFailure = 'cancelled' | 'expired' | 'failed' | 'no-account'

export function authorizeURL({ clientId, redirectURI, state, nonce, domains }: { clientId: string; redirectURI: string; state: string; nonce: string; domains: string[] }): string {
  const url = new URL(AUTHORIZE)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
    // A hint for Google's account chooser; the domain is still checked on the way back.
    ...(domains.length === 1 ? { hd: domains[0]! } : {}),
  }).toString()
  return url.toString()
}

async function exchangeCode({ code, settings, redirectURI }: { code: string; settings: Settings; redirectURI: string }): Promise<string> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: settings.clientId, client_secret: settings.clientSecret, redirect_uri: redirectURI, grant_type: 'authorization_code' }),
  })
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.id_token) throw new Error(json.error_description ?? json.error ?? `Google answered HTTP ${res.status}`)
  return json.id_token
}

export type GoogleClaims = { email: string; name?: string; hd?: string }

export function decodeJwt(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1]
  if (!part) throw new Error('Not a JWT')
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
}

/** The ID token's claims, or why they're refused. */
export function checkClaims(claims: Record<string, unknown>, { clientId, nonce, now }: { clientId: string; nonce: string; now: number }): GoogleClaims | string {
  if (!ISSUERS.includes(String(claims.iss))) return 'wrong issuer'
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(clientId)) return 'wrong audience'
  if (typeof claims.exp !== 'number' || claims.exp < now - 60) return 'expired token'
  if (claims.nonce !== nonce) return 'nonce mismatch'
  if (typeof claims.email !== 'string' || claims.email_verified !== true) return 'email not verified'
  return {
    email: claims.email.toLowerCase(),
    ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
    ...(typeof claims.hd === 'string' ? { hd: claims.hd.toLowerCase() } : {}),
  }
}

/** True when `domains` lets this address in without an invite. Workspace accounts carry `hd`. */
export function domainAllows(claims: GoogleClaims, domains: string[]): boolean {
  if (!domains.length) return false
  const domain = claims.hd ?? claims.email.split('@')[1]
  return Boolean(domain && domains.includes(domain) && claims.email.endsWith(`@${domain}`))
}

async function findOrCreate(req: PayloadRequest, collection: SanitizedCollectionConfig, claims: GoogleClaims, settings: Settings): Promise<TypedUser | null> {
  const slug = collection.slug as CollectionSlug
  const found = await req.payload.find({ collection: slug, where: { email: { equals: claims.email } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true, req })
  if (found.docs[0]) return found.docs[0] as unknown as TypedUser
  if (!domainAllows(claims, settings.domains)) return null
  const created = await req.payload.create({
    collection: slug,
    // A password nobody knows: Google is how they get in; "Forgot password" still works.
    data: { email: claims.email, name: claims.name ?? claims.email, roles: [settings.role], password: token() } as never,
    overrideAccess: true,
    disableVerificationEmail: true,
    req,
  })
  req.payload.logger.info(`Google sign-in created ${claims.email} (${settings.role}) from ${settings.domains.join(', ')}`)
  const full = await req.payload.find({ collection: slug, where: { id: { equals: created.id } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true, req })
  return (full.docs[0] as unknown as TypedUser | undefined) ?? null
}

/** What Payload's login operation does after the password checks out. */
async function startSession(req: PayloadRequest, collection: SanitizedCollectionConfig, found: TypedUser): Promise<string> {
  let user = found as TypedUser & { sessions?: unknown[] }
  const { sid } = await addSessionToUser({ collectionConfig: collection, payload: req.payload, req, user: user as never })
  const fieldsToSign = getFieldsToSign({ collectionConfig: collection, email: String(user.email), user: user as never, ...(sid ? { sid } : {}) })
  const { token: jwt } = await jwtSign({ fieldsToSign, secret: req.payload.secret, tokenExpiration: collection.auth.tokenExpiration })
  req.user = user as never
  for (const hook of collection.hooks?.afterLogin ?? []) {
    user = ((await hook({ collection, context: req.context, req, token: jwt, user: user as never })) as typeof user) || user
  }
  return generatePayloadCookie({ collectionAuthConfig: collection.auth, cookiePrefix: req.payload.config.cookiePrefix, token: jwt })
}

// ---- The state cookie: HMAC-signed so it can't be forged, short-lived, scoped to the endpoints.

type TypedUser = { id: number | string; email?: unknown; [key: string]: unknown }

type State = { state: string; nonce: string; redirect: string; exp: number }

export function sealState(state: State, secret: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString('base64url')
  return `${body}.${sign(body, secret)}`
}

export function openState(value: string | undefined, secret: string, now = Date.now() / 1000): State | null {
  if (!value) return null
  const [body, mac] = value.split('.')
  if (!body || !mac) return null
  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const state = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as State
    return typeof state.exp === 'number' && state.exp > now ? state : null
  } catch {
    return null
  }
}

const sign = (body: string, secret: string) => createHmac('sha256', `${secret}:google-sign-in`).update(body).digest('base64url')
const token = () => randomBytes(24).toString('base64url')

function callbackURL(req: PayloadRequest): string {
  const { serverURL, routes, admin } = req.payload.config
  const origin = serverURL?.replace(/\/$/, '') || originOf(req)
  return `${origin}${routes.api}/${admin.user ?? 'users'}/google/callback`
}

function originOf(req: PayloadRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

function stateCookie(req: PayloadRequest, value: string, maxAge: number): string {
  const secure = callbackURL(req).startsWith('https:') ? '; Secure' : ''
  return `${COOKIE}=${value}; Path=${req.payload.config.routes.api}/${req.payload.config.admin.user ?? 'users'}/google; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

function redirectTo(_req: PayloadRequest, location: string, ...cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}
