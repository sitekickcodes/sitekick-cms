'use client'

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth, useConfig, useRouter } from '@payloadcms/ui'

import type { PaletteClientOptions } from '../palette'
import { buildCommands, docCommand, PALETTE_OPEN_EVENT, rank, searchURL, searchable, type Command, type PaletteCollection } from '../palette/commands'
import styles from './CommandPalette.module.css'

/**
 * Cmd+K / Ctrl+K. Static commands rank instantly; document search across
 * readable collections runs after a short pause, one REST call per
 * collection, cancelled when the query moves on. Keyboard: arrows, Enter,
 * Escape; `aria-activedescendant` so a screen reader follows the cursor.
 */
export function CommandPalette({ children }: { children?: ReactNode }) {
  const { user, permissions } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [docs, setDocs] = useState<Command[]>([])
  const [searching, setSearching] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const sitekick = (config.admin as { custom?: { sitekick?: { palette?: PaletteClientOptions; agents?: { draft?: string[] } } } }).custom?.sitekick
  const custom = sitekick?.palette
  const draftable = sitekick?.agents?.draft
  const adminRoute = config.routes.admin
  const apiRoute = `${config.serverURL ?? ''}${config.routes.api}`

  const collections = useMemo<PaletteCollection[]>(
    () =>
      config.collections.map((c) => ({
        slug: c.slug,
        labels: { singular: text(c.labels?.singular, c.slug), plural: text(c.labels?.plural, c.slug) },
        useAsTitle: c.admin?.useAsTitle,
        listSearchableFields: c.admin?.listSearchableFields,
        canRead: Boolean(permissions?.collections?.[c.slug]?.read),
        canCreate: Boolean(permissions?.collections?.[c.slug]?.create),
        isUpload: Boolean(c.upload),
        isAuth: Boolean(c.auth),
        draftable: Boolean(draftable?.includes(c.slug)),
      })),
    [config.collections, permissions, draftable],
  )
  const statics = useMemo(
    () =>
      buildCommands({
        adminRoute,
        collections,
        globals: config.globals.map((g) => ({ slug: g.slug, label: text(g.label, g.slug), canRead: Boolean(permissions?.globals?.[g.slug]?.read) })),
        views: custom?.views ?? [],
        accountPath: config.admin.routes.account,
        logoutPath: config.admin.routes.logout,
        help: custom?.help ?? true,
      }),
    [adminRoute, collections, config.globals, config.admin.routes, permissions, custom],
  )

  const results = useMemo(() => {
    const ranked = rank(statics, query, query.trim() ? 8 : 14)
    return query.trim() ? [...docs, ...ranked] : ranked
  }, [statics, docs, query])

  // Open from the keyboard or from anything that dispatches the event (sidebar row).
  const show = useEffectEvent(() => {
    setQuery('')
    setDocs([])
    setCursor(0)
    setOpen(true)
  })
  useEffect(() => {
    // Capture phase on window, then stop the event: Payload 4 ships its own
    // Cmd+K palette (a `document` keydown listener in `useHotkey`) and the
    // two must not open together. EXCEPTION: behavioural coupling to Payload's
    // hotkey; if a bump moves theirs to the capture phase, revisit.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.altKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (open) setOpen(false)
        else show()
      }
    }
    const onEvent = () => show()
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener(PALETTE_OPEN_EVENT, onEvent)
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      window.removeEventListener(PALETTE_OPEN_EVENT, onEvent)
    }
  }, [open])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // Document search: 180ms after the last keystroke, every searchable collection at once.
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2) {
      setDocs([])
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      const found = await Promise.all(
        searchable(collections).map(async (c) => {
          try {
            const res = await fetch(searchURL(apiRoute, c, q), { credentials: 'include', signal: ctrl.signal })
            if (!res.ok) return []
            const data = (await res.json()) as { docs?: Record<string, unknown>[] }
            return (data.docs ?? []).map((d) => docCommand(adminRoute, c, d))
          } catch {
            return []
          }
        }),
      )
      if (ctrl.signal.aborted) return
      setDocs(found.flat().slice(0, 10))
      setSearching(false)
      setCursor(0)
    }, 180)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, open, collections, apiRoute, adminRoute])

  const run = (cmd: Command) => {
    setOpen(false)
    if (cmd.href) router.push(cmd.href)
    else if (cmd.event) window.dispatchEvent(new CustomEvent(cmd.event))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = results[cursor]
      if (cmd) run(cmd)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-${cursor}`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open, listId])

  return (
    <>
      {children}
      {user && open
        ? createPortal(
            <div className={styles.dialog} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Command palette">
                <div className={styles.inputRow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={input}
                    className={styles.input}
                    role="combobox"
                    aria-expanded
                    aria-controls={listId}
                    aria-activedescendant={results[cursor] ? `${listId}-${cursor}` : undefined}
                    aria-autocomplete="list"
                    placeholder="Jump to a page, document or action…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setCursor(0)
                    }}
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <kbd className={styles.kbd}>esc</kbd>
                </div>
                <ul id={listId} role="listbox" className={styles.list}>
                  {results.length === 0 ? (
                    <li className={styles.empty}>{searching ? 'Searching…' : `Nothing matches “${query}”.`}</li>
                  ) : (
                    results.map((cmd, i) => {
                      const first = i === 0 || results[i - 1]?.group !== cmd.group
                      return (
                        <li key={cmd.id} role="presentation">
                          {first ? <div className={styles.groupTitle}>{cmd.group}</div> : null}
                          <div
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === cursor}
                            className={styles.item}
                            onMouseMove={() => setCursor(i)}
                            onClick={() => run(cmd)}
                          >
                            <span className={styles.label}>{cmd.label}</span>
                            {cmd.hint ? <span className={styles.hint}>{cmd.hint}</span> : null}
                          </div>
                        </li>
                      )
                    })
                  )}
                </ul>
                <div className={styles.status} role="status" aria-live="polite">
                  {searching ? 'Searching' : `${results.length} results`}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)
