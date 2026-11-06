'use client'

import { useEffect, useState } from 'react'
import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

import { ACTIVE_RUN_STATUSES, RUN_STATUS_MAP, asQuestion, asSteps, type RunStatus, type RunStep } from '../../review/shared'
import { StatusTag } from '../StatusTag'
import { money, relative, type RunView } from './model'
import styles from './review.module.css'
import { useInboxCrumbs } from './useInboxCrumbs'

const POLL_MS = 3000

/**
 * The live half of the run view: polls the run every 3 s while it is
 * queued, running or waiting; answers a question with one click; cancels
 * and retries through the run endpoints. The spinner is a steady dot when
 * the person prefers reduced motion (CSS).
 */
export function RunReviewClient({ initial }: { initial: RunView }) {
  useInboxCrumbs(initial.title)
  const router = useRouter()
  const [run, setRun] = useState(initial)
  // A server refresh (below) re-resolves the target and proposal links.
  useEffect(() => setRun(initial), [initial])
  const [busy, setBusy] = useState<string | null>(null)
  const [free, setFree] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => setNow(Date.now()), [])

  const active = ACTIVE_RUN_STATUSES.includes(run.status)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(run.readURL, { credentials: 'include', headers: { Accept: 'application/json' } })
        if (!res.ok || cancelled) return
        const doc = (await res.json()) as Record<string, unknown>
        if (!cancelled) setRun((r) => merge(r, doc))
        setNow(Date.now())
        // Settled: the proposal link only resolves on the server.
        if (!cancelled && typeof doc.status === 'string' && !ACTIVE_RUN_STATUSES.includes(doc.status as RunStatus)) router.refresh()
      } catch {
        // A missed poll is nothing to report; the next one will catch up.
      }
    }
    const timer = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [active, run.readURL, router])

  const act = async (action: 'answer' | 'cancel' | 'retry', body?: Record<string, unknown>, done?: string) => {
    if (busy) return
    setBusy(action)
    try {
      const res = await fetch(`${run.actionsURL}/${action}`, {
        method: 'post',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const json = (await res.json()) as { error?: string; run?: Record<string, unknown> }
      if (!res.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`)
        return
      }
      if (json.run) setRun((r) => merge(r, json.run ?? {}))
      setNow(Date.now())
      setFree('')
      if (done) toast.success(done)
    } catch (err) {
      toast.error(`That did not go through: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className={styles.head}>
        <div>
          <p className={styles.lede}>
            {run.target ? (
              <>
                On <a href={run.target.href}>{run.target.title}</a>.{' '}
              </>
            ) : null}
            {run.proposal ? (
              <>
                Produced <a href={run.proposal.href}>{run.proposal.title}</a>, ready to review.
              </>
            ) : null}
          </p>
          <ul className={styles.meta}>
            <li>
              <StatusTag value={run.status} map={RUN_STATUS_MAP} />
            </li>
            {run.stage ? (
              <li>
                <span className={styles.metaKey}>Stage</span> {run.stage}
              </li>
            ) : null}
            <li>
              <span className={styles.metaKey}>Agent</span> {run.kind}
            </li>
            {run.model ? (
              <li>
                <span className={styles.metaKey}>Model</span> {run.model}
              </li>
            ) : null}
            {run.costUsd !== undefined ? (
              <li>
                <span className={styles.metaKey}>Cost</span> {money(run.costUsd)}
              </li>
            ) : null}
            <li>
              <span className={styles.metaKey}>Attempts</span> {run.attempts}
            </li>
            {run.triggeredBy ? (
              <li>
                <span className={styles.metaKey}>Started by</span> {run.triggeredBy}
              </li>
            ) : null}
            {run.updatedAt ? (
              <li>
                <span className={styles.metaKey}>Updated</span> <span suppressHydrationWarning>{relative(run.updatedAt, now)}</span>
              </li>
            ) : null}
          </ul>
        </div>
        <div className={styles.actions}>
          {run.proposal ? (
            <a className={`${styles.action} ${styles.actionPrimary}`} href={run.proposal.href}>
              Review proposal
            </a>
          ) : null}
          {active ? (
            <button type="button" className={`${styles.action} ${styles.actionDanger}`} disabled={Boolean(busy)} onClick={() => act('cancel', undefined, 'Run cancelled.')}>
              Cancel
            </button>
          ) : null}
          {run.status === 'failed' || run.status === 'cancelled' ? (
            <button type="button" className={`${styles.action} ${styles.actionPrimary}`} disabled={Boolean(busy)} onClick={() => act('retry', undefined, 'Queued again.')}>
              Retry
            </button>
          ) : null}
        </div>
      </header>

      {run.error ? <p className={styles.error}>{run.error}</p> : null}

      {run.question && run.status === 'waiting' ? (
        <section className={styles.question} aria-live="polite">
          <p>{run.question.text}</p>
          <div className={styles.options}>
            {run.question.options.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.action} ${styles.actionPrimary}`}
                disabled={Boolean(busy)}
                onClick={() => act('answer', { answer: option }, 'Answer sent; the run continues.')}
              >
                {option}
              </button>
            ))}
          </div>
          <form
            className={styles.free}
            onSubmit={(e) => {
              e.preventDefault()
              if (free.trim()) void act('answer', { answer: free.trim() }, 'Answer sent; the run continues.')
            }}
          >
            <input className={styles.input} value={free} onChange={(e) => setFree(e.target.value)} placeholder="Or type an answer" aria-label="Your answer" />
            <button type="submit" className={styles.action} disabled={Boolean(busy) || !free.trim()}>
              Send
            </button>
          </form>
        </section>
      ) : null}

      {run.answer && !run.question ? (
        <p className={styles.note}>
          <b>Your answer:</b> {run.answer}
        </p>
      ) : null}

      {run.now || active ? (
        <p className={styles.nowLine} aria-live="polite">
          {active ? <span className={styles.spinner} aria-hidden /> : null}
          <span>
            <b>Now:</b> {run.now ?? (run.status === 'queued' ? 'Waiting for a worker' : 'Working')}
          </span>
        </p>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Steps</h2>
        </div>
        {run.steps.length ? (
          <ol className={styles.timeline}>
            {run.steps.map((step, i) => (
              <Step key={`${step.at}:${i}`} step={step} now={now} />
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>Nothing yet.</p>
        )}
      </section>
    </>
  )
}

function Step({ step, now }: { step: RunStep; now: number }) {
  const glyph = step.status === 'done' ? '✓' : step.status === 'failed' ? '!' : step.status === 'skipped' ? '–' : ''
  return (
    <li className={styles.step}>
      <span className={styles.glyph} data-status={step.status} aria-label={step.status}>
        {step.status === 'running' ? <span className={styles.spinner} aria-hidden /> : glyph}
      </span>
      <span className={styles.stepLabel}>{step.label}</span>
      <span className={styles.stepWhen} suppressHydrationWarning>
        {relative(step.at, now)}
      </span>
      {step.detail ? <span className={styles.stepDetail}>{step.detail}</span> : null}
    </li>
  )
}

/** A polled or returned run document folded into the view; links stay as resolved by the server. */
function merge(view: RunView, doc: Record<string, unknown>): RunView {
  const s = (v: unknown, prev: string | undefined) => (typeof v === 'string' ? (v.trim() ? v : undefined) : prev)
  return {
    ...view,
    status: typeof doc.status === 'string' ? (doc.status as RunStatus) : view.status,
    stage: s(doc.stage, view.stage),
    now: s(doc.now, view.now),
    steps: doc.steps === undefined ? view.steps : asSteps(doc.steps),
    question: doc.question === undefined ? view.question : asQuestion(doc.question),
    answer: s(doc.answer, view.answer),
    costUsd: typeof doc.costUsd === 'number' ? doc.costUsd : view.costUsd,
    attempts: typeof doc.attempts === 'number' ? doc.attempts : view.attempts,
    model: s(doc.model, view.model),
    error: doc.error === null ? undefined : s(doc.error, view.error),
    updatedAt: s(doc.updatedAt, view.updatedAt),
  }
}
