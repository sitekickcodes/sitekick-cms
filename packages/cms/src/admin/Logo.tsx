'use client'

import React from 'react'

import type { SiteIdentity } from '../types'
import { useSite } from './useSite'
import styles from './AuthView.module.css'

type Props = {
  site?: SiteIdentity
  /** Pixel height of the mark. Default 36. */
  height?: number
  className?: string
}

/**
 * The client's logo, or a wordmark of `site.name` when there is none.
 * Registered on `admin.components.graphics.Logo`: Payload shows it on the
 * logout, verify, reset and create-first-user screens; AuthView places it
 * itself on login and forgot.
 */
export function Logo({ site: fromProps, height = 36, className }: Props) {
  const site = useSite(fromProps)
  const classes = [styles.logo, className].filter(Boolean).join(' ')
  if (site.logo) {
    return (
      <span className={classes} style={{ height }}>
        {/* A plain img: next/image needs a configured loader for remote
            logos and the admin is not image-critical. */}
        <img src={site.logo} alt={site.name} className={styles.logoImg} />
      </span>
    )
  }
  return (
    <span className={classes} style={{ height }}>
      <span className={styles.wordmark} style={{ fontSize: Math.round(height * 0.62) }}>
        {site.name}
      </span>
    </span>
  )
}
