import type { Block, Config, Field, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * Gives every image upload field the UploadPreview shortcut: clicking the
 * photo or filename opens Payload's native media drawer, with its large
 * preview, alt text and Edit Image controls. Applies to upload fields that
 * point at a single upload-enabled collection (media, images, ...). Walks
 * fields inside tabs, rows, collapsibles, groups, arrays and blocks; fields
 * that already name an afterInput of their own keep theirs too.
 *
 * `admin.custom.noPreview: true` opts a field out (e.g. a sidebar logo).
 */
export const UPLOAD_PREVIEW = '@sitekick/cms/admin#UploadPreview'
export const META_IMAGE_WITH_PREVIEW = '@sitekick/cms/admin#MetaImageWithPreview'
const SEO_META_IMAGE = '@payloadcms/plugin-seo/client#MetaImageComponent'

export function withUploadPreview(fields: Field[], uploadCollections: Set<string>): Field[] {
  const walk = (list: Field[]): Field[] =>
    list.map((field): Field => {
      if (field.type === 'upload') {
        const single = typeof field.relationTo === 'string' ? field.relationTo : null
        const optedOut = (field.admin?.custom as { noPreview?: boolean } | undefined)?.noPreview
        if (!single || !uploadCollections.has(single) || optedOut) return field
        const component = field.admin?.components?.Field
        const path = typeof component === 'string' ? component : component && typeof component === 'object' && 'path' in component ? component.path : undefined
        if (path === SEO_META_IMAGE) {
          // The SEO plugin's upload component doesn't forward afterInput, so wrap it instead.
          return {
            ...field,
            admin: {
              ...field.admin,
              components: {
                ...field.admin?.components,
                Field: { ...(typeof component === 'object' ? component : {}), path: META_IMAGE_WITH_PREVIEW },
              },
            },
          } as Field
        }
        const after = field.admin?.components?.afterInput ?? []
        if (after.includes(UPLOAD_PREVIEW)) return field
        return { ...field, admin: { ...field.admin, components: { ...field.admin?.components, afterInput: [...after, UPLOAD_PREVIEW] } } } as Field
      }
      if (field.type === 'tabs') return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: walk(tab.fields) })) }
      if (field.type === 'row' || field.type === 'collapsible' || field.type === 'group' || field.type === 'array')
        return { ...field, fields: walk(field.fields) } as Field
      // Beta.6: a block may be a string reference to config.blocks; those are left to their own definition.
      if (field.type === 'blocks') return { ...field, blocks: field.blocks.map((b: Block | string) => (typeof b === 'string' ? b : { ...b, fields: walk(b.fields) })) } as Field
      return field
    })
  return walk(fields)
}

/** Slugs of the collections that store files. */
export const uploadCollectionsOf = (config: Config): Set<string> =>
  new Set((config.collections ?? []).filter((c) => Boolean(c.upload)).map((c) => c.slug))

export const uploadPreviewConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => {
    const uploads = uploadCollectionsOf(config)
    return {
      ...config,
      collections: (config.collections ?? []).map((c) => ({ ...c, fields: withUploadPreview(c.fields, uploads) })),
      globals: (config.globals ?? []).map((g) => ({ ...g, fields: withUploadPreview(g.fields, uploads) })),
    }
  }
