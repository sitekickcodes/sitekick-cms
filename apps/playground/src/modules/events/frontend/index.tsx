import { Band, Card, CardBody, CardTitle, RichText, SectionHeading } from '@sitekick/blocks/react'
import Link from 'next/link'

import { cms, isDraft } from '@/lib/cms'
import { pageNotFound } from '@/lib/missing'
import type { Event } from '@/payload-types'

import type { UpcomingEventsData } from '../block'
import { upcomingEvents, when } from '../queries'

/** The "Upcoming events" page section (block.ts), always the next few. */
export async function UpcomingEvents({ block }: { block: UpcomingEventsData }) {
  const { docs } = await upcomingEvents(await cms(), { limit: block.count ?? 3 })
  return (
    <Band block="upcomingEvents" innerClassName="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading heading={block.heading || 'Coming up'} />
        <Link href="/events" className="text-sm font-medium text-sk-accent underline-offset-4 hover:underline">
          All events →
        </Link>
      </div>
      {docs.length ? <EventCards events={docs} /> : <p className="text-sk-muted">Nothing on the calendar right now.</p>}
    </Band>
  )
}

function EventCards({ events }: { events: Event[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <Card className="relative h-full">
            <CardBody>
              <p className="text-sm font-medium text-sk-accent">{when(e.startsAt, e.endsAt)}</p>
              <CardTitle>
                <Link href={`/events/${e.slug}`} className="after:absolute after:inset-0 hover:underline">
                  {e.title}
                </Link>
              </CardTitle>
              {e.location ? <p className="text-sm text-sk-muted">{e.location}</p> : null}
              {e.summary ? <p className="text-sm text-sk-muted">{e.summary}</p> : null}
            </CardBody>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** /events: everything still to come. */
export async function EventsPage() {
  const { docs } = await upcomingEvents(await cms(), { draft: await isDraft() })
  return (
    <Band block="events" innerClassName="flex flex-col gap-10">
      <SectionHeading heading="Events" />
      {docs.length ? <EventCards events={docs} /> : <p className="text-sk-muted">Nothing on the calendar right now. Check back soon.</p>}
    </Band>
  )
}

/** /events/<slug>. */
export async function EventPage({ slug }: { slug: string }) {
  const payload = await cms()
  const draft = await isDraft()
  const { docs } = await payload.find({ collection: 'events', where: { slug: { equals: slug }, ...(draft ? {} : { _status: { equals: 'published' } }) }, limit: 1, depth: 1, draft })
  const event = docs[0]
  if (!event) return pageNotFound(`/events/${slug}`)
  return (
    <article className="prose">
      <p className="lede">{when(event.startsAt, event.endsAt)}</p>
      <h1>{event.title}</h1>
      {event.location ? <p>{event.location}</p> : null}
      {event.summary ? <p className="lede">{event.summary}</p> : null}
      {event.signup ? (
        <p>
          <a href={event.signup} rel="noreferrer">
            Sign up
          </a>
        </p>
      ) : null}
      {event.body ? <RichText data={event.body} /> : null}
    </article>
  )
}

/** Section renderers this module adds (collected in modules/frontend.ts). */
export const eventBlocks = { upcomingEvents: UpcomingEvents }
