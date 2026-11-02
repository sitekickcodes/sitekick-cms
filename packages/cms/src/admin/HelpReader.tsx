'use client'

import { useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'

import { HELP_SLUG, type HelpArticle } from '../help/shared'
import { HelpPanel } from './HelpPanel'

/** Loads the articles each time the drawer opens; the panel keeps its place. */
export function HelpReader({
  open,
  revision,
  preview,
  collection = HELP_SLUG,
  ...props
}: {
  open: boolean
  revision: number
  preview?: string
  collection?: string
  initialArticle?: string
  expanded: boolean
  onToggleExpanded: () => void
  onMinimize: () => void
}) {
  const { config } = useConfig()
  const [articles, setArticles] = useState<HelpArticle[] | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const api = config.routes.api

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const query = preview ? `?preview=${encodeURIComponent(preview)}` : ''
        const response = await fetch(`${api}/${collection}/reader${query}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Unable to load help')
        const data = (await response.json()) as { articles: HelpArticle[] }
        if (!Array.isArray(data.articles)) throw new Error('Invalid help response')
        if (!controller.signal.aborted) {
          setArticles(data.articles)
          setError(false)
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [open, revision, preview, api, collection, retry])

  return (
    <HelpPanel
      {...props}
      articles={articles ?? []}
      loading={!articles && !error}
      error={error}
      preview={Boolean(preview)}
      onRetry={() => {
        setError(false)
        setRetry((value) => value + 1)
      }}
    />
  )
}
