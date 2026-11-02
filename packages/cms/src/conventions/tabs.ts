import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Editorial navigation on every document: "Content" and "History" tabs, and
 * the API tab hidden. The API view stays addressable by its URL for
 * developers; editors never need it. Entities that already name a tab label
 * keep it.
 */
export const tabsConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => {
    for (const entity of [...(config.collections ?? []), ...(config.globals ?? [])]) {
      const admin = (entity.admin ??= {})
      const components = (admin.components ??= {})
      const views = (components.views ??= {})
      const edit = (views.edit ??= {})
      edit.default = { ...edit.default, tab: { label: 'Content', ...edit.default?.tab } }
      edit.versions = { ...edit.versions, tab: { label: 'History', ...edit.versions?.tab } }
      edit.api = {
        ...edit.api,
        tab: {
          label: 'Developer API',
          ...edit.api?.tab,
          condition: () => false,
        },
      }
    }
    return config
  }
