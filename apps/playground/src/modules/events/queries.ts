import type { Payload } from 'payload'

/** Events that haven't ended yet, soonest first: published ones, or drafts too for previews and the admin. */
export function upcomingEvents(payload: Payload, { limit = 50, draft = false }: { limit?: number; draft?: boolean } = {}) {
  const now = new Date().toISOString()
  return payload.find({
    collection: 'events',
    where: {
      and: [
        // The Local API returns drafts too unless told otherwise; the public site shows published only.
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        { or: [{ endsAt: { greater_than_equal: now } }, { and: [{ endsAt: { exists: false } }, { startsAt: { greater_than_equal: startOfToday() } }] }] },
      ],
    },
    sort: 'startsAt',
    limit,
    depth: 1,
    draft,
  })
}

/** An event without an end time stays listed for the rest of its day. */
function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** "Thu, Nov 20 · 6:00 PM", or with the end time when it's the same day. */
export function when(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt)
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (!endsAt) return `${day} · ${time(start)}`
  const end = new Date(endsAt)
  return start.toDateString() === end.toDateString() ? `${day} · ${time(start)} – ${time(end)}` : `${day} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
