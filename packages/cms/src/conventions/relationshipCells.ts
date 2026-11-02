import type { Field, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Gives every relationship column in the admin's list views our
 * RelationshipCell (admin/RelationshipCell.tsx) instead of Payload's stock
 * cell, which shows "<No Author>" for any row it hasn't scrolled past yet.
 * Fields that already name their own Cell keep it.
 *
 * Walks the fields that can surface as list columns: top level and inside
 * tabs, rows, collapsibles and groups, but not arrays or blocks, which never
 * do. Runs after the plugins that add relationship fields of their own.
 */
export const RELATIONSHIP_CELL = '@sitekick/cms/admin#RelationshipCell'

export function withRelationshipCells(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'relationship') {
      if (field.admin?.components?.Cell) return field
      // Cast: spreading `admin` loses the single/polymorphic union's
      // discriminant (their `sortOptions` differ); only Cell is added.
      return {
        ...field,
        admin: { ...field.admin, components: { ...field.admin?.components, Cell: RELATIONSHIP_CELL } },
      } as Field
    }
    if (field.type === 'tabs') {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: withRelationshipCells(tab.fields) })) }
    }
    if (field.type === 'row' || field.type === 'collapsible' || field.type === 'group') {
      return { ...field, fields: withRelationshipCells(field.fields) } as Field
    }
    return field
  })
}

export const relationshipCellsConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => ({
    ...config,
    collections: (config.collections ?? []).map((collection) => ({
      ...collection,
      fields: withRelationshipCells(collection.fields),
    })),
  })
