import type { LabelFunction, StaticLabel } from 'payload'

import type { NavArrangement, NavLink } from '../types'
import { iconForArea, isIconName, type IconName } from './icons'
import type { RecentDoc, ResolvedArea, ResolvedLink, ResolvedNav, VisibleEntity } from './types'

/**
 * The sidebar arrangement engine: pure functions over plain data, so
 * `admin/Nav.tsx` stays a thin server component and `bun test` covers the
 * rules. Nothing here touches Payload at runtime; the caller hands in what
 * `groupNavItems` found visible and gets back the areas to draw.
 */

/** The label every unplaced-but-visible entity lands under. */
export const MORE_LABEL = 'More'

/** The admin user collection and any API-key collection go to the account menu. */
export type AccountSlugs = {
  users: string
  apiKeys: string[]
}

export type ResolveInput = {
  /** `options.nav`; omitted = derive from each entity's `admin.group`. */
  arrangement?: NavArrangement
  /** Everything the person may see, in config order (collections, then globals). */
  visible: VisibleEntity[]
  /** `config.routes.admin`, e.g. `/admin`. */
  adminRoute: string
  account: AccountSlugs
}

/** A collection's plural label as text: a string, or this language's entry. */
export function labelText(label: LabelFunction | StaticLabel | undefined, language = 'en'): string {
  if (!label) return ''
  if (typeof label === 'string') return label
  if (typeof label === 'function') return ''
  return label[language] ?? Object.values(label)[0] ?? ''
}

/** `/admin` + `/collections/pages`, with the slashes right. */
export function joinAdmin(adminRoute: string, path: string): string {
  const base = adminRoute.replace(/\/+$/, '')
  const rest = path.startsWith('/') ? path : `/${path}`
  return `${base}${rest}` || '/'
}

/** `pages` → `{ to: 'pages' }`; objects pass through. */
export function normalizeLink(link: NavLink): Exclude<NavLink, string> {
  return typeof link === 'string' ? { to: link } : link
}

/** `?a=1` or `a=1` → `?a=1`; empty stays empty. */
export function normalizeQuery(query?: string): string {
  if (!query) return ''
  return query.startsWith('?') ? query : `?${query}`
}

const entityKey = (e: Pick<VisibleEntity, 'kind' | 'slug'>) => `${e.kind}:${e.slug}`

/**
 * Which collections belong in the account menu rather than the sidebar:
 * the admin user collection, and anything that looks like an API-key store
 * (slug ends in `api-key(s)`, as `@payloadcms/plugin-mcp`'s
 * `payload-mcp-api-keys` does, or an auth collection using API keys that
 * is not the admin user collection).
 */
export function accountSlugs(
  collections: { slug: string; auth?: unknown }[],
  usersSlug: string,
): AccountSlugs {
  const apiKeys = collections
    .filter((c) => c.slug !== usersSlug)
    .filter((c) => {
      if (/api-keys?$/i.test(c.slug)) return true
      const auth = c.auth
      return Boolean(auth && typeof auth === 'object' && (auth as { useAPIKey?: unknown }).useAPIKey)
    })
    .map((c) => c.slug)
  return { users: usersSlug, apiKeys }
}

/**
 * Areas from each entity's `admin.group`, in config order: a group becomes an
 * area the first time it is seen, and keeps that position. Payload files
 * ungrouped entities under its own "Collections" / "Globals" labels; those
 * become areas too.
 */
export function deriveArrangement(visible: VisibleEntity[]): NavArrangement {
  const areas = new Map<string, NavLink[]>()
  for (const e of visible) {
    const label = e.group || (e.kind === 'globals' ? 'Globals' : 'Collections')
    if (!areas.has(label)) areas.set(label, [])
    areas.get(label)!.push(e.kind === 'globals' ? { to: e.slug, label: e.label } : e.slug)
  }
  return [...areas].map(([label, links]) => ({ label, links }))
}

/**
 * Resolve an arrangement against what is visible. A link names a collection
 * or global slug (collections win on a tie, as Payload's own URLs are
 * distinct anyway) or `view:<path>` for a custom admin view. Links to things
 * the person cannot see drop out; an area with nothing left drops out too.
 * Whatever is visible and still unplaced lands under "More", grouped as
 * Payload would group it. Users and API keys never sit in the sidebar: they
 * come back as `account`.
 */
