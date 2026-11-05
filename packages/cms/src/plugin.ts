import type { Config, Plugin } from 'payload'

import { adminShell } from './admin/shell'
import { agentUIPlugin, contractPlugin } from './agent'
import { authPlugin } from './auth'
import { conventions } from './conventions'
import { freshCopy } from './conventions/freshCopy'
import { dashboardPlugin } from './dashboard'
import { emailPlugin } from './email'
import { helpPlugin } from './help'
import { DEFAULT_HELP_TOPICS } from './help/shared'
import { listsPlugin } from './lists'
import { applyModules, navWithModules, seedHelp } from './modules'
import { navPlugin } from './nav'
import { palettePlugin } from './palette'
import { reviewPlugin } from './review'
import { themePlugin } from './theme'
import type { SitekickCMSOptions } from './types'

/**
 * The Sitekick CMS plugin. One call in `payload.config.ts`:
 *
 *   plugins: [sitekickCMS({ site: { name: 'Demo Co.' } })]
 *
 * Site modules (`options.modules`, modules/index.ts) are added first of all, so their
 * collections get every convention below like the site's own.
 *
 * Order: help first so its collection exists before the conventions walk fields;
 * then auth (users fields), conventions (every walker), then the shell pieces
 * that only read the final collection list (nav, dashboard, theme, meta).
 */
export const sitekickCMS =
  (options: SitekickCMSOptions): Plugin =>
  (incoming: Config): Config => {
    // buildConfig mutates what it is given; copy so dev fast refresh starts clean.
    const modules = options.modules ?? []
    const applied = applyModules(freshCopy(incoming), modules)
    let config = applied.config
    const { cards, commands, help, helpTopics } = applied.contributions
    const opts: SitekickCMSOptions = { ...options, nav: navWithModules(options.nav, modules) }
    const dashboard = typeof opts.dashboard === 'object' ? opts.dashboard : {}
    const steps: Plugin[] = [
      helpPlugin(opts, helpTopics.length ? { topics: [...DEFAULT_HELP_TOPICS, ...helpTopics] } : {}),
      reviewPlugin(opts),
      emailPlugin(opts),
      authPlugin(opts),
      contractPlugin({ site: opts.site, usersSlug: opts.usersSlug }),
      ...conventions(opts),
      agentUIPlugin(opts),
      listsPlugin(opts),
      navPlugin(opts),
      dashboardPlugin(opts, { ...dashboard, cards: [...(dashboard.cards ?? []), ...cards] }),
      palettePlugin(opts, commands),
      themePlugin(),
      adminShell(opts),
    ]
    for (const step of steps) {
      const next = step(config)
      if (next instanceof Promise) throw new Error('sitekickCMS: async sub-plugins are not supported')
      config = next
    }
    if (help.length && opts.help !== false) {
      const previous = config.onInit
      config = {
        ...config,
        onInit: async (payload) => {
          await previous?.(payload)
          await seedHelp(payload, help)
        },
      }
    }
    return config
  }
