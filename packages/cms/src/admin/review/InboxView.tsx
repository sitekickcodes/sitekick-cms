import type { AdminViewServerProps, CollectionSlug, PayloadRequest } from 'payload'
import { Gutter } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/ui/rsc'

import { labelOf } from '../dashboard/data'
import { ACTIVE_RUN_STATUSES, RUN_STATUS_MAP, reviewSlugs, type ReviewCollectionOptions } from '../../review'
import { StatusTag } from '../StatusTag'
import { relative } from './model'
import styles from './review.module.css'

const LIMIT = 100

type ProposalRow = { id: string; title: string; collection: string; collectionLabel: string; kind?: string; agent?: string; createdAt?: string; href: string; startedBy?: string }
type RunRow = { id: string; title: string; collection: string; collectionLabel: string; stage?: string; now?: string; status: string; href: string; startedBy?: string }

/** A relationship value (id, populated doc or `{ value }`) as an id string. */
const idOf = (v: unknown): string | undefined => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (v && typeof v === 'object') return idOf((v as { value?: unknown; id?: unknown }).value ?? (v as { id?: unknown }).id)
  return undefined
}

/**
 * `/admin/inbox`: what needs a person. "To review" lists open proposals
 * newest first; "In progress" lists runs that are queued, running or
 * waiting. Both read with the signed-in editor's access. `?collection=`
 * narrows both lists (the chips come from what is actually there), and
 * `?started=me` to what the editor started themselves. Each row says who
 * started it.
 */
