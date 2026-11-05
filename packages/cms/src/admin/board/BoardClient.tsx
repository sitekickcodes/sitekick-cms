'use client'

import { Button, toast, useStepNav } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { relative } from '../review/model'
import { Tag, type Tone } from '../StatusTag'
import styles from './board.module.css'
import { COLUMNS, confirmOf, errorOf, moveOf, requestOf, type Card, type Column, type Move } from './model'

const TONE: Record<Column, Tone> = { draft: 'neutral', changed: 'warning', published: 'success' }
const ACTION: Record<Column, { to: Column; label: string }> = {
  draft: { to: 'published', label: 'Publish' },
  changed: { to: 'published', label: 'Publish changes' },
  published: { to: 'draft', label: 'Unpublish' },
}

type Props = {
  apiRoute: string
  cards: Card[]
  canUpdate: boolean
  collection: string
  createURL: string
  listURL: string
  now: number
  plural: string
  singular: string
  totals: Record<Column, number>
}

/**
 * The board: a column per status, a card per document. Dragging a card to Published (or
 * its Publish button) publishes the latest draft; to Draft unpublishes. Every move is
 * confirmed first, because it changes the live site. Phones and keyboards use the buttons.
 */
export function BoardClient({ apiRoute, cards: initial, canUpdate, collection, createURL, listURL, now, plural, singular, totals }: Props) {
  const router = useRouter()
  const { setStepNav } = useStepNav()
  const dialog = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [cards, setCards] = useState(initial)
  const [dragging, setDragging] = useState<Card | null>(null)
  const [over, setOver] = useState<Column | null>(null)
  const [pending, setPending] = useState<{ card: Card; to: Column; move: Move } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => setCards(initial), [initial])
  useEffect(() => setStepNav([{ label: plural, url: listURL }, { label: 'Board' }]), [setStepNav, plural, listURL])

  const ask = (card: Card, to: Column) => {
    const move = moveOf(card.column, to)
    if (!move || !canUpdate) return
    setPending({ card, to, move })
    dialog.current?.showModal()
  }

  const confirm = async () => {
    if (!pending) return
    const { card, to, move } = pending
    setBusy(true)
    try {
      const { path, body } = requestOf(collection, card.id, move)
      const res = await fetch(formatAdminURL({ apiRoute, path }), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(errorOf(await res.json().catch(() => null), res.status))
      setCards((all) => all.map((c) => (c.id === card.id ? { ...c, column: to, updatedAt: new Date().toISOString() } : c)))
      toast.success(move === 'publish' ? `“${card.title}” is live.` : `“${card.title}” is off the site.`)
      dialog.current?.close()
      router.refresh()
    } catch (err) {
      toast.error(`Couldn’t ${move} “${card.title}”. ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const text = pending ? confirmOf(pending.move, pending.card.title, pending.card.column, singular) : null
  // Optimistic moves shift counts until the refresh lands.
  const counts = Object.fromEntries(
    COLUMNS.map(({ key }) => [key, totals[key] + cards.filter((c) => c.column === key).length - initial.filter((c) => c.column === key).length]),
  ) as Record<Column, number>

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{plural}</h1>
          <p className={styles.lede}>
            {canUpdate ? 'Drag a card to Published to put it on the site, or to Draft to take it down. You confirm each move.' : 'Where each one stands.'}
          </p>
        </div>
        <div className={styles.actions}>
          <Button el="link" url={listURL} buttonStyle="secondary" size="medium" margin={false}>
            List
          </Button>
          <Button el="link" url={createURL} buttonStyle="primary" size="medium" margin={false}>
            Create New
          </Button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((column) => {
          const shown = cards.filter((c) => c.column === column.key)
          const droppable = dragging !== null && moveOf(dragging.column, column.key) !== null
          const more = counts[column.key] - shown.length
          return (
            <section
              key={column.key}
              className={styles.column}
              aria-labelledby={`${ids}-${column.key}`}
              data-drop={droppable ? (over === column.key ? 'over' : 'ok') : undefined}
              onDragOver={(e) => {
                if (!droppable) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (over !== column.key) setOver(column.key)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                if (dragging) ask(dragging, column.key)
                setDragging(null)
              }}
            >
              <div className={styles.columnHead}>
                <h2 id={`${ids}-${column.key}`}>
                  <Tag label={column.label} tone={TONE[column.key]} />
                </h2>
                <span className={styles.count}>{counts[column.key] || ''}</span>
              </div>
              <p className={styles.hint}>{column.hint}</p>
              {shown.length ? (
                <ul className={styles.cards}>
                  {shown.map((card) => (
                    <li
                      key={card.id}
                      className={styles.card}
                      draggable={canUpdate}
                      data-dragging={dragging?.id === card.id || undefined}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(card.id))
                        setDragging(card)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                    >
                      {card.image ? <img className={styles.thumb} src={card.image} alt="" loading="lazy" draggable={false} /> : null}
                      <div className={styles.cardMain}>
                        <a className={styles.cardTitle} href={card.href} draggable={false}>
                          {card.title}
                        </a>
                        {card.updatedAt ? <span className={styles.when}>Edited {relative(card.updatedAt, now)}</span> : null}
                      </div>
                      {canUpdate ? (
                        <button type="button" className={styles.move} onClick={() => ask(card, ACTION[card.column].to)}>
                          {ACTION[card.column].label}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>{droppable ? 'Drop here' : `No ${column.label.toLowerCase()} ${plural.toLowerCase()}.`}</p>
              )}
              {more > 0 ? (
                <a className={styles.more} href={`${listURL}?where[_status][equals]=${column.key === 'published' ? 'published' : 'draft'}`}>
                  See all in the list
                </a>
              ) : null}
            </section>
          )
        })}
      </div>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${ids}-confirm`}
        onClose={() => setPending(null)}
        onClick={(e) => e.target === dialog.current && !busy && dialog.current?.close()}
      >
        {text ? (
          <div className={styles.confirm}>
            <h2 id={`${ids}-confirm`}>{text.heading}</h2>
            <p>{text.body}</p>
            <footer>
              <Button type="button" buttonStyle="secondary" size="medium" margin={false} disabled={busy} onClick={() => dialog.current?.close()}>
                Cancel
              </Button>
              <Button type="button" buttonStyle="primary" size="medium" margin={false} disabled={busy} onClick={() => void confirm()}>
                {busy ? `${text.action === 'Publish' ? 'Publishing' : 'Unpublishing'}…` : text.action}
              </Button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
