import type { Config, Plugin } from 'payload'

import { adminShell } from './admin/shell'
import { agentUIPlugin, contractPlugin } from './agent'
import { authPlugin } from './auth'
import { conventions } from './conventions'
import { freshCopy } from './conventions/freshCopy'
import { dashboardPlugin } from './dashboard'
import { emailPlugin } from './email'
import { helpPlugin } from './help'
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
 * Order: help first so its collection exists before the conventions walk fields;
 * then auth (users fields), conventions (every walker), then the shell pieces
 * that only read the final collection list (nav, dashboard, theme, meta).
 */
export const sitekickCMS =
  (options: SitekickCMSOptions): Plugin =>
  (incoming: Config): Config => {
    // buildConfig mutates what it is given; copy so dev fast refresh starts clean.
    let config = freshCopy(incoming)
    const steps: Plugin[] = [
      helpPlugin(options),
      reviewPlugin(options),
      emailPlugin(options),
      authPlugin(options),
      contractPlugin({ site: options.site, usersSlug: options.usersSlug }),
      ...conventions(options),
      agentUIPlugin(options),
      navPlugin(options),
      dashboardPlugin(options),
      palettePlugin(options),
      themePlugin(),
      adminShell(options),
    ]
    for (const step of steps) {
      const next = step(config)
      if (next instanceof Promise) throw new Error('sitekickCMS: async sub-plugins are not supported')
      config = next
    }
    return config
  }
