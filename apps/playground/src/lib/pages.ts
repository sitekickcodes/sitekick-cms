import { applyProposalPreview } from '@sitekick/cms'
import { headers } from 'next/headers'

import type { Page } from '@/payload-types'

import { cms, isDraft } from './cms'

/**
 * One page by slug, with relationships populated one level so block links
 * and images render. Drafts when an editor is previewing; with `proposal`
 * (an editor reviewing an agent's change), that proposal applied on top.
 */
export async function findPage(slug: string, { proposal }: { proposal?: string } = {}): Promise<(Page & { previewing?: string }) | null> {
  const payload = await cms()
  const draft = await isDraft()
  // The Local API returns drafts too; outside a preview only published pages are public.
  const { docs } = await payload.find({ collection: 'pages', where: { slug: { equals: slug }, ...(draft ? {} : { _status: { equals: 'published' } }) }, limit: 1, depth: 1, draft })
  const page = docs[0] ?? null
  if (!page || !draft || !proposal) return page
  const applied = await applyProposalPreview({ payload, headers: await headers(), proposal, collection: 'pages', doc: page })
  return applied ? { ...applied.doc, previewing: applied.proposal.title } : page
}
