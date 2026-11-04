import type { CollectionSlug, DocumentViewServerProps, PayloadRequest, SanitizedCollectionConfig } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { Gutter } from '@payloadcms/ui'

import { labelOf } from '../dashboard/data'
import { fieldAtPath, fieldLabel, renderValue, sectionChanges, type Rendered } from '../../review/render'
import { PROPOSALS_SLUG, asDecisions, asPatch, type ProposalStatus, type Receipt } from '../../review/shared'
import type { DocLink, FieldView, ProposalView } from './model'
import { ProposalReviewClient } from './ProposalReviewClient'
import styles from './review.module.css'

/**
 * The proposal edit view (`views.edit.default` of `proposals`). Payload
 * keeps its document header and tabs; this replaces the form with a card
 * per proposed field: the current value beside the proposed one, receipts,
 * and Accept / Reject. Titles, labels and thumbnails resolve here with the
 * editor's own access; the client half only posts decisions.
 */
export async function ProposalReview(props: DocumentViewServerProps) {
  const { doc, i18n, initPageResult, payload } = props
  const req = initPageResult.req
  const adminRoute = payload.config.routes.admin
  const apiRoute = payload.config.routes.api
  const collectionSlug = initPageResult.collectionConfig?.slug ?? PROPOSALS_SLUG
  const id = doc?.id

  if (id === undefined || id === null || id === '') {
    return (
      <Gutter>
        <div className={styles.root}>
          <p className={styles.emptyState}>Proposals are written by agents. Run an agent on a document and its proposal will appear in the Inbox.</p>
        </div>
      </Gutter>
    )
  }

  const patch = asPatch(doc.patch)
  const decisions = asDecisions(doc.decisions)
  const targetSlug = typeof doc.targetCollection === 'string' ? doc.targetCollection : ''
  const target = payload.collections[targetSlug as CollectionSlug]?.config
  const targetId = typeof doc.targetId === 'string' || typeof doc.targetId === 'number' ? doc.targetId : null
  const targetLabel = target ? labelOf(target.labels?.singular, i18n, targetSlug) : targetSlug || 'document'

  const targetDoc = target && targetId !== null ? await loadDoc(req, target, targetId, adminRoute) : null
  const runsSlug = runsSlugOf(initPageResult.collectionConfig)
  const runDoc = await loadLink(req, payload.collections[runsSlug as CollectionSlug]?.config, relId(doc.run), adminRoute)

  const fields: FieldView[] = await Promise.all(
    Object.entries(patch).map(async ([path, proposed]): Promise<FieldView> => {
      const field = target ? fieldAtPath(target.fields, path) : null
      const current = proposed.current !== undefined ? proposed.current : targetDoc ? valueAt(targetDoc.data, path) : undefined
      const sections = sectionChanges(field, current, proposed.value, i18n.language)
      return {
        path,
        label: target ? fieldLabel(target.fields, path, i18n.language) : path,
        ...(sections ? { sections } : {}),
        current: await resolveRef(req, renderValue(current, field), adminRoute),
        proposed: await resolveRef(req, renderValue(proposed.value, field), adminRoute),
        receipts: Array.isArray(proposed.receipts) ? proposed.receipts.filter(isReceipt) : [],
        note: typeof proposed.note === 'string' && proposed.note.trim() ? proposed.note : undefined,
      }
    }),
  )

  const view: ProposalView = {
    id: String(id),
    title: typeof doc.title === 'string' ? doc.title : `Proposal #${String(id)}`,
    status: (typeof doc.status === 'string' ? doc.status : 'open') as ProposalStatus,
    kind: typeof doc.kind === 'string' ? doc.kind : undefined,
    agent: typeof doc.agent === 'string' ? doc.agent : undefined,
    summary: typeof doc.summary === 'string' && doc.summary.trim() ? doc.summary : undefined,
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
    reviewedAt: typeof doc.reviewedAt === 'string' ? doc.reviewedAt : undefined,
    reviewedBy: await reviewerName(req, doc.reviewedBy),
    target: {
      collectionLabel: targetLabel,
      collectionSlug: targetSlug,
      doc: targetDoc ? targetDoc.link : null,
    },
    run: runDoc,
    fields,
    decisions,
    decideURL: formatAdminURL({ apiRoute, path: `/${collectionSlug}/${encodeURIComponent(String(id))}/decide` }),
    adminRoute,
    ...(fields.some((f) => f.sections) && target && targetDoc ? await previewURLs(req, target, targetDoc.data, String(id), firstChange(fields)) : {}),
  }

  return (
    <Gutter>
      <div className={styles.root}>
        <ProposalReviewClient initial={view} />
      </div>
    </Gutter>
  )
}

/**
 * The target's own preview URL (its `admin.preview`), and the same with
 * `proposal=<id>` added: the host's draft route forwards that parameter to the
 * page, which renders the proposal on top of the draft (see `applyProposalPreview`).
 */
