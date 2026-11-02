'use client'

import { createContext, lazy, Suspense, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth, useSearchParams } from '@payloadcms/ui'

import { HELP_PARAM, HELP_PREVIEW_PARAM } from '../help/shared'
import styles from './Help.module.css'

const HelpReader = lazy(() => import('./HelpReader').then((module) => ({ default: module.HelpReader })))

export const HELP_DRAWER_ID = 'sitekick-help-drawer'

const HelpContext = createContext<{ open: boolean; show: () => void }>({ open: false, show: () => {} })

/** Opens the help drawer from anywhere in the admin (sidebar link, welcome card). */
export const useHelp = () => useContext(HelpContext)

/**
 * Registered in `admin.components.providers`, so it lives outside the
 * replaceable views and keeps its state across navigation. Non-modal on
 * purpose: no backdrop, inert editor, scroll lock or focus trap, so a
 * person can read a step while they follow it.
 */
export function HelpProvider({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [sharedArticle, setSharedArticle] = useState<string>()
  const [sharedPreview, setSharedPreview] = useState<string>()
  const [revision, setRevision] = useState(0)
  const panel = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const show = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setLoaded(true)
    setRevision((value) => value + 1)
    setOpen(true)
  }
  const minimize = () => {
    setOpen(false)
    const trigger = opener.current?.isConnected
      ? opener.current
      : document.querySelector<HTMLElement>(`[aria-controls="${HELP_DRAWER_ID}"]`)
    trigger?.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true })
  }, [open])
  // The sidebar's "Get help" link (and anything else) can open the drawer without a React import.
  const onOpenEvent = useEffectEvent(() => show())
  useEffect(() => {
    const handler = () => onOpenEvent()
    window.addEventListener('sitekick:help:open', handler)
    return () => window.removeEventListener('sitekick:help:open', handler)
  }, [])

  return (
    <HelpContext.Provider value={{ open, show }}>
      {children}
      {user ? (
        <Suspense fallback={null}>
          <SharedLinkLauncher
            onLaunch={(article, preview) => {
              setSharedArticle(article)
              setSharedPreview(preview)
              setExpanded(true)
              show()
            }}
          />
        </Suspense>
      ) : null}
      {user && loaded
        ? createPortal(
            <aside
              id={HELP_DRAWER_ID}
              ref={panel}
              hidden={!open}
              inert={!open}
              aria-hidden={!open}
              className={`${styles.drawer} ${expanded ? styles.expanded : ''}`}
              role="dialog"
              aria-modal="false"
              aria-label="Help"
              tabIndex={-1}
              onKeyDown={(event) => {
                // Escape inside the editor belongs to its own controls, not this panel.
                if (event.key === 'Escape' && !event.defaultPrevented) {
                  event.stopPropagation()
                  minimize()
                }
              }}
            >
              <Suspense fallback={<p className={styles.loading} role="status">Loading help…</p>}>
                <HelpReader
                  key={`${user.id}:${sharedArticle ?? 'local'}:${sharedPreview ?? 'published'}`}
                  open={open}
                  revision={revision}
                  preview={sharedPreview}
                  initialArticle={sharedArticle === 'all' ? undefined : sharedArticle}
                  expanded={expanded}
                  onToggleExpanded={() => setExpanded((value) => !value)}
                  onMinimize={minimize}
                />
              </Suspense>
            </aside>,
            document.body,
          )
        : null}
    </HelpContext.Provider>
  )
}

/**
 * Shared links (`?help=<id>`, plus `?helpPreview=<docId>` from the Preview
 * button) open the drawer after hydration. Ordinary help use never changes
 * the editor's route.
 */
function SharedLinkLauncher({ onLaunch }: { onLaunch: (article: string, preview?: string) => void }) {
  const params = useSearchParams()
  const article = params.get(HELP_PARAM)
  const preview = params.get(HELP_PREVIEW_PARAM) ?? undefined
  const launch = useEffectEvent(onLaunch)
  useEffect(() => {
    if (article) launch(article, preview)
  }, [article, preview])
  return null
}
