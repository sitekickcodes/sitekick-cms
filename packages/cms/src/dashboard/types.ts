import type { PayloadComponent } from 'payload'

import type { SiteIdentity } from '../types'

/** A range switch in the dashboard URL: `?range=7d|30d|90d`. */
export type RangeConfig = {
  /** Choices in days. Default `[7, 30, 90]`. */
  choices?: number[]
  /** The choice when the URL has none. Default: the second choice, or the first. */
  default?: number
}

/** The range every card reads, in days. */
export type Range = number

/**
 * A card slot on the dashboard. The component is a server component
 * referenced by import-map path; it receives the view's server props plus
 * `{ range, adminRoute, site }`. Add card paths from the client config and the
 * plugin registers them in `admin.dependencies` so the import map finds them.
 */
export type DashboardCard = {
  /** Unique per card; also the Suspense key. */
  key: string
  /** Shown in the loading skeleton before the card streams in. */
  title: string
  /** `@scope/pkg/admin#Export` or a `{ path, exportName }` object. */
  Component: PayloadComponent
  /** Columns on a two-column grid. Default 1. */
  span?: 1 | 2
  /** Rows of skeleton while loading. Default 5. */
  skeletonRows?: number
}

export type DashboardPluginOptions = {
  /**
   * Which of the built-in cards to show. All on by default:
   * Drafts waiting, Recent edits, Collections at a glance.
   */
  builtin?: Partial<{ drafts: boolean; recent: boolean; collections: boolean }>
  /** Extra cards streamed after the built-ins (proposals, runs, site pulse...). */
  cards?: DashboardCard[]
  /** Range switch in the header. Off by default; cards read it as `range`. */
  range?: RangeConfig | false
  /** Collection slugs in the Create menu, in order. Default: every collection the user may create in. */
  create?: string[]
  /** The dismissible welcome card pointing at Help. Default on when help is on. */
  welcome?: boolean
}

/** What the Dashboard view receives via `Component.serverProps`. */
export type DashboardServerProps = {
  site: SiteIdentity
  builtin: { drafts: boolean; recent: boolean; collections: boolean }
  cards: DashboardCard[]
  range: Required<RangeConfig> | false
  create?: string[]
  welcome: boolean
}

/** `?range=30d` → 30, clamped to the configured choices. */
export function parseRange(value: unknown, range: DashboardServerProps['range']): Range {
  if (!range) return 0
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : NaN
  return range.choices.includes(n) ? n : range.default
}

/** The dashboard URL for a range, leaving the default out. */
export function rangeHref(adminRoute: string, range: Range, config: DashboardServerProps['range']) {
  return !config || range === config.default ? adminRoute : `${adminRoute}?range=${range}d`
}
