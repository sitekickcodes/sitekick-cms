import type { CollectionConfig } from 'payload'

export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: 'Person', plural: 'People' },
  admin: {
    group: 'People',
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'updatedAt'],
    description: 'Team, authors and partners. Add a name and research fills in the rest.',
  },
  access: { read: () => true },
  custom: {
    sitekick: {
      agent: {
        description: 'A person: staff, author or partner.',
        writable: ['bio', 'website', 'photo', 'social'],
        fillEmptyOnly: ['bio', 'website', 'photo'],
        review: 'required',
        actions: ['enrich'],
      },
    },
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Full name, as they use it.' } },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar', description: 'From their name. Fixed once set.' } },
    { name: 'role', type: 'text', admin: { description: 'e.g. “Head of Design”.' } },
    { name: 'photo', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'bio', type: 'textarea', admin: { description: 'A few sentences. Research drafts it; edit freely.' } },
    { name: 'website', type: 'text', admin: { description: 'Personal or company site.' } },
    {
      name: 'social',
      type: 'array',
      admin: { description: 'Public accounts.' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'X', value: 'x' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'Bluesky', value: 'bluesky' },
            { label: 'Threads', value: 'threads' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'Other', value: 'other' },
          ],
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
}
