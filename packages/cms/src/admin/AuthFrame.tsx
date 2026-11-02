'use client'

import { Button, ForgotPasswordForm, LoginForm, useConfig } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React, { useEffect, useRef, useState } from 'react'

import type { SiteIdentity } from '../types'
import { Logo } from './Logo'
import { SigningIn } from './SigningIn'
import styles from './AuthView.module.css'

type Props = {
  site: SiteIdentity
  initialRecovery: boolean
  loginEnabled: boolean
  prefillEmail?: string
  prefillPassword?: string
  prefillUsername?: string
  searchParams: { [key: string]: string | string[] | undefined }
}

/**
 * The client half of AuthView: a full-screen frame of our own (it covers
 * Payload's minimal template, so no Payload class is restyled), with a
 * decorative accent panel on desktop and the brand, a heading and Payload's
 * native login / forgot-password forms in the form column.
 *
 * The native forms and their state stay inside this one persistent shell:
 * clicks on the forms' own "forgot password" / "back to login" links switch
 * forms in place instead of navigating, keeping the typed email across the
 * switch. Only one form is mounted at a time so native field ids stay unique
 * (Payload restores its resend countdown when the recovery form reopens).
 */
export function AuthFrame({ site, initialRecovery, loginEnabled, ...loginProps }: Props) {
  const [recovery, setRecovery] = useState(initialRecovery)
  const [rememberedEmail, setRememberedEmail] = useState(loginProps.prefillEmail)
  const column = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const switched = useRef(false)
  const { config } = useConfig()
  const loginURL = formatAdminURL({ adminRoute: config.routes.admin, path: config.admin.routes.login })
  const forgotURL = formatAdminURL({ adminRoute: config.routes.admin, path: config.admin.routes.forgot })

  useEffect(() => {
    if (!switched.current) return
    const target = heading.current
    if (target) {
      target.tabIndex = -1
      target.focus({ preventScroll: true })
    }
  }, [recovery])

  const switchForm = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a') : null
    if (!link || link.target || link.hasAttribute('download')) return
    const url = new URL(link.href)
    if (url.origin !== window.location.origin || url.search || url.hash) return
    if (url.pathname !== loginURL && url.pathname !== forgotURL) return
    event.preventDefault()
    if (url.pathname === forgotURL) {
      setRememberedEmail(column.current?.querySelector<HTMLInputElement>('form input[type="email"]')?.value)
    }
    switched.current = true
    setRecovery(url.pathname === forgotURL)
  }

  const accentStyle = site.accent ? ({ '--sk-accent': site.accent } as React.CSSProperties) : undefined

  return (
    <div className={styles.frame} data-recovery={recovery || undefined} style={accentStyle}>
      <aside className={styles.panel} aria-hidden="true">
        <div className={styles.panelGrid} />
        <div className={styles.panelOrb} />
        <div className={styles.panelFoot}>
          <span className={styles.panelName}>{site.name}</span>
          {site.url ? <span className={styles.panelUrl}>{site.url.replace(/^https?:\/\//, '')}</span> : null}
        </div>
      </aside>

      <div className={styles.column} ref={column} onClickCapture={switchForm}>
        <div className={styles.brand}>
          <Logo site={site} height={40} />
        </div>
        {recovery ? (
          <div className={styles.recovery}>
            <h1 ref={heading} className={styles.title}>
              Reset your password
            </h1>
            <ForgotPasswordForm />
            <Button className={styles.back} el="link" url={loginURL} buttonStyle="ghost" margin={false}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className={styles.login}>
            <h1 ref={heading} className={styles.title}>
              Welcome back
            </h1>
            <p className={styles.sub}>Sign in to {site.name.replace(/[.]+$/, "")}.</p>
            {loginEnabled ? <LoginForm {...loginProps} prefillEmail={rememberedEmail} /> : null}
            <SigningIn />
          </div>
        )}
      </div>
    </div>
  )
}
