import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import type { NavServerOptions } from './types'

/** The import-map path of the sidebar server component. */
export const NAV_COMPONENT_PATH = '@sitekick/cms/admin#Nav'

/**
 * Replaces Payload's sidebar with ours (`admin/Nav.tsx`), handing it the
 * plugin's options through the import map's `serverProps` (and
 * `config.custom.sitekick` as a fallback for anything else that wants
 * them).
 *
 * No after-login hook: YIMBY needed one to seed Payload's `nav` preference
 * with every group closed, but our areas keep their own per-session fold
 * state (sessionStorage) and never read that preference.
 */
export const navPlugin =
  (options: SitekickCMSOptions): Plugin =>
  (config) => {
    const serverOptions: NavServerOptions = {
      site: options.site,
      nav: options.nav,
      usersSlug: options.usersSlug,
      help: options.help,
    }
    const admin = (config.admin ??= {})
    const components = (admin.components ??= {})
    components.Nav = { path: NAV_COMPONENT_PATH, serverProps: { sitekick: serverOptions } }
    config.custom = { ...config.custom, sitekick: { ...(config.custom?.sitekick as object | undefined), ...serverOptions } }
    return config
  }

export { accountSlugs, deriveArrangement, resolveArrangement } from './arrangement'
export { ICONS, iconForArea, type IconName } from './icons'
export type * from './types'
