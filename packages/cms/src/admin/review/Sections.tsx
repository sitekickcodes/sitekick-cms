'use client'

import { useState } from 'react'

import type { SectionChange } from '../../review/render'
import styles from './review.module.css'

const LABELS: Record<SectionChange['change'], string> = { added: 'New', changed: 'Changed', moved: 'Moved', removed: 'Removed', same: 'Unchanged' }

/** A blocks field's change, section by section, top to bottom. */
export function SectionList({ sections }: { sections: SectionChange[] }) {
  return (
    <ol className={styles.sections}>
      {sections.map((s, i) => (
        <li key={i} className={styles.sectionItem} data-change={s.change}>
          <span className={styles.sectionBadge} data-change={s.change}>
            {LABELS[s.change]}
          </span>
          <div className={styles.sectionBody}>
            <span className={styles.sectionName}>
              {s.type}
              {s.title ? <span className={styles.sectionTitle}> · {s.title}</span> : null}
            </span>
            {s.details.length && s.change !== 'same' ? (
              <ul className={styles.sectionDetails}>
                {s.details.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * The page as it would look with the proposal, beside how it looks now, in
 * the site's own preview. Phone width is a toggle because sections that read
 * well wide often break narrow.
 */
export function ProposalPreview({ urls }: { urls: { proposed: string; current: string } }) {
  const [side, setSide] = useState<'proposed' | 'current'>('proposed')
  const [phone, setPhone] = useState(false)
  const src = urls[side]
  return (
    <div className={styles.preview}>
      <div className={styles.previewBar}>
        <div className={styles.segmented} role="group" aria-label="Which version">
          <button type="button" aria-pressed={side === 'proposed'} onClick={() => setSide('proposed')}>
            Proposed
          </button>
          <button type="button" aria-pressed={side === 'current'} onClick={() => setSide('current')}>
            Now
          </button>
        </div>
        <div className={styles.segmented} role="group" aria-label="Width">
          <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)}>
            Desktop
          </button>
          <button type="button" aria-pressed={phone} onClick={() => setPhone(true)}>
            Phone
          </button>
        </div>
        <a className={styles.previewOpen} href={src} target="_blank" rel="noreferrer">
          Open in a new tab
        </a>
      </div>
      <div className={styles.previewFrame} data-phone={phone || undefined}>
        <iframe key={src} src={src} title={side === 'proposed' ? 'Preview of the proposed page' : 'Preview of the page now'} loading="lazy" />
      </div>
    </div>
  )
}
