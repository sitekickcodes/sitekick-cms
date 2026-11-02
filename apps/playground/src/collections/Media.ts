import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image or file', plural: 'Media' },
  admin: { group: 'Library', description: 'Images and files used across the site.' },
  access: { read: () => true },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'What the image shows, for screen readers and search. Blank = filled in automatically on upload.' },
    },
    {
      name: 'credit',
      type: 'text',
      admin: { description: 'Photographer or source, shown where the image is used. Optional.' },
    },
  ],
  upload: {
    focalPoint: true,
    crop: false,
    mimeTypes: ['image/*', 'application/pdf'],
  },
  versions: false,
}
