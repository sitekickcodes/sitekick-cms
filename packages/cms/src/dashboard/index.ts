import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import type { DashboardPluginOptions, DashboardServerProps } from './types'

export * from './types'

/**
 * The dashboard home: greeting, Create menu, welcome card, then cards each
 * streaming inside its own Suspense boundary so one slow query never holds
 * up the page. Built-in cards work for any client; `cards` adds more.
 */
export const dashboardPlugin =
  (options: SitekickCMSOptions, dashboard: DashboardPluginOptions = {}): Plugin =>
  (config) => {
    if (options.dashboard === false) return config

    const choices = dashboard.range ? (dashboard.range.choices ?? [7, 30, 90]) : [7, 30, 90]
    const serverProps: DashboardServerProps = {
      site: options.site,
      builtin: { drafts: true, recent: true, collections: true, ...dashboard.builtin },
      cards: dashboard.cards ?? [],
      range: dashboard.range ? { choices, default: dashboard.range.default ?? choices[1] ?? choices[0] ?? 30 } : false,
      create: dashboard.create,
      welcome: dashboard.welcome ?? options.help !== false,
    }

    const admin = (config.admin ??= {})
    const components = (admin.components ??= {})
    components.views = {
      ...components.views,
      dashboard: { Component: { path: '@sitekick/cms/admin', exportName: 'Dashboard', serverProps } },
    }
    // Card components live in client config, not anywhere Payload scans for
    // the import map; register them as dependencies so the map includes them.
    admin.dependencies ??= {}
    for (const card of serverProps.cards) {
      const path = typeof card.Component === 'string' ? card.Component : card.Component ? `${card.Component.path}#${card.Component.exportName ?? 'default'}` : null
      if (path) admin.dependencies[`sitekick-dashboard-card:${card.key}`] = { type: 'component', path }
    }
    return config
  }
