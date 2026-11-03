import type { CollectionConfig, Config, GlobalConfig } from 'payload'

/** A small site: public news with a contract, a read-only public team, a private inbox, one public global. */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'News' },
  admin: { useAsTitle: 'title', description: 'Shown on /news.', listSearchableFields: ['title', 'excerpt'] },
  access: { read: () => true },
  versions: { drafts: true },
  custom: {
    sitekick: {
      agent: { description: 'A news post shown on /news.', writable: ['title', 'excerpt', 'body'], fillEmptyOnly: ['excerpt'], notes: 'Never publish.' },
      seo: { pathPrefix: '/news' },
    },
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { type: 'row', fields: [{ name: 'excerpt', type: 'textarea' }, { name: 'secret', type: 'text', admin: { hidden: true } }] },
    { name: 'body', type: 'richText', required: true },
    { name: 'meta', type: 'group', fields: [{ name: 'description', type: 'textarea' }] },
  ],
}

export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: 'Person', plural: 'People' },
  admin: { useAsTitle: 'name' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'role', type: 'text' },
  ],
}

export const Inbox: CollectionConfig = {
  slug: 'inbox',
  access: { read: () => true },
  custom: { sitekick: { private: true } },
  fields: [{ name: 'email', type: 'email' }, { name: 'slug', type: 'text' }],
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [{ name: 'roles', type: 'select', hasMany: true, options: ['admin', 'editor'] }],
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  access: { read: () => true },
  custom: { sitekick: { agent: { writable: ['tagline'], review: 'none' } } },
  fields: [
    { name: 'tagline', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
  ],
}

export const sampleConfig = (): Pick<Config, 'collections' | 'globals' | 'custom' | 'admin'> => ({
  admin: { user: 'users' },
  collections: [Posts, People, Inbox, Users],
  globals: [SiteSettings],
})
