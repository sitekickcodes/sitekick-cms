import type { Page } from '@/payload-types'

import { cms, isDraft } from './cms'

/**
 * One page by slug, with relationships populated one level so block links
 * and images render. Drafts when an editor is previewing.
 */
export async function findPage(slug: string): Promise<Page | null> {
  const payload = await cms()
  const draft = await isDraft()
  const { docs } = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1, depth: 1, draft })
  return docs[0] ?? null
}
