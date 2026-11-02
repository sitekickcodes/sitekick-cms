import type { Config, Plugin } from 'payload'

import { adminShell } from './admin/shell'
import { authPlugin } from './auth'
import { conventions } from './conventions'
import { freshCopy } from './conventions/freshCopy'
import { dashboardPlugin } from './dashboard'
import { helpPlugin } from './help'
import { navPlugin } from './nav'
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
      authPlugin(options),
      ...conventions(options),
      navPlugin(options),
      dashboardPlugin(options),
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
