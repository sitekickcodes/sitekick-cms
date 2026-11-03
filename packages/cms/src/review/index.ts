import type { CollectionSlug, Payload, PayloadRequest, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import { proposalsCollection, reviewSlugs, runsCollection, type ReviewCollectionOptions } from './collections'

export { proposalsCollection, runsCollection, reviewSlugs } from './collections'
export type { ReviewCollectionOptions } from './collections'
export * from './shared'
export { fieldLabel, fieldAtPath, renderValue, lexicalParagraphs, type Rendered } from './render'

export type ReviewPluginOptions = Omit<ReviewCollectionOptions, 'usersSlug'>

/** Where the inbox lives under the admin route. */
export const INBOX_PATH = '/inbox'

/**
 * The review inbox: the `proposals` and `runs` collections under the Inbox
 * group, their review views, and `/admin/inbox`. Sidebar wiring (the
 * `view:inbox` link and its badge, via `countInbox`) is done by the nav.
 */
export const reviewPlugin =
  (options: SitekickCMSOptions, review: ReviewPluginOptions = {}): Plugin =>
  (config) => {
    const slugs = reviewSlugs({ ...review, usersSlug: options.usersSlug ?? 'users' })
    const collections = [proposalsCollection(slugs), runsCollection(slugs)]

    config.collections ??= []
    for (const collection of collections) {
      if (!config.collections.some((c) => c.slug === collection.slug)) config.collections.push(collection)
    }

    const admin = (config.admin ??= {})
    const components = (admin.components ??= {})
    components.views = {
      ...components.views,
      inbox: {
        Component: { path: '@sitekick/cms/admin', exportName: 'InboxView', serverProps: { slugs } },
        path: INBOX_PATH,
        exact: true,
        meta: { title: 'Inbox' },
      },
    }
    return config
  }

export type InboxCount = { proposals: number; runs: number }

/**
 * What the sidebar badge adds up: proposals still open and runs waiting on
 * an answer, counted with this user's access. A signed-out or unknown user
 * sees zeros, and so does anyone when a count fails (the badge is a hint,
 * not a report).
 */
export async function countInbox(
  payload: Payload,
  user: PayloadRequest['user'] | null | undefined,
  options: ReviewCollectionOptions = {},
): Promise<InboxCount> {
  if (!user) return { proposals: 0, runs: 0 }
  const slugs = reviewSlugs(options)
  const count = async (collection: string, where: Record<string, unknown>) => {
    if (!payload.collections[collection as CollectionSlug]) return 0
    try {
      const { totalDocs } = await payload.count({ collection: collection as CollectionSlug, where: where as never, user, overrideAccess: false })
      return totalDocs
    } catch {
      return 0
    }
  }
  const [proposals, runs] = await Promise.all([
    count(slugs.proposalsSlug, { status: { equals: 'open' } }),
    count(slugs.runsSlug, { status: { equals: 'waiting' } }),
  ])
  return { proposals, runs }
}