export function resolveArrangement(input: ResolveInput): ResolvedNav {
  const { adminRoute, account } = input
  const byKey = new Map<string, VisibleEntity>()
  const bySlug = new Map<string, VisibleEntity>()
  for (const e of input.visible) {
    byKey.set(entityKey(e), e)
    // first wins: collections precede globals in `visible`
    if (!bySlug.has(e.slug)) bySlug.set(e.slug, e)
  }

  const accountKeys = new Set<string>([
    `collections:${account.users}`,
    ...account.apiKeys.map((s) => `collections:${s}`),
  ])
  const placed = new Set<string>(accountKeys)

  const hrefFor = (e: VisibleEntity) => joinAdmin(adminRoute, `/${e.kind}/${e.slug}`)

  const resolveLink = (raw: NavLink): ResolvedLink | null => {
    const link = normalizeLink(raw)
    if (link.to.startsWith('view:')) {
      const path = link.to.slice('view:'.length)
      return {
        key: link.to,
        href: joinAdmin(adminRoute, path) + normalizeQuery(link.query),
        label: link.label ?? (path.replace(/^\/+/, '').replace(/[-_/]+/g, ' ').trim() || path),
      }
    }
    const explicit = /^(collections|globals):/.test(link.to) ? byKey.get(link.to) : undefined
    const hit = explicit ?? bySlug.get(link.to)
    if (!hit) return null
    const key = entityKey(hit)
    if (accountKeys.has(key)) return null
    placed.add(key)
    return { key, href: hrefFor(hit) + normalizeQuery(link.query), label: link.label ?? hit.label }
  }

  const arrangement = input.arrangement ?? deriveArrangement(input.visible)
  const areas: ResolvedArea[] = []
  for (const area of arrangement) {
    const links = area.links.map(resolveLink).filter((l): l is ResolvedLink => Boolean(l))
    if (!links.length) continue
    areas.push({ key: `area:${area.label}`, label: area.label, icon: resolveIcon(area.icon, area.label), links })
  }

  // Anything visible the arrangement doesn't place: a last "More" area, by
  // Payload group, so nothing silently drops out of the sidebar.
  const more: ResolvedLink[] = []
  for (const e of input.visible) {
    const key = entityKey(e)
    if (placed.has(key)) continue
    placed.add(key)
    more.push({ key, href: hrefFor(e), label: e.label })
  }
  if (more.length) {
    const existing = areas.find((a) => a.label === MORE_LABEL)
    if (existing) existing.links.push(...more)
    else areas.push({ key: `area:${MORE_LABEL}`, label: MORE_LABEL, icon: 'ellipsis', links: more })
  }

  const accountLinks: ResolvedLink[] = []
  const users = byKey.get(`collections:${account.users}`)
  if (users) accountLinks.push({ key: entityKey(users), href: hrefFor(users), label: users.label })
  for (const slug of account.apiKeys) {
    const e = byKey.get(`collections:${slug}`)
    if (e) accountLinks.push({ key: entityKey(e), href: hrefFor(e), label: e.label })
  }

  return { areas, account: accountLinks }
}

/** A named Lucide icon if we have it, else one guessed from the label. */
export function resolveIcon(name: string | undefined, label: string): IconName {
  return isIconName(name) ? name : iconForArea(label)
}

// ---- Client-side helpers, pure so they are testable ----

const decode = (v: string) => {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

/**
 * Payload's own test (DefaultNavClient): the page or anything under it. A
 * link that filters a list is current only while the page's query carries
 * the same filter.
 */
export function isActive(pathname: string, href: string, search = ''): boolean {
  const [path = '', query] = href.split('?')
  if (!path) return false
  if (!(pathname.startsWith(path) && ['/', undefined].includes(pathname[path.length]))) return false
  return !query || decode(search).includes(decode(query))
}

/** How many `where[...]` conditions a list URL carries. Search alone isn't counted. */
export function countFilters(search: string): number {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return [...params.keys()].filter((k) => k.startsWith('where[')).length
}

/** `{ slug, id }` when `pathname` is a collection document's edit page. */
export function parseEditPath(adminRoute: string, pathname: string): { slug: string; id: string } | null {
  const base = adminRoute.replace(/\/+$/, '')
  if (!pathname.startsWith(`${base}/collections/`)) return null
  const rest = pathname.slice(`${base}/collections/`.length).split('/')
  const [slug, id, ...more] = rest
  if (!slug || !id || more.length) return null
  // Collection views that aren't documents (lists/index.ts adds `board`).
  if (id === 'create' || id === 'trash' || id === 'board') return null
  return { slug, id }
}

/** The ring buffer: `doc` moves to the front, deduped by href, capped at `max`. */
export function pushRecent(list: RecentDoc[], doc: RecentDoc, max = 6): RecentDoc[] {
  return [doc, ...list.filter((d) => d.href !== doc.href)].slice(0, max)
}

/** Initials for the account circle: first and last word, else the first two letters. */
export function initialsOf(name: string | undefined, email: string): string {
  const base = (name ?? '').trim() || (email.split('@')[0] ?? '')
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length > 1) return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

/**
 * Where the page sits in the sidebar: the most specific matching link, with
 * its area. Used to lead the breadcrumb with the sidebar path.
 */
export function placeOf(
  areas: ResolvedArea[],
  pathname: string,
  search = '',
): { area: string; label: string } | null {
  let best: { area: string; label: string; length: number } | null = null
  for (const area of areas)
    for (const link of area.links) {
      if (!isActive(pathname, link.href, search)) continue
      if (!best || link.href.length > best.length) best = { area: area.label, label: link.label, length: link.href.length }
    }
  return best ? { area: best.area, label: best.label } : null
}
