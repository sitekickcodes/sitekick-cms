import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Admin nav group headings. Collections/globals sharing a group name appear
 * together under that heading in the sidebar (and `options.nav`, when given,
 * reads them as the fallback arrangement).
 *
 *  - content: what the site publishes (pages, posts, people, events).
 *  - forms:   public form submissions, one collection per form. The single
 *             place staff triage what the site sends in.
 *  - shared:  data used across the site (the media library, tags).
 *  - admin:   operational collections (Users, Redirects).
 *
 * NOTE: groups are cosmetic. Real isolation comes from access control, NOT
 * from these headings ("grouping ≠ isolation").
 */
export const GROUP = {
  content: 'Content',
  forms: 'Forms',
  shared: 'Shared',
  admin: 'Admin',
} as const

export type Group = (typeof GROUP)[keyof typeof GROUP]

/**
 * A heading for anything that has none: upload collections under Shared, the
 * users collection under Admin, everything else under Content. Configs that
 * set `admin.group` (including `false`, to opt out) are left alone.
 */
export const groupsConvention =
  (options: SitekickCMSOptions): Plugin =>
  (config) => {
    const usersSlug = options.usersSlug ?? 'users'
    for (const collection of config.collections ?? []) {
      const admin = (collection.admin ??= {})
      if (admin.group !== undefined) continue
      admin.group = collection.upload ? GROUP.shared : collection.slug === usersSlug || collection.auth ? GROUP.admin : GROUP.content
    }
    for (const global of config.globals ?? []) {
      const admin = (global.admin ??= {})
      if (admin.group === undefined) admin.group = GROUP.content
    }
    return config
  }