export async function InboxView(props: AdminViewServerProps & { slugs?: ReviewCollectionOptions }) {
  const { i18n, initPageResult, locale, params, payload, permissions, searchParams, user, viewActions } = props
  const req = initPageResult.req
  const adminRoute = payload.config.routes.admin
  if (!initPageResult.req.user) {
    props.server.redirect(`${adminRoute}/login?redirect=${encodeURIComponent(`${adminRoute}/inbox`)}`)
    return null
  }
  const slugs = reviewSlugs(props.slugs)
  const filter = typeof searchParams?.collection === 'string' && searchParams.collection ? searchParams.collection : null
  const mine = searchParams?.started === 'me'
  const me = String(req.user?.id)
  const inboxURL = ({ collection = filter, started = mine }: { collection?: string | null; started?: boolean }) => {
    const q = new URLSearchParams()
    if (collection) q.set('collection', collection)
    if (started) q.set('started', 'me')
    return `${adminRoute}/inbox${q.size ? `?${q}` : ''}`
  }
  const label = (slug: string) => {
    const config = payload.collections[slug as CollectionSlug]?.config
    return config ? labelOf(config.labels?.singular, i18n, slug) : slug || 'Document'
  }

  const [proposals, runs] = await Promise.all([loadProposals(req, slugs.proposalsSlug, adminRoute, label), loadRuns(req, slugs.runsSlug, adminRoute, label)])
  const collections = [...new Set([...proposals.map((p) => p.collection), ...runs.map((r) => r.collection)])].filter(Boolean).sort()
  const keep = (row: { collection: string; startedBy?: string }) => (!filter || row.collection === filter) && (!mine || row.startedBy === me)
  const shownProposals = proposals.filter(keep)
  const shownRuns = runs.filter(keep)
  const names = await namesOf(req, [...proposals, ...runs].map((r) => r.startedBy))
  const startedBy = (id: string | undefined) => (!id ? 'Started automatically' : id === me ? 'Started by you' : `Started by ${names[id] ?? 'someone'}`)
  const now = Date.now()

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions ?? initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      viewActions={viewActions}
      viewType="inbox"
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className={styles.root}>
          <header className={styles.head}>
            <div>
              <h1 className={styles.title}>Inbox</h1>
              <p className={styles.lede}>Changes agents would like to make, and the work they are doing now. Nothing goes live until you accept it.</p>
              <div className={styles.filters}>
                {collections.length > 1 ? (
                  <ul className={styles.chips} aria-label="Filter by collection">
                    <li>
                      <a className={styles.chip} href={inboxURL({ collection: null })} aria-current={filter ? undefined : 'true'}>
                        All
                      </a>
                    </li>
                    {collections.map((slug) => (
                      <li key={slug}>
                        <a className={styles.chip} href={inboxURL({ collection: slug })} aria-current={filter === slug ? 'true' : undefined}>
                          {label(slug)}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {proposals.length + runs.length > 0 ? (
                  <ul className={styles.chips} aria-label="Filter by who started it">
                    <li>
                      <a className={styles.chip} href={inboxURL({ started: false })} aria-current={mine ? undefined : 'true'}>
                        Anyone
                      </a>
                    </li>
                    <li>
                      <a className={styles.chip} href={inboxURL({ started: true })} aria-current={mine ? 'true' : undefined}>
                        Started by me
                      </a>
                    </li>
                  </ul>
                ) : null}
              </div>
            </div>
          </header>

          <section className={styles.section} aria-labelledby="inbox-review">
            <div className={styles.sectionHead}>
              <h2 id="inbox-review">To review</h2>
              <span className={styles.count}>{shownProposals.length === 0 ? '' : `${shownProposals.length}${proposals.length >= LIMIT ? '+' : ''}`}</span>
            </div>
            {shownProposals.length ? (
              <ul className={styles.list}>
                {shownProposals.map((p) => (
                  <li key={p.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <a className={styles.rowTitle} href={p.href}>
                        {p.title}
                      </a>
                      <div className={styles.rowSub}>
                        <span>{p.collectionLabel}</span>
                        {p.kind ? <span>{p.kind}</span> : null}
                        {p.agent ? <span>{p.agent}</span> : null}
                        {p.createdAt ? <span>{relative(p.createdAt, now)}</span> : null}
                        <span>{startedBy(p.startedBy)}</span>
                      </div>
                    </div>
                    <div className={styles.rowSide}>
                      <a className={`${styles.action} ${styles.actionPrimary}`} href={p.href}>
                        Review
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                {mine ? 'Nothing you started is waiting for review.' : filter ? `Nothing to review for ${label(filter).toLowerCase()}.` : 'Nothing to review. When an agent proposes a change it will appear here.'}
              </p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="inbox-progress">
            <div className={styles.sectionHead}>
              <h2 id="inbox-progress">In progress</h2>
              <span className={styles.count}>{shownRuns.length || ''}</span>
            </div>
            {shownRuns.length ? (
              <ul className={styles.list}>
                {shownRuns.map((r) => (
                  <li key={r.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <a className={styles.rowTitle} href={r.href}>
                        {r.title}
                      </a>
                      <div className={styles.rowSub}>
                        {r.collection ? <span>{r.collectionLabel}</span> : null}
                        {r.stage ? <span>{r.stage}</span> : null}
                        {r.now ? <span>Now: {r.now}</span> : null}
                        <span>{startedBy(r.startedBy)}</span>
                      </div>
                    </div>
                    <div className={styles.rowSide}>
                      <StatusTag value={r.status} map={RUN_STATUS_MAP} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>{mine ? 'Nothing you started is running.' : 'No agents are working right now.'}</p>
            )}
          </section>
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

type Labeler = (slug: string) => string

async function loadProposals(req: PayloadRequest, slug: string, adminRoute: string, label: Labeler): Promise<ProposalRow[]> {
  if (!req.payload.collections[slug as CollectionSlug]) return []
  try {
    const { docs } = await req.payload.find({
      collection: slug as CollectionSlug,
      where: { status: { equals: 'open' } } as never,
      sort: '-createdAt',
      limit: LIMIT,
      // The run (one level) says who started the work.
      depth: 1,
      req,
      overrideAccess: false,
    })
    return docs.map((d) => {
      const doc = d as unknown as Record<string, unknown> & { id: string | number }
      const collection = typeof doc.targetCollection === 'string' ? doc.targetCollection : ''
      return {
        id: String(doc.id),
        title: typeof doc.title === 'string' ? doc.title : `Proposal #${String(doc.id)}`,
        collection,
        collectionLabel: label(collection),
        kind: typeof doc.kind === 'string' ? doc.kind : undefined,
        agent: typeof doc.agent === 'string' ? doc.agent : undefined,
        createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
        href: `${adminRoute}/collections/${slug}/${String(doc.id)}`,
        startedBy: idOf((doc.run as { triggeredBy?: unknown } | null | undefined)?.triggeredBy),
      }
    })
  } catch {
    return []
  }
}

async function loadRuns(req: PayloadRequest, slug: string, adminRoute: string, label: Labeler): Promise<RunRow[]> {
  if (!req.payload.collections[slug as CollectionSlug]) return []
  try {
    const { docs } = await req.payload.find({
      collection: slug as CollectionSlug,
      where: { status: { in: [...ACTIVE_RUN_STATUSES] } } as never,
      sort: '-updatedAt',
      limit: LIMIT,
      depth: 0,
      req,
      overrideAccess: false,
    })
    return docs.map((d) => {
      const doc = d as unknown as Record<string, unknown> & { id: string | number }
      const collection = typeof doc.targetCollection === 'string' ? doc.targetCollection : ''
      return {
        id: String(doc.id),
        title: typeof doc.title === 'string' ? doc.title : `Run #${String(doc.id)}`,
        collection,
        collectionLabel: label(collection),
        stage: typeof doc.stage === 'string' && doc.stage ? doc.stage : undefined,
        now: typeof doc.now === 'string' && doc.now ? doc.now : undefined,
        status: typeof doc.status === 'string' ? doc.status : 'queued',
        href: `${adminRoute}/collections/${slug}/${String(doc.id)}`,
        startedBy: idOf(doc.triggeredBy),
      }
    })
  } catch {
    return []
  }
}

/** Display names for the people who started work, read with the viewer's access. */
async function namesOf(req: PayloadRequest, ids: (string | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (!unique.length) return {}
  try {
    const { docs } = await req.payload.find({
      collection: (req.payload.config.admin.user ?? 'users') as CollectionSlug,
      where: { id: { in: unique } },
      depth: 0,
      limit: unique.length,
      pagination: false,
      req,
      overrideAccess: false,
    })
    return Object.fromEntries(docs.map((d) => [String(d.id), String((d as { name?: string; email?: string }).name || (d as { email?: string }).email || d.id)]))
  } catch {
    return {}
  }
}