async function previewURLs(
  req: PayloadRequest,
  target: SanitizedCollectionConfig,
  doc: Record<string, unknown>,
  proposalId: string,
  section: number | null,
): Promise<{ preview?: { proposed: string; current: string } }> {
  const preview = target.admin?.preview
  if (typeof preview !== 'function') return {}
  try {
    const current = await preview(doc, { locale: req.locale ?? 'en', req, token: null })
    if (typeof current !== 'string' || !current) return {}
    const url = new URL(current, req.payload.config.serverURL || 'http://localhost')
    url.searchParams.set('proposal', proposalId)
    // Open at the first changed section (the page scrolls its own window to the
    // blocks' `#section-<n>` anchor; a URL fragment would scroll this view too).
    if (section && section > 1) url.searchParams.set('section', String(section))
    const proposed = /^https?:/.test(current) ? url.toString() : `${url.pathname}${url.search}`
    return { preview: { proposed, current } }
  } catch {
    return {}
  }
}

/** 1-based position of the first added, changed or moved section in the proposed order. */
function firstChange(fields: FieldView[]): number | null {
  for (const f of fields) {
    const i = f.sections?.findIndex((s) => s.change !== 'same' && s.change !== 'removed') ?? -1
    if (i >= 0) return i + 1
  }
  return null
}

/** The runs slug the `run` relationship points at (configurable, so read it from the field). */
function runsSlugOf(config: SanitizedCollectionConfig | undefined): string {
  const field = config?.fields.find((f) => 'name' in f && f.name === 'run')
  const to = field && field.type === 'relationship' ? field.relationTo : undefined
  return typeof to === 'string' ? to : 'runs'
}

const isReceipt = (r: unknown): r is Receipt =>
  Boolean(r && typeof r === 'object' && typeof (r as Receipt).url === 'string')

/** A relationship value (id, or `{ relationTo, value }`) as its id. */
function relId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const v = value as { value?: unknown; id?: unknown }
    if (typeof v.value === 'string' || typeof v.value === 'number') return v.value
    if (typeof v.id === 'string' || typeof v.id === 'number') return v.id
  }
  return null
}

/** `doc["seo"]["title"]` for `seo.title`; arrays by index. */
function valueAt(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (!node || typeof node !== 'object') return undefined
    return Array.isArray(node) ? node[Number(key)] : (node as Record<string, unknown>)[key]
  }, data)
}

function titleOf(config: SanitizedCollectionConfig, data: Record<string, unknown>, fallback: string): string {
  const key = config.admin?.useAsTitle || 'id'
  const raw = valueAt(data, key)
  return typeof raw === 'string' && raw.trim() ? raw : typeof raw === 'number' ? String(raw) : fallback
}

/** A document the editor may read, as its latest draft, with a link to edit it. */
async function loadDoc(
  req: PayloadRequest,
  config: SanitizedCollectionConfig,
  id: string | number,
  adminRoute: string,
): Promise<{ data: Record<string, unknown>; link: DocLink } | null> {
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
    return { data, link: { title: titleOf(config, data, `#${String(id)}`), href: `${adminRoute}/collections/${config.slug}/${String(id)}` } }
  } catch {
    return null
  }
}

async function loadLink(req: PayloadRequest, config: SanitizedCollectionConfig | undefined, id: string | number | null, adminRoute: string): Promise<DocLink | null> {
  if (!config || id === null) return null
  const loaded = await loadDoc(req, config, id, adminRoute)
  return loaded?.link ?? null
}

/** A `ref` value with the related document's title and, for uploads, its thumbnail. */
async function resolveRef(req: PayloadRequest, value: Rendered, adminRoute: string): Promise<Rendered> {
  if (value.kind !== 'ref') return value
  const config = req.payload.collections[value.collection as CollectionSlug]?.config
  if (!config) return value
  const loaded = await loadDoc(req, config, value.id, adminRoute)
  if (!loaded) return value
  const isUpload = Boolean(config.upload)
  const thumb = loaded.data.thumbnailURL ?? loaded.data.url
  const name = isUpload ? (typeof loaded.data.filename === 'string' ? loaded.data.filename : loaded.link.title) : loaded.link.title
  return {
    ...value,
    label: isUpload ? `Media #${value.id} · ${name}` : name,
    src: isUpload && typeof thumb === 'string' ? thumb : undefined,
  }
}

async function reviewerName(req: PayloadRequest, value: unknown): Promise<string | undefined> {
  const id = relId(value)
  if (id === null) return undefined
  const usersSlug = req.payload.config.admin.user
  const config = req.payload.collections[usersSlug as CollectionSlug]?.config
  if (!config) return undefined
  const loaded = await loadDoc(req, config, id, req.payload.config.routes.admin)
  if (!loaded) return undefined
  const { name, email } = loaded.data
  return typeof name === 'string' && name.trim() ? name : typeof email === 'string' ? email : loaded.link.title
}
