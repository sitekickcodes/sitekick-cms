'use client'

import React from 'react'

import type { SiteIdentity } from '../types'
import { useSite } from './useSite'
import styles from './AuthView.module.css'

type Props = {
  site?: SiteIdentity
  /** Pixel size of the square. Default 26. */
  size?: number
}

/**
 * Small square brand mark (nav header, collapsed sidebar, loading states).
 * Registered on `admin.components.graphics.Icon`. `site.icon`, else
 * `site.logo`, else a lettermark: the first letter of `site.name` on the
 * accent colour.
 */
export function Icon({ site: fromProps, size = 26 }: Props) {
  const site = useSite(fromProps)
  const src = site.icon ?? site.logo
  if (src) {
    return <img src={src} alt={site.name} className={styles.icon} style={{ width: size, height: size }} />
  }
  const letter = (site.name.trim()[0] ?? 'S').toUpperCase()
  return (
    <span
      aria-label={site.name}
      role="img"
      className={styles.lettermark}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.58),
        background: site.accent ?? 'var(--sk-accent, #0f766e)',
      }}
    >
      {letter}
    </span>
  )
}
