'use client'

import { useEffect, useState } from 'react'
import { toast } from '@payloadcms/ui'

import { PROPOSAL_STATUS_MAP, computeStatus, isFinal, type Decision, type Decisions, type ProposalStatus } from '../../review/shared'
import { hostOf, readableExcerpt } from '../../review/shared'
import { StatusTag } from '../StatusTag'
import { relative, type FieldView, type ProposalView } from './model'
import styles from './review.module.css'
import { ProposalPreview, SectionList } from './Sections'
import { Value } from './Value'

/**
 * The interactive half of the proposal view. Decisions post to
 * `/api/proposals/:id/decide` and the page updates in place from the
 * response: status, the decided fields, and (for a Draft proposal) the
 * link to the document the first acceptance created.
 */
export function ProposalReviewClient({ initial }: { initial: ProposalView }) {
  const [view, setView] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => setNow(Date.now()), [])

  const final = isFinal(view.status)
  const pending = view.fields.filter((f) => !view.decisions[f.path])
  const patchShape = Object.fromEntries(view.fields.map((f) => [f.path, { value: null }]))

  const decide = async (decisions: Decisions, label: string) => {
    if (busy) return
    setBusy(label)
    try {
      const res = await fetch(view.decideURL, {
        method: 'post',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      })
      const json = (await res.json()) as { error?: string; status?: ProposalStatus; decisions?: Decisions; targetId?: string | null; reviewedAt?: string }
      if (!res.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`)
        return
      }
      const merged = json.decisions ?? { ...view.decisions, ...decisions }
      setView((v) => ({
        ...v,
        status: json.status ?? computeStatus(patchShape, merged),
        decisions: merged,
        reviewedAt: json.reviewedAt ?? v.reviewedAt,
        target:
          !v.target.doc && json.targetId
            ? { ...v.target, doc: { title: `New ${v.target.collectionLabel.toLowerCase()}`, href: `${v.adminRoute}/collections/${v.target.collectionSlug}/${json.targetId}` } }
            : v.target,
      }))
      const accepted = Object.values(decisions).filter((d) => d === 'accepted').length
      const rejected = Object.values(decisions).length - accepted
      toast.success(
        accepted && rejected
          ? `${accepted} accepted, ${rejected} rejected.`
          : accepted
            ? `${accepted === 1 ? 'Field' : `${accepted} fields`} accepted and saved as a draft.`
            : `${rejected === 1 ? 'Field' : `${rejected} fields`} rejected.`,
      )
    } catch (err) {
      toast.error(`That did not go through: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const decideAll = (d: Decision) => decide(Object.fromEntries(pending.map((f) => [f.path, d])), `all:${d}`)

  return (
    <>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{view.title}</h1>
          <p className={styles.lede}>
            {view.target.doc ? (
              <>
                For {view.target.collectionLabel.toLowerCase()} <a href={view.target.doc.href}>{view.target.doc.title}</a>.
              </>
            ) : (
              <>A new {view.target.collectionLabel.toLowerCase()}, created as a draft when you accept the first field.</>
            )}{' '}
            {view.run ? (
              <>
                From <a href={view.run.href}>{view.run.title}</a>.
              </>
            ) : null}
          </p>
          <ul className={styles.meta}>
            <li>
              <StatusTag value={view.status} map={PROPOSAL_STATUS_MAP} />
            </li>
            {view.kind ? <li>{view.kind}</li> : null}
            {view.agent ? (
              <li>
                <span className={styles.metaKey}>Agent</span> {view.agent}
              </li>
            ) : null}
            {view.createdAt ? (
              <li>
                <span className={styles.metaKey}>Proposed</span> <span suppressHydrationWarning>{relative(view.createdAt, now)}</span>
              </li>
            ) : null}
            {view.reviewedAt ? (
              <li>
                <span className={styles.metaKey}>Reviewed</span> <span suppressHydrationWarning>{relative(view.reviewedAt, now)}</span>
                {view.reviewedBy ? ` by ${view.reviewedBy}` : ''}
              </li>
            ) : null}
          </ul>
        </div>
        {!final && pending.length > 0 ? (
          <div className={styles.actions}>
            <button type="button" className={`${styles.action} ${styles.actionPrimary}`} disabled={Boolean(busy)} onClick={() => decideAll('accepted')}>
              Accept all{pending.length < view.fields.length ? ` (${pending.length})` : ''}
            </button>
            <button type="button" className={styles.action} disabled={Boolean(busy)} onClick={() => decideAll('rejected')}>
              Reject all
            </button>
          </div>
        ) : null}
      </header>

      {view.summary ? <p className={styles.summary}>{view.summary}</p> : null}

      {view.fields.length === 0 ? <p className={styles.emptyState}>This proposal has no fields to review.</p> : null}

      {view.fields.map((field) => (
        <FieldCard
          key={field.path}
          field={field}
          decision={view.decisions[field.path]}
          locked={final || Boolean(busy)}
          busy={busy === field.path}
          now={now}
          preview={field.sections && !final ? view.preview : undefined}
          onDecide={(d) => decide({ [field.path]: d }, field.path)}
        />
      ))}
    </>
  )
}

function FieldCard({
  field,
  decision,
  locked,
  busy,
  now,
  preview,
  onDecide,
}: {
  field: FieldView
  decision: Decision | undefined
  locked: boolean
  busy: boolean
  now: number
  preview?: { proposed: string; current: string }
  onDecide: (d: Decision) => void
}) {
  return (
    <section className={styles.card} data-decision={decision} aria-busy={busy}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{field.label}</h2>
        <div className={styles.choice} role="group" aria-label={`Decide on ${field.label}`}>
          <button
            type="button"
            className={`${styles.action} ${styles.actionAccept}`}
            aria-pressed={decision === 'accepted'}
            disabled={locked || decision !== undefined}
            onClick={() => onDecide('accepted')}
          >
            {decision === 'accepted' ? 'Accepted' : 'Accept'}
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionReject}`}
            aria-pressed={decision === 'rejected'}
            disabled={locked || decision !== undefined}
            onClick={() => onDecide('rejected')}
          >
            {decision === 'rejected' ? 'Rejected' : 'Reject'}
          </button>
        </div>
      </div>
      {field.sections ? (
        <>
          <SectionList sections={field.sections} />
          {preview ? <ProposalPreview urls={preview} /> : null}
        </>
      ) : (
        <div className={styles.diff}>
          <div className={styles.pane} data-side="current">
            <span className={styles.paneLabel}>Now</span>
            <Value value={field.current} />
          </div>
          <div className={styles.pane} data-side="proposed">
            <span className={styles.paneLabel}>Proposed</span>
            <Value value={field.proposed} />
          </div>
        </div>
      )}
      {field.note ? (
        <p className={styles.note}>
          <b>Why:</b> {field.note}
        </p>
      ) : null}
      {field.receipts.length ? (
        <ul className={styles.receipts} aria-label="Sources">
          {field.receipts.map((r, i) => (
            <li key={`${r.url}:${i}`} className={styles.receipt}>
              <div className={styles.receiptHead}>
                {/^https?:/.test(r.url) ? (
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.title?.trim() || hostOf(r.url)}
                  </a>
                ) : (
                  // Notes, transcripts and editor text: provided, not fetched, and nothing to link to.
                  <span>{r.title?.trim() || r.url.replace(/:$/, '')}</span>
                )}
                <span className={styles.receiptWhen} suppressHydrationWarning>
                  {/^https?:/.test(r.url) ? 'fetched' : 'provided'} {relative(r.fetchedAt, now)}
                </span>
              </div>
              {r.excerpt ? <blockquote>{readableExcerpt(r.excerpt)}</blockquote> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
