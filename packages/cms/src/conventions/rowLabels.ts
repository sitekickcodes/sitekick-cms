import type { Block, Field, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Gives every array field without a RowLabel of its own the AutoRowLabel
 * (admin/RowLabel.tsx): rows read as "Maya Reyes" or "Reform the rules",
 * not "Team 01". Walks collections, globals, blocks and nested fields; the
 * fallback keeps Payload's singular label.
 */
export const ROW_LABEL = '@sitekick/cms/admin#AutoRowLabel'

const singular = (field: { labels?: { singular?: unknown }; label?: unknown; name: string }) => {
  const s = field.labels?.singular ?? field.label
  return typeof s === 'string' ? s : field.name.charAt(0).toUpperCase() + field.name.slice(1)
}

export function withRowLabels(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'array') {
      const inner = withRowLabels(field.fields)
      if (field.admin?.components?.RowLabel) return { ...field, fields: inner }
      return {
        ...field,
        fields: inner,
        admin: {
          ...field.admin,
          components: { ...field.admin?.components, RowLabel: { path: ROW_LABEL, clientProps: { fallback: singular(field) } } },
        },
      } as Field
    }
    if (field.type === 'tabs') return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: withRowLabels(tab.fields) })) }
    if (field.type === 'row' || field.type === 'collapsible' || field.type === 'group') return { ...field, fields: withRowLabels(field.fields) } as Field
    // Beta.6: a block may be a string reference to config.blocks; those are left to their own definition.
    if (field.type === 'blocks') return { ...field, blocks: field.blocks.map((b: Block | string) => (typeof b === 'string' ? b : { ...b, fields: withRowLabels(b.fields) })) } as Field
    return field
  })
}

export const rowLabelsConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => ({
    ...config,
    collections: (config.collections ?? []).map((c) => ({ ...c, fields: withRowLabels(c.fields) })),
    globals: (config.globals ?? []).map((g) => ({ ...g, fields: withRowLabels(g.fields) })),
  })
