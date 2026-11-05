import { EventPage } from '@/modules/events/frontend'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <EventPage slug={(await params).slug} />
}
