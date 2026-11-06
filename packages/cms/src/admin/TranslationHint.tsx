'use client'

import { useConfig, useDocumentInfo, useDocumentTitle, useFormFields, useLocale } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useEffect, useState } from 'react'

import styles from './TranslationHint.module.css'

/**
 * Under a translated field (recipes/localization.ts adds it), while it is still empty in
 * the language being edited: what it says in the default language, so a translator works
 * from the original instead of switching back and forth. On the title field it also stands in
 * for the page's heading, which Payload would otherwise show as the document's id.
 */
export function TranslationHint({ path }: { path: string }) {
  const code = useLocale()?.code
  const { config } = useConfig()
  const { id, collectionSlug, globalSlug } = useDocumentInfo()
  const value = useFormFields(([fields]) => fields[path]?.value)
  const localization = config.localization
  const defaultLocale = localization ? localization.defaultLocale : undefined
  const other = Boolean(defaultLocale && code && code !== defaultLocale)
  const source = useSourceDoc(other ? { api: config.routes.api, collectionSlug, globalSlug, id, locale: defaultLocale! } : null)
  const { title, setDocumentTitle } = useDocumentTitle()
  const docConfig = collectionSlug ? config.collections.find((c) => c.slug === collectionSlug) : undefined
  const original = other && isEmpty(value) ? textOf(valueAt(source, path)) : ''
  const isTitle = docConfig?.admin?.useAsTitle === path
  useEffect(() => {
    // Payload falls back to the id when the title is blank in this language.
    if (isTitle && original && id !== undefined && title === String(id)) setDocumentTitle(original)
  }, [isTitle, original, id, title, setDocumentTitle])

  if (!original) return null
  const language = localization ? (localization.locales.find((l) => l.code === defaultLocale)?.label ?? defaultLocale) : defaultLocale
  return (
    <p className={styles.hint}>
      <span className={styles.lang}>{typeof language === 'string' ? language : defaultLocale}</span>
      <span className={styles.text}>{original.length > 280 ? `${original.slice(0, 278)}…` : original}</span>
    </p>
  )
}

type Source = { api: string; collectionSlug?: string; globalSlug?: string; id?: number | string; locale: string }

/** One request per document and language, shared by every hint on the page. */
const cache = new Map<string, Promise<unknown>>()

function useSourceDoc(source: Source | null): unknown {
  const [doc, setDoc] = useState<unknown>(null)
  const key = source ? `${source.collectionSlug ?? `globals/${source.globalSlug}`}:${source.id ?? ''}:${source.locale}` : null
  useEffect(() => {
    if (!source || !key || (!source.id && !source.globalSlug)) return
    let live = true
    const path = source.globalSlug ? `/globals/${source.globalSlug}` : `/${source.collectionSlug}/${source.id}`
    if (!cache.has(key)) {
      const url = `${formatAdminURL({ apiRoute: source.api, path: path as `/${string}` })}?locale=${encodeURIComponent(source.locale)}&depth=0&draft=true&fallback-locale=none`
      cache.set(key, fetch(url, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    }
    void cache.get(key)!.then((d) => live && setDoc(d))
    return () => {
      live = false
    }
    // `key` covers `source`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return doc
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (typeof v === 'object' && textOf(v) === '')

/** `layout.0.heading` in a document: block structure is shared, so the same path works. */
export function valueAt(doc: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), doc)
}

/** Text of a string, or of a rich text tree. */
export function textOf(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (!v || typeof v !== 'object') return ''
  const blocks = new Set(['paragraph', 'heading', 'listitem', 'quote'])
  const walk = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: unknown; children?: unknown[]; root?: unknown }
    if (typeof n.text === 'string') return n.text
    if (n.root) return walk(n.root)
    const inner = (n.children ?? []).map(walk).join('')
    return n.type && blocks.has(n.type) ? `${inner} ` : inner
  }
  return walk(v).replace(/\s+/g, ' ').trim()
}
