import { DashboardPanel, DashboardRows, type DashboardCardProps, type DashboardRow } from '@sitekick/cms/admin'

import { upcomingEvents, when } from '../queries'

/** Dashboard card: the next events, drafts included, so a missing detail is caught early. */
export async function ComingUp({ req, adminRoute }: DashboardCardProps) {
  const { docs } = await upcomingEvents(req.payload, { limit: 5, draft: true })
  const rows: DashboardRow[] = docs.map((e) => ({
    key: String(e.id),
    title: e.title,
    kind: e.location || 'No place set',
    at: e.updatedAt,
    aside: when(e.startsAt, e.endsAt),
    href: `${adminRoute}/collections/events/${e.id}`,
    draft: e._status === 'draft',
  }))
  return (
    <DashboardPanel title="Coming up" sub="The next events on the calendar." more={{ href: `${adminRoute}/collections/events`, label: 'All events' }}>
      <DashboardRows rows={rows} empty="No upcoming events. Add one from Events." />
    </DashboardPanel>
  )
}
