import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import type { PaletteView } from './commands'

export const PALETTE_COMPONENT_PATH = '@sitekick/cms/admin#CommandPalette'

/** What the palette needs from the server, carried on `admin.custom` (which reaches the client config). */
export type PaletteClientOptions = {
  views: PaletteView[]
  help: boolean
}

/**
 * Cmd+K. A provider (so it lives outside the replaceable views and keeps
 * its state across navigation) that lists every place the person can go,
 * every thing they can create, and searches documents across readable
 * collections as they type. Custom views registered with a `path` are
 * offered too, labelled from their key ("inbox" → "Inbox").
 */
export const palettePlugin =
  (options: SitekickCMSOptions): Plugin =>
  (config) => {
    const admin = (config.admin ??= {})
    const components = (admin.components ??= {})
    components.providers = [...(components.providers ?? []), PALETTE_COMPONENT_PATH]
    const views: PaletteView[] = Object.entries(components.views ?? {})
      .flatMap(([key, view]) => {
        const path = view && typeof view === 'object' && 'path' in view && typeof view.path === 'string' ? view.path : null
        return path ? [{ path, label: key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ') }] : []
      })
    const client: PaletteClientOptions = { views, help: options.help !== false }
    admin.custom = { ...admin.custom, sitekick: { ...(admin.custom?.sitekick as object | undefined), palette: client } }
    return config
  }

export { buildCommands, PALETTE_OPEN_EVENT, rank, type Command } from './commands'
