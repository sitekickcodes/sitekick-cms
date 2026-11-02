import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Wires the admin shell: logo and icon, sign-in frame, sidebar, dashboard,
 * help drawer, tab title, live preview breakpoints and i18n tweaks.
 * Ported modules add to this function.
 */
export const adminShell =
  (options: SitekickCMSOptions): Plugin =>
  (config) => {
    const admin = (config.admin ??= {})
    admin.meta = {
      ...admin.meta,
      titleSuffix: admin.meta?.titleSuffix ?? ` · ${options.site.name}`,
    }
    admin.livePreview = {
      breakpoints: [
        { label: 'Phone', name: 'phone', width: 375, height: 812 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      ...admin.livePreview,
    }
    return config
  }
