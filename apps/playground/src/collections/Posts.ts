import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'News' },
  admin: {
    group: 'News',
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'publishedAt', '_status'],
    description: 'Shown on /news. Search and sharing details update automatically.',
  },
  access: { read: () => true },
  versions: { drafts: true, maxPerDoc: 50 },
  custom: {
    sitekick: {
      seo: { pathPrefix: '/news' },
      agent: {
        description: 'A news post shown on /news.',
        writable: ['title', 'excerpt', 'body', 'cover', 'meta.title', 'meta.description'],
        review: 'required',
        actions: ['draft'],
        notes: 'Never publish. Keep the excerpt under 160 characters.',
      },
    },
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar', description: 'URL: /news/<slug>. Blank = from the title.' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'MMMM d, yyyy' },
        description: 'Blank = the day it is first published.',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'people',
      admin: { position: 'sidebar', description: 'Shown with their photo and role.' },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      admin: { description: 'Listing blurb and search description.' },
    },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText', required: true },
  ],
}
