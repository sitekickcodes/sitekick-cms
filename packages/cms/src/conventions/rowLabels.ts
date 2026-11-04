import type { Block, Field, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Gives every array field without a RowLabel of its own the AutoRowLabel
 * (admin/RowLabel.tsx): rows read as "Maya Reyes" or "Reform the rules",
 * not "Team 01". Walks collections, globals, blocks and nested fields; the
 * fallback keeps Payload's singular label. Blocks get BlockRowLabel: the
 * section's type and heading in place of the "Untitled" block name.
 */
export const ROW_LABEL = '@sitekick/cms/admin#AutoRowLabel'
export const BLOCK_ROW_LABEL = '@sitekick/cms/admin#BlockRowLabel'

const singular = (field: { labels?: { singular?: unknown }; label?: unknown; name: string }) => {
  const s = field.labels?.singular ?? field.label
  return typeof s === 'string' ? s : field.name.charAt(0).toUpperCase() + field.name.slice(1)
}

/** A block's header shows its heading ("Hero · Welcome") unless the block brings its own Label. */
function withBlockLabel(block: Block): Block {
  if (block.admin?.components?.Label) return block
  const label = block.labels?.singular
  const blockLabel = typeof label === 'string' ? label : block.slug.charAt(0).toUpperCase() + block.slug.slice(1)
  return { ...block, admin: { ...block.admin, components: { ...block.admin?.components, Label: { path: BLOCK_ROW_LABEL, clientProps: { blockLabel } } } } }
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
    if (field.type === 'blocks') return { ...field, blocks: field.blocks.map((b: Block | string) => (typeof b === 'string' ? b : withBlockLabel({ ...b, fields: withRowLabels(b.fields) }))) } as Field
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
