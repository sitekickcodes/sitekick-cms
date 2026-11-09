import type { CollectionSlug } from 'payload'

import { Card } from '../dashboard/Card'
import type { CardContext, Row } from '../dashboard/data'
import { Rows } from '../dashboard/Rows'
import { MISSING_SLUG } from '../../recipes/redirects/model'

/** Dashboard card (redirects recipe): the addresses visitors try most that don't exist. */
export async function MissingPagesCard({ req, adminRoute }: CardContext) {
  const { docs, totalDocs } = await req.payload.find({
    collection: MISSING_SLUG as CollectionSlug,
    where: { status: { equals: 'open' } },
    sort: '-hits',
    limit: 5,
    depth: 0,
    select: { path: true, hits: true, lastSeenAt: true } as never,
    overrideAccess: false,
    req,
  })
  const rows: Row[] = docs.map((d) => {
    const doc = d as unknown as { id: number | string; path: string; hits?: number; lastSeenAt?: string; updatedAt: string }
    const hits = doc.hits ?? 0
    return {
      key: String(doc.id),
      title: doc.path,
      kind: `${hits.toLocaleString()} visit${hits === 1 ? '' : 's'}`,
      at: doc.lastSeenAt ?? doc.updatedAt,
      href: `${adminRoute}/collections/${MISSING_SLUG}/${doc.id}`,
      draft: false,
    }
  })
  const list = `${adminRoute}/collections/${MISSING_SLUG}?where[status][equals]=open`
  return (
    <Card
      title="Missing pages"
      sub={totalDocs ? 'Addresses people tried that don’t exist. Open one to send visitors somewhere useful.' : 'Addresses people try that don’t exist show up here.'}
      more={totalDocs > 5 ? { href: list, label: `All ${totalDocs.toLocaleString()}` } : undefined}
    >
      <Rows rows={rows} empty="No missing pages. Every address people tried led somewhere." />
    </Card>
  )
}
