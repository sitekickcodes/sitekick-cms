import { editorConfig, layoutField } from '@sitekick/blocks'
import type { CollectionConfig } from 'payload'

/** Pages live at /<slug>; `home` is the front page. */
const pagePath = (slug: unknown): string => (typeof slug === 'string' && slug && slug !== 'home' ? `/${slug}` : '/')

/**
 * Preview and live preview both go through /api/draft, which turns on Next's
 * draft mode and redirects, so the iframe shows unpublished changes.
 */
const previewUrl = (slug: unknown, serverURL: string): string =>
  `${serverURL}/api/draft?secret=${encodeURIComponent(process.env.PAYLOAD_SECRET ?? '')}&url=${encodeURIComponent(pagePath(slug))}`

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description: 'Pages on the site. The URL is the slug: /<slug>.',
    livePreview: {
      url: ({ data, req }) => previewUrl(data.slug, req.payload.config.serverURL),
    },
    preview: (doc, { req }) => previewUrl(doc.slug, req.payload.config.serverURL),
  },
  access: { read: () => true },
  // Pages live at the site root: /<slug>. Drives SEO previews and the public catalog.
  custom: {
    sitekick: {
      seo: { pathPrefix: '/' },
      agent: {
        description: 'A page on the site, built from sections (the layout field).',
        writable: ['layout'],
        review: 'required',
        actions: ['edit'],
        notes: 'Never publish. Keep the one hero at the top.',
      },
    },
  },
  versions: { drafts: { autosave: { interval: 1000 } }, maxPerDoc: 50 },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar', description: 'URL: /<slug>. Blank = from the title.' },
    },
    {
      name: 'intro',
      type: 'textarea',
      admin: { description: 'One or two sentences under the title. Also the search description if the SEO one is blank.' },
    },
    layoutField(),
    {
      name: 'body',
      type: 'richText',
      editor: editorConfig(),
      admin: { description: 'Copy below the sections. Blank = none.' },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
  ],
}
