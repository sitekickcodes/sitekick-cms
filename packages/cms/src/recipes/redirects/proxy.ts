import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

import { HIT_PATH, REDIRECTS_SLUG, TABLE_PATH, destinationOf, hitKey, normalizePath, type RedirectRule } from './model'

export { normalizePath } from './model'

/** The header the proxy sets on every page request, so a 404 page can tell which address missed. */
export const PATH_HEADER = 'x-sitekick-path'

export type RedirectsProxyOptions = {
  /** Payload's REST route. Default `/api`. */
  apiRoute?: string
  /** How long one server keeps the table before asking again, in ms. Default 60s. */
  ttl?: number
  /** For the hit counter's key. Default `process.env.PAYLOAD_SECRET`. */
  secret?: string
}

type Table = { at: number; rules: Map<string, RedirectRule>; loading?: Promise<void> }

/**
 * The redirects recipe's half in Next: send visitors from old addresses to new ones, before
 * any page renders. In `src/proxy.ts`:
 *
 *   import { redirectsProxy } from '@sitekick/cms/redirects'
 *   const redirects = redirectsProxy()
 *   export const proxy = (req, event) => redirects(req, event)
 *   export const config = { matcher: ['/((?!admin|api|_next|.*\\.[a-z0-9]+$).*)'] }
 *
 * The table comes from `GET /api/redirects/table` (cached at the edge) and is kept in memory
 * for a minute, so a visit costs a lookup, not a query. Every other request passes through
 * with its path in `x-sitekick-path` for the not-found page (`recordMissing`).
 */
export function redirectsProxy(options: RedirectsProxyOptions = {}) {
  const apiRoute = options.apiRoute ?? '/api'
  const ttl = options.ttl ?? 60_000
  const table: Table = { at: 0, rules: new Map() }
  let key: Promise<string> | null = null

  const refresh = async (origin: string) => {
    try {
      const res = await fetch(`${origin}${apiRoute}/${REDIRECTS_SLUG}${TABLE_PATH}`, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { rules?: RedirectRule[] }
      table.rules = new Map((json.rules ?? []).map((r) => [r.from, r]))
    } catch {
      // Keep what we had; try again after the next interval rather than on every request.
    }
    table.at = Date.now()
  }

  return async function redirects(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
    const { pathname, search, origin } = request.nextUrl
    if (Date.now() - table.at > ttl) {
      table.loading ??= refresh(origin).finally(() => (table.loading = undefined))
      // The first request on a fresh server waits for the table; later refreshes don't.
      if (table.at === 0) await table.loading
    }
    const path = normalizePath(pathname)
    const rule = path ? table.rules.get(path) : undefined
    if (rule) {
      const secret = options.secret ?? process.env.PAYLOAD_SECRET
      if (secret && event) {
        key ??= hitKey(secret)
        event.waitUntil(
          key
            .then((k) => fetch(`${origin}${apiRoute}/${REDIRECTS_SLUG}${HIT_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sitekick-key': k }, body: JSON.stringify({ from: rule.from }) }))
            .catch(() => undefined),
        )
      }
      const to = destinationOf(rule, search)
      return NextResponse.redirect(new URL(to, origin), rule.permanent ? 308 : 307)
    }
    const headers = new Headers(request.headers)
    headers.set(PATH_HEADER, pathname)
    return NextResponse.next({ request: { headers } })
  }
}
