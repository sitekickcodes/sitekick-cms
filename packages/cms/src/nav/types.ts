import type { NavArrangement, SiteIdentity } from '../types'

/**
 * The resolved sidebar: what `nav/arrangement.ts` produces from `options.nav`
 * (or the config's `admin.group`s) and what `admin/Nav.tsx` hands to
 * `admin/NavClient.tsx`. Plain, serialisable data: it crosses the
 * server → client boundary as props.
 *
 * The public data format (`NavArrangement`, `NavArea`, `NavLink` in
 * `src/types.ts`) is unchanged; these are its resolved counterparts.
 */

/** One row the person can click. */
export type ResolvedLink = {
  href: string
  label: string
  /** `collections:<slug>`, `globals:<slug>` or `view:<path>`; the key `placed` is tracked by. */
  key: string
  /** A count shown at the row's end (the inbox's open items). */
  badge?: number
}

/** A titled, collapsible area of links. */
export type ResolvedArea = {
  /** Stable per session: `area:<label>`. */
  key: string
  label: string
  /** Lucide icon name (see `nav/icons.ts`). */
  icon: string
  links: ResolvedLink[]
}

/** A visible collection or global, as Payload's own nav would list it. */
export type VisibleEntity = {
  kind: 'collections' | 'globals'
  slug: string
  label: string
  /** The group label Payload's `groupNavItems` filed it under. */
  group: string
}

/** A pinned document, with its title already resolved on the server. */
export type PinnedDoc = {
  collectionSlug: string
  id: number | string
  title: string
  href: string
}

/** A recently visited edit page, from the client's localStorage ring buffer. */
export type RecentDoc = {
  href: string
  title: string
  collectionSlug: string
  id: string
  /** ms since epoch */
  at: number
}

/** What `navPlugin` passes to the Nav server component via `serverProps`. */
export type NavServerOptions = {
  site: SiteIdentity
  nav?: NavArrangement
  usersSlug?: string
  help?: boolean
}

export type ResolvedNav = {
  areas: ResolvedArea[]
  /** Users, API keys: the account menu's admin links. */
  account: ResolvedLink[]
}
