import type { CollectionSlug, DocumentViewServerProps, PayloadRequest, SanitizedCollectionConfig } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { Gutter } from '@payloadcms/ui'

import { RUNS_SLUG, asQuestion, asSteps, type RunStatus } from '../../review/shared'
import type { DocLink, RunView } from './model'
import { RunReviewClient } from './RunReviewClient'
import styles from './review.module.css'

/**
 * The run edit view (`views.edit.default` of `runs`). Payload keeps its
 * document header; this replaces the form with the "Now:" line, the step
 * timeline, the open question and Cancel / Retry. Links resolve here with
 * the editor's access; the client half polls and posts.
 */
export async function RunReview(props: DocumentViewServerProps) {
  const { doc, initPageResult, payload } = props
  const req = initPageResult.req
  const adminRoute = payload.config.routes.admin
  const apiRoute = payload.config.routes.api
  const collectionSlug = initPageResult.collectionConfig?.slug ?? RUNS_SLUG
  const id = doc?.id

  if (id === undefined || id === null || id === '') {
    return (
      <Gutter>
        <div className={styles.root}>
          <p className={styles.emptyState}>Runs are started by agents. Start one from a document and it will appear in the Inbox.</p>
        </div>
      </Gutter>
    )
  }

  const targetSlug = typeof doc.targetCollection === 'string' ? doc.targetCollection : ''
  const targetId = typeof doc.targetId === 'string' || typeof doc.targetId === 'number' ? doc.targetId : null
  const target = targetId !== null ? await link(req, payload.collections[targetSlug as CollectionSlug]?.config, targetId, adminRoute) : null
  const proposalsSlug = relationSlug(initPageResult.collectionConfig, 'proposal', 'proposals')
  const proposal = await link(req, payload.collections[proposalsSlug as CollectionSlug]?.config, relId(doc.proposal), adminRoute)

  const actionsURL = formatAdminURL({ apiRoute, path: `/${collectionSlug}/${encodeURIComponent(String(id))}` })
  const view: RunView = {
    id: String(id),
    title: typeof doc.title === 'string' ? doc.title : `Run #${String(id)}`,
    status: (typeof doc.status === 'string' ? doc.status : 'queued') as RunStatus,
    kind: typeof doc.kind === 'string' ? doc.kind : '',
    stage: str(doc.stage),
    now: str(doc.now),
    steps: asSteps(doc.steps),
    question: asQuestion(doc.question),
    answer: str(doc.answer),
    costUsd: typeof doc.costUsd === 'number' ? doc.costUsd : undefined,
    attempts: typeof doc.attempts === 'number' ? doc.attempts : 0,
    model: str(doc.model),
    error: str(doc.error),
    updatedAt: str(doc.updatedAt),
    target,
    proposal,
    triggeredBy: await userName(req, relId(doc.triggeredBy)),
    readURL: `${actionsURL}?depth=0`,
    actionsURL,
  }

  return (
    <Gutter>
      <div className={styles.root}>
        <RunReviewClient initial={view} />
      </div>
    </Gutter>
  )
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

function relId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const v = value as { value?: unknown; id?: unknown }
    if (typeof v.value === 'string' || typeof v.value === 'number') return v.value
    if (typeof v.id === 'string' || typeof v.id === 'number') return v.id
  }
  return null
}

/** The slug a single relationship field points at, or the default. */
function relationSlug(config: SanitizedCollectionConfig | undefined, name: string, fallback: string): string {
  const field = config?.fields.find((f) => 'name' in f && f.name === name)
  const to = field && field.type === 'relationship' ? field.relationTo : undefined
  return typeof to === 'string' ? to : fallback
}

async function link(req: PayloadRequest, config: SanitizedCollectionConfig | undefined, id: string | number | null, adminRoute: string): Promise<DocLink | null> {
  if (!config || id === null) return null
  try {
    const data = (await req.payload.findByID({
      collection: config.slug,
      id,
      depth: 0,
      draft: Boolean(config.versions?.drafts),
      req,
      overrideAccess: false,
      disableErrors: true,
    })) as Record<string, unknown> | null
    if (!data) return null
    const key = config.admin?.useAsTitle || 'id'
    const raw = data[key]
    const title = typeof raw === 'string' && raw.trim() ? raw : `#${String(id)}`
    return { title, href: `${adminRoute}/collections/${config.slug}/${String(id)}` }
  } catch {
    return null
  }
}

async function userName(req: PayloadRequest, id: string | number | null): Promise<string | undefined> {
  if (id === null) return undefined
  const config = req.payload.collections[req.payload.config.admin.user as CollectionSlug]?.config
  if (!config) return undefined
  try {
    const user = (await req.payload.findByID({ collection: config.slug, id, depth: 0, req, overrideAccess: false, disableErrors: true })) as Record<string, unknown> | null
    if (!user) return undefined
    return typeof user.name === 'string' && user.name.trim() ? user.name : typeof user.email === 'string' ? user.email : `#${String(id)}`
  } catch {
    return undefined
  }
}
