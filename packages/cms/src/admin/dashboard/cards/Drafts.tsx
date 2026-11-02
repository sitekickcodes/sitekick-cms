import { Card } from '../Card'
import { newest, readableCollections, recentRows, type CardContext } from '../data'
import { Rows } from '../Rows'

/** Documents still in draft across every collection with drafts, newest first. */
export async function DraftsCard(context: CardContext) {
  const collections = readableCollections(context).filter((c) => c.versions?.drafts)
  const rows = newest(
    await Promise.all(collections.map((c) => recentRows(context, c, { where: { _status: { equals: 'draft' } }, limit: 6 }))),
    12,
    6,
  )
  return (
    <Card title="Drafts waiting" sub="Saved but not yet published.">
      <Rows rows={rows} empty="Nothing is waiting in draft." />
    </Card>
  )
}
