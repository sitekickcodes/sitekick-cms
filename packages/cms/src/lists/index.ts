import type { CollectionConfig, Config, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * List views, beyond the conventions:
 *
 * - Saved views. Payload's query presets (filters, columns, sort and grouping saved under a
 *   name, for yourself or shared) switched on for every collection in the sidebar.
 * - Board. Collections with drafts get `/admin/collections/<slug>/board`: Draft, Changed and
 *   Published columns, where moving a card publishes or unpublishes it. A "Board" button
 *   beside Create new opens it.
 *
 * A collection that sets `enableQueryPresets` itself keeps its choice; one that already has
 * a `board` view keeps its own.
 */
export const BOARD_PATH = '/board'
export const BOARD_COMPONENTS = {
  view: '@sitekick/cms/admin#BoardView',
  link: '@sitekick/cms/admin#BoardLink',
} as const

export const listsPlugin =
  (options: Pick<SitekickCMSOptions, 'savedViews' | 'board'>): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: (config.collections ?? []).map((collection) => {
      let next = collection
      if (options.savedViews !== false && next.enableQueryPresets === undefined && !isHidden(next)) {
        next = { ...next, enableQueryPresets: true }
      }
      if (options.board !== false && hasBoard(next)) next = withBoard(next)
      return next
    }),
  })

/** Drafts, shown in the sidebar, and no board of its own already. */
export function hasBoard(collection: CollectionConfig): boolean {
  return Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts) && !isHidden(collection) && !collection.admin?.components?.views?.board
}

function withBoard(collection: CollectionConfig): CollectionConfig {
  const views = collection.admin?.components?.views
  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        views: {
          ...views,
          board: { Component: BOARD_COMPONENTS.view, path: BOARD_PATH, exact: true },
          list: {
            ...views?.list,
            actions: [...(views?.list?.actions ?? []), { path: BOARD_COMPONENTS.link, clientProps: { collection: collection.slug } }],
          },
        },
      },
    },
  }
}

// A function `hidden` depends on the user; such a collection may be in someone's sidebar.
const isHidden = (collection: CollectionConfig) => collection.admin?.hidden === true
