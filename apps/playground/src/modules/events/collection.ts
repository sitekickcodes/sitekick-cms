import { externalLink } from '@sitekick/cms'
import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Event', plural: 'Events' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'location', '_status'],
    description: 'Shown on /events, soonest first. Past events drop off the list on their own.',
  },
  access: { read: () => true },
  defaultSort: '-startsAt',
  versions: { drafts: true, maxPerDoc: 50 },
  custom: {
    sitekick: {
      seo: { pathPrefix: '/events' },
      agent: {
        description: 'An event shown on /events: a meeting, workshop, talk or social.',
        writable: ['title', 'summary', 'body', 'location', 'meta.title', 'meta.description'],
        review: 'required',
        actions: ['draft'],
        notes: 'Never invent a date, time, place or price. Keep the summary under 160 characters.',
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
      index: true,
      admin: { position: 'sidebar', description: 'URL: /events/<slug>. Blank = from the title.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          label: 'Starts',
          type: 'date',
          required: true,
          index: true,
          admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: 'EEE MMM d, yyyy h:mm a' } },
        },
        {
          name: 'endsAt',
          label: 'Ends',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: 'EEE MMM d, yyyy h:mm a' }, description: 'Blank = no end time shown.' },
          validate: (value: unknown, { siblingData }: { siblingData?: { startsAt?: string } }) =>
            !value || !siblingData?.startsAt || Date.parse(String(value)) >= Date.parse(siblingData.startsAt) ? true : 'The end is before the start.',
        },
      ],
    },
    { name: 'location', type: 'text', admin: { description: 'A place, or "Online". Blank = not shown.' } },
    { name: 'summary', type: 'textarea', admin: { description: 'One or two sentences for the list and search.' } },
    externalLink({ name: 'signup', label: 'Sign-up link', admin: { description: 'Tickets or RSVP. Blank = no button.' } }),
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText' },
  ],
}
