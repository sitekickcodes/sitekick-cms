import { defineModule } from '@sitekick/cms'

import { UpcomingEventsBlock } from './block'
import { Events } from './collection'
import { eventsHelp } from './help'

/** Events: a calendar of meetings, talks and socials, its pages, and a section for any page. */
export const events = defineModule({
  name: 'events',
  collections: [Events],
  blocks: [UpcomingEventsBlock],
  nav: { label: 'Events', icon: 'calendar', links: ['events'] },
  dashboard: [{ key: 'events-coming-up', title: 'Coming up', Component: '/modules/events/admin/ComingUp#ComingUp', skeletonRows: 5 }],
  // "Events" and "New event" come with the collection; this adds the calendar view.
  commands: [{ label: 'Upcoming events', href: '/collections/events?sort=startsAt', keywords: ['calendar', 'schedule'] }],
  help: eventsHelp,
})
