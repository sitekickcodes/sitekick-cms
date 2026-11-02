'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * Array row titles that say what the row is, instead of Payload's
 * "Item 01": the row's own name, title, label or question, whichever it
 * has, else the field's singular label and a number. Put on every array
 * without a label of its own by the rowLabels convention
 * (conventions/rowLabels.ts), through admin.components.RowLabel.
 */
const LABEL_KEYS = ['name', 'title', 'label', 'heading', 'headline', 'question', 'term', 'text', 'value', 'handle']

export function rowLabelOf(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  for (const key of LABEL_KEYS) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  // One level into groups (e.g. a link group's label).
  if (depth === 0) {
    for (const v of Object.values(row)) {
      const inner = v && typeof v === 'object' && !Array.isArray(v) ? rowLabelOf(v, 1) : null
      if (inner) return inner
    }
  }
  return null
}

export function AutoRowLabel({ fallback }: { fallback?: string }) {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()
  const label = rowLabelOf(data)
  if (label) return <span>{label.length > 90 ? `${label.slice(0, 88)}…` : label}</span>
  return <span>{`${fallback ?? 'Item'} ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`}</span>
}
