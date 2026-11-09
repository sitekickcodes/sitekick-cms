import type { DefaultCellComponentProps } from 'payload'

import styles from './StatusTag.module.css'

/**
 * List-view cells that show a status as a Tag (pill) instead of grey text, so
 * a column of results or reviews scans at a glance. Tones map to the admin
 * theme: success green, danger red, warning amber, info the accent, neutral
 * and quiet greys.
 */
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'quiet'

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {label}
    </span>
  )
}

export type StatusMap = Record<string, { label: string; tone: Tone }>

/** A value as its Tag, or nothing when the map has no entry for it. Checkboxes look up `true` / `false`. */
export function StatusTag({ value, map }: { value: unknown; map: StatusMap }) {
  const key = typeof value === 'string' ? value : typeof value === 'boolean' ? String(value) : value == null ? 'false' : undefined
  const tag = key !== undefined ? map[key] : undefined
  return tag ? <Tag {...tag} /> : null
}

/** A list cell: `Cell: statusCell({ won: { label: 'Won', tone: 'success' } })` (fields/statusCell.ts). */
export function StatusCell({ cellData, map }: DefaultCellComponentProps & { map?: StatusMap }) {
  return <StatusTag value={cellData} map={map ?? {}} />
}
