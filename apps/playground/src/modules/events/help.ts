import { markdownToLexical } from '@sitekick/agents'
import type { ModuleHelpArticle } from '@sitekick/cms'

export const eventsHelp: ModuleHelpArticle[] = [
  {
    slug: 'adding-an-event',
    title: 'Adding an event',
    topic: 'Events',
    summary: 'Create an event, set when and where, and show upcoming events on a page.',
    body: markdownToLexical(
      [
        '## Create the event',
        '1. Open **Events** in the sidebar and choose **Create New**.',
        '2. Give it a title, then set **Starts** (and **Ends**, if it has an end time).',
        '3. Add the place under **Location**, or write "Online".',
        '4. Write a one or two sentence **Summary**: it shows in the list and in search results.',
        '5. Add a **Sign-up link** if people need tickets or to RSVP.',
        '6. **Publish**. The event appears on /events straight away.',
        '',
        'Past events drop off the list on their own; there is nothing to remove.',
        '',
        '## Show events on a page',
        'On any page, choose **Add Section** and pick **Upcoming events**. Set the heading and how many to show. It always lists the next ones, so it never goes out of date.',
        '',
        '## Draft from notes',
        'Have an email or a flyer? Choose **Draft from notes** on the Events list and paste it in. You check every field before anything is saved, and the date and time are always yours to set.',
      ].join('\n'),
    ) as unknown as Record<string, unknown>,
  },
]
