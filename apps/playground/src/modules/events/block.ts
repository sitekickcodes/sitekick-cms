import type { Block } from 'payload'

/** A page section listing the next few events, read live (nothing to keep up to date). */
export const UpcomingEventsBlock: Block = {
  slug: 'upcomingEvents',
  labels: { singular: 'Upcoming events', plural: 'Upcoming events sections' },
  admin: { group: 'Designed sections' },
  // Read by agents (Edit with words); agent/blocks/upcomingEvents.md would replace it.
  custom: { guide: 'The next few events from the Events collection, kept up to date automatically. Use it wherever a page should point to what is coming up (home, about, a programme page). Three is the usual count. Never type event details into other sections; this section reads them live.' },
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Coming up' },
    { name: 'count', label: 'How many', type: 'number', defaultValue: 3, min: 1, max: 6, required: true },
  ],
}

export type UpcomingEventsData = { blockType: 'upcomingEvents'; id?: string | null; heading?: string | null; count?: number | null }
