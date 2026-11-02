import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import { helpArticlesCollection, type HelpCollectionOptions } from './collection'

export { helpArticlesCollection } from './collection'
export type { HelpCollectionOptions } from './collection'
export { readHelpArticles } from './articles'
export * from './shared'

export type HelpPluginOptions = Omit<HelpCollectionOptions, 'usersSlug' | 'adminRoute'>

/**
 * The help drawer: a `help-articles` collection under the Admin group, the
 * drawer provider mounted around the whole admin (so it survives navigation
 * and never touches the editor's route or form state), and `/admin/help`,
 * which redirects to the shareable `/admin?help=<id>` form.
 */
export const helpPlugin =
  (options: SitekickCMSOptions, help: HelpPluginOptions = {}): Plugin =>
  (config) => {
    if (options.help === false) return config

    const adminRoute = config.routes?.admin ?? '/admin'
    const collection = helpArticlesCollection({ ...help, usersSlug: options.usersSlug ?? 'users', adminRoute })

    config.collections ??= []
    if (!config.collections.some((c) => c.slug === collection.slug)) config.collections.push(collection)

    const admin = (config.admin ??= {})
    const components = (admin.components ??= {})
    components.providers = [...(components.providers ?? []), '@sitekick/cms/admin#HelpProvider']
    components.views = {
      ...components.views,
      help: {
        Component: '@sitekick/cms/admin#HelpView',
        path: '/help',
        exact: true,
        meta: { title: 'Help' },
      },
    }
    return config
  }
