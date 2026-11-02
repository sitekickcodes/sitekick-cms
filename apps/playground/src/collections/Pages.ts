import type { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description: 'Pages on the site. The URL is the slug: /<slug>.',
  },
  access: { read: () => true },
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
    {
      name: 'body',
      type: 'richText',
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
  ],
}
