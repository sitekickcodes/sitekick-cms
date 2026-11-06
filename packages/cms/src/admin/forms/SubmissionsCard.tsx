import type { CollectionSlug } from 'payload'

import { Card } from '../dashboard/Card'
import type { CardContext, Row } from '../dashboard/data'
import { Rows } from '../dashboard/Rows'
import { FORMS_SLUG, SUBMISSIONS_SLUG } from '../../recipes/forms/collections'

/** Dashboard card (forms recipe): the newest submissions still marked New. */
export async function SubmissionsCard({ req, adminRoute }: CardContext) {
  const { docs, totalDocs } = await req.payload.find({
    collection: SUBMISSIONS_SLUG as CollectionSlug,
    where: { status: { equals: 'new' } },
    sort: '-createdAt',
    limit: 5,
    depth: 1,
    select: { summary: true, form: true, createdAt: true, updatedAt: true } as never,
    populate: { [FORMS_SLUG]: { title: true } } as never,
    overrideAccess: false,
    req,
  })
  const rows: Row[] = docs.map((d) => {
    const doc = d as unknown as { id: number | string; summary?: string; form?: { title?: string } | null; createdAt: string }
    return {
      key: String(doc.id),
      title: doc.summary || 'Submission',
      kind: doc.form?.title ?? 'Form',
      at: doc.createdAt,
      href: `${adminRoute}/collections/${SUBMISSIONS_SLUG}/${doc.id}`,
      draft: false,
    }
  })
  const list = `${adminRoute}/collections/${SUBMISSIONS_SLUG}?where[status][equals]=new`
  return (
    <Card title="New submissions" sub={totalDocs ? `${totalDocs} waiting to be handled.` : 'What people send through the site’s forms.'} more={totalDocs ? { href: list, label: 'All new' } : undefined}>
      <Rows rows={rows} empty="Nothing new. Submissions from the site’s forms show up here." />
    </Card>
  )
}
