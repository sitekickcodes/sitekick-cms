import type { CollectionConfig, Field, Plugin } from 'payload'

import { autoSlug } from '../hooks/autoSlug'
import { promoteSlugCopy } from '../hooks/promoteSlugCopy'
import type { SitekickCMSOptions } from '../types'

/**
 * Slug from title on every collection that has both. A collection qualifies
 * when a `slug` text field and a `title` or `name` field sit at the top
 * level (or inside tabs, rows and collapsibles). Slug fields that already
 * carry hooks of their own are left alone: the collection has its own idea
 * of how slugs are made.
 *
 * What the collection gets:
 *   - beforeValidate: autoSlug — blank slug filled from the title, typed
 *     slugs tidied, copies numbered -2, -3.
 *   - afterDelete: promoteSlugCopy — deleting the plain one hands the
 *     numbered copy its URL back.
 *   - a description on the slug field, if it has none.
 */
type Found = { slug: Field & { name: string }; title?: string }

function findSlugAndTitle(fields: Field[]): Found | null {
  let slug: (Field & { name: string }) | undefined
  let title: string | undefined
  const walk = (list: Field[]) => {
    for (const field of list) {
      if (field.type === 'tabs') {
        for (const tab of field.tabs) if (!('name' in tab && tab.name)) walk(tab.fields)
        continue
      }
      if (field.type === 'row' || field.type === 'collapsible') {
        walk(field.fields)
        continue
      }
      if (!('name' in field)) continue
      if (field.type === 'text' && field.name === 'slug') slug = field
      if (field.type === 'text' && (field.name === 'title' || field.name === 'name') && !title) title = field.name
    }
  }
  walk(fields)
  return slug ? { slug, title } : null
}

const hasOwnHooks = (field: Field): boolean =>
  Boolean('hooks' in field && field.hooks && Object.values(field.hooks).some((list) => Array.isArray(list) && list.length > 0))

/** Adds the slug hooks to one collection, or returns it untouched. Exported for tests. */
export function withAutoSlug(collection: CollectionConfig): CollectionConfig {
  const found = findSlugAndTitle(collection.fields)
  if (!found || !found.title || hasOwnHooks(found.slug)) return collection
  const hooks = collection.hooks ?? {}
  const describe = (field: Field): Field =>
    field === found.slug && !(field.admin as { description?: unknown } | undefined)?.description
      ? ({ ...field, admin: { ...field.admin, description: `The address of this ${singular(collection)}: .../<slug>. Blank = from the ${found.title}.` } } as Field)
      : field.type === 'tabs'
        ? { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: tab.fields.map(describe) })) }
        : field.type === 'row' || field.type === 'collapsible'
          ? ({ ...field, fields: field.fields.map(describe) } as Field)
          : field
  return {
    ...collection,
    fields: collection.fields.map(describe),
    hooks: {
      ...hooks,
      beforeValidate: [autoSlug({ from: found.title }), ...(hooks.beforeValidate ?? [])],
      afterDelete: [...(hooks.afterDelete ?? []), promoteSlugCopy()],
    },
  }
}

const singular = (collection: CollectionConfig) => {
  const s = collection.labels?.singular
  return typeof s === 'string' ? s.toLowerCase() : 'page'
}

export const slugsConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => ({
    ...config,
    collections: (config.collections ?? []).map(withAutoSlug),
  })
