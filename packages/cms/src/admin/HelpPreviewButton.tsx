'use client'

import { useLivePreviewContext } from '@payloadcms/ui'

import { ArrowUpRightIcon } from './HelpIcons'
import styles from './Help.module.css'

/**
 * The Preview button on a help article. Payload supplies the document's
 * preview URL (`/admin?help=<slug>&helpPreview=<id>`); an explicit link
 * replaces the default copy-link control so the draft opens in the drawer.
 */
export function HelpPreviewButton() {
  const { previewURL } = useLivePreviewContext()
  return previewURL ? (
    <a className={styles.previewButton} href={previewURL} target="_blank" rel="noopener noreferrer">
      Preview <ArrowUpRightIcon size={16} aria-hidden />
    </a>
  ) : null
}
