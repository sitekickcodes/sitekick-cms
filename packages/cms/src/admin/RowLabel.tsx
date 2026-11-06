'use client'

import { useRowLabel } from '@payloadcms/ui'

import { choiceLabelOf, rowLabelOf } from '../conventions/rowLabelOf'
import styles from './RowLabel.module.css'

/**
 * Array row titles that say what the row is, instead of Payload's
 * "Item 01" (see rowLabelOf), else the field's singular label and a number.
 * Put on every array without a label of its own by the rowLabels convention
 * (conventions/rowLabels.ts), through admin.components.RowLabel.
 */
export function AutoRowLabel({ fallback, choices }: { fallback?: string; choices?: Record<string, Record<string, string>> }) {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()
  const label = rowLabelOf(data) ?? choiceLabelOf(data, choices)
  if (label) return <span>{label.length > 90 ? `${label.slice(0, 88)}…` : label}</span>
  return <span>{`${fallback ?? 'Item'} ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`}</span>
}

/**
 * A section (block row) header: number, the block's type, and the section's
 * own heading or title, instead of Payload's editable "Untitled" block name.
 * A block name an editor did type still wins. Set on every block without a
 * Label of its own by the same convention.
 */
export function BlockRowLabel({ blockLabel }: { blockLabel?: string }) {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()
  const named = typeof data?.blockName === 'string' && data.blockName.trim() ? data.blockName.trim() : null
  const title = named ?? rowLabelOf(data)
  return (
    <span className={styles.block}>
      <span className={styles.number}>{String((rowNumber ?? 0) + 1).padStart(2, '0')}</span>
      <span className={styles.type}>{blockLabel ?? 'Section'}</span>
      {title ? <span className={styles.title}>{title.length > 80 ? `${title.slice(0, 78)}…` : title}</span> : null}
    </span>
  )
}
