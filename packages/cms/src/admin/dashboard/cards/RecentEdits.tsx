import { Card } from '../Card'
import { newest, readableCollections, recentRows, type CardContext } from '../data'
import { Rows } from '../Rows'

/** The last ten documents anyone changed, among those this user may read. */
export async function RecentEditsCard(context: CardContext) {
  const collections = readableCollections(context)
  const rows = newest(await Promise.all(collections.map((c) => recentRows(context, c, { limit: 3 }))), 10)
  return (
    <Card title="Recent edits" sub="The latest changes, across everything you can see.">
      <Rows rows={rows} empty="No edits yet." />
    </Card>
  )
}
