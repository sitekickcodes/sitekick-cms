import type { CollectionConfig, Config, Field, Plugin } from 'payload'
import { seoPlugin } from '@payloadcms/plugin-seo'

import type { SitekickCMSOptions } from '../types'
import { fillSEO, seoDefaults, type SEOSite } from './seoDefaults'
import { uploadCollectionsOf } from './uploadPreview'

/**
 * Search and sharing details on every public collection, filled from the
 * content: @payloadcms/plugin-seo's `meta` tab with Sitekick's editor
 * components in place of the stock ones (admin/SEOFields.tsx), a hook pair
 * that fills blanks on save and read, and an autofill that follows the
 * content while the editor types (admin/SEOAutofill.tsx).
 *
 * Which collections (`custom.sitekick.seo` in types.ts):
 *   - `false`                 never. Private data, uploads, users, forms.
 *   - `{ pathPrefix: '/x' }`  always; the prefix makes the public URL.
 *   - unset                   when the collection has a `slug` field — a slug
 *                             means a public page — and is not an upload or
 *                             auth collection. Its URL is `/<collection>/<slug>`.
 *
 * Public URL (the search-result preview): `options.site.url` (or the request
 * origin) + the path prefix + the slug. Nothing here knows about templates or
 * tenants; collections with other address schemes set `admin.preview`
 * themselves and get the same prefix convention for their SEO preview.
 */
export const SEO_COMPONENTS = {
  overview: '@sitekick/cms/admin#SEOOverview',
  title: '@sitekick/cms/admin#SEOTitle',
  description: '@sitekick/cms/admin#SEODescription',
  image: '@sitekick/cms/admin#SEOImage',
  preview: '@sitekick/cms/admin#SEOPreview',
} as const
export const SEO_AUTOFILL = '@sitekick/cms/admin#SEOAutofill'
export const SEO_NOTE = '@sitekick/cms/admin#SEOAutofillNote'

type SEOCustom = false | { pathPrefix?: string } | undefined

const seoCustomOf = (collection: CollectionConfig): SEOCustom => collection.custom?.sitekick?.seo as SEOCustom

const hasSlugField = (fields: Field[]): boolean =>
  fields.some((field) => {
    if (field.type === 'tabs') return field.tabs.some((tab) => !('name' in tab && tab.name) && hasSlugField(tab.fields))
    if (field.type === 'row' || field.type === 'collapsible') return hasSlugField(field.fields)
    return field.type === 'text' && field.name === 'slug'
  })

/** The collections the SEO tab goes on. Exported for tests. */
export function seoCollections(config: Config): CollectionConfig[] {
  return (config.collections ?? []).filter((collection) => {
    const custom = seoCustomOf(collection)
    if (custom === false) return false
    if (custom && typeof custom === 'object') return true
    return !collection.upload && !collection.auth && hasSlugField(collection.fields)
  })
}

/** Where a document lives on the site. */
export function seoPathFor(collection: CollectionConfig, doc: Record<string, unknown>): string {
  const custom = seoCustomOf(collection)
  const prefix = (custom && typeof custom === 'object' && custom.pathPrefix) || `/${collection.slug}`
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  return `${prefix.replace(/\/+$/, '')}/${slug}`.replace(/\/+$/, '') || '/'
}

const siteOf = (options: SitekickCMSOptions): SEOSite => ({ name: options.site.name })

export const seoConvention =
  (options: SitekickCMSOptions): Plugin =>
  (incoming) => {
    const site = siteOf(options)
    const targets = seoCollections(incoming)
    if (!targets.length) return incoming
    const bySlug = new Map(targets.map((c) => [c.slug, c]))
    const uploads = uploadCollectionsOf(incoming)
    const uploadsCollection = uploads.has('media') ? 'media' : [...uploads][0]

    const applied = seoPlugin({
      collections: targets.map((c) => c.slug),
      uploadsCollection,
      tabbedUI: true,
      generateTitle: ({ doc }) => seoDefaults(doc, site).title,
      generateDescription: ({ doc }) => seoDefaults(doc, site).description,
      generateURL: ({ doc, collectionSlug, req }) => {
        const collection = collectionSlug ? bySlug.get(collectionSlug) : undefined
        const path = collection ? seoPathFor(collection, doc ?? {}) : '/'
        const origin = options.site.url ?? new URL(req.url ?? 'http://localhost').origin
        return new URL(path, origin).href
      },
      fields: ({ defaultFields }) => [
        { name: 'automaticDefaults', type: 'ui', admin: { components: { Field: { path: SEO_NOTE, clientProps: { siteName: site.name } } } } },
        ...defaultFields.map((field): Field => {
          if (!('name' in field) || !field.name || !(field.name in SEO_COMPONENTS)) return field
          const path = SEO_COMPONENTS[field.name as keyof typeof SEO_COMPONENTS]
          const icon = options.site.icon ?? options.site.logo
          return {
            ...field,
            ...(field.type === 'upload' ? { label: 'Sharing image' } : {}),
            admin: {
              ...field.admin,
              ...(field.type === 'upload'
                ? { description: 'Used when this page is shared. Without an image, the site uses its default share card.', style: { marginBottom: 0 } }
                : {}),
              components: { ...field.admin?.components, Field: { path, clientProps: { siteName: site.name, siteIcon: icon } } },
            },
          } as Field
        }),
      ],
    })(incoming)
    // definePlugin-wrapped plugins return the config directly; plugin.ts rejects promises anyway.
    if (applied instanceof Promise) throw new Error('sitekickCMS: @payloadcms/plugin-seo returned a promise')
    const config = applied

    for (const collection of config.collections ?? []) {
      if (!bySlug.has(collection.slug)) continue
      const admin = (collection.admin ??= {})
      const components = (admin.components ??= {})
      const edit = (components.edit ??= {})
      edit.beforeDocumentControls = [...(edit.beforeDocumentControls ?? []), { path: SEO_AUTOFILL, clientProps: { siteName: site.name } }]
      const hooks = (collection.hooks ??= {})
      // Existing blanks are usable immediately; saves persist defaults without bulk-publishing old drafts.
      hooks.beforeValidate = [
        ...(hooks.beforeValidate ?? []),
        ({ data, originalDoc }) => {
          if (data) data.meta = fillSEO(data, site, originalDoc)
          return data
        },
      ]
      hooks.afterRead = [
        ...(hooks.afterRead ?? []),
        ({ doc }) => {
          // Respect selects: slug-only queries must remain slug-only.
          if (doc.meta !== undefined) doc.meta = fillSEO(doc, site)
          return doc
        },
      ]
    }
    return config
  }
