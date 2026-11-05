import type { Block } from 'payload'

/** A page section listing the next few events, read live (nothing to keep up to date). */
export const UpcomingEventsBlock: Block = {
  slug: 'upcomingEvents',
  labels: { singular: 'Upcoming events', plural: 'Upcoming events sections' },
  admin: { group: 'Designed sections' },
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Coming up' },
    { name: 'count', label: 'How many', type: 'number', defaultValue: 3, min: 1, max: 6, required: true },
  ],
}

export type UpcomingEventsData = { blockType: 'upcomingEvents'; id?: string | null; heading?: string | null; count?: number | null }
