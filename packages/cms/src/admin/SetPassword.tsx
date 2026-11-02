'use client'

import { Button, toast, useAuth, useConfig, useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React, { useEffect, useState } from 'react'

import styles from './SetPassword.module.css'

/**
 * The password controls Payload doesn't have (Joel, Oct 15 2026), a ui field
 * right under the account card of a user screen:
 *
 * - Create user: a "Set password" button, the twin of Change Password on an
 *   existing account. Payload won't create an account without a password, so
 *   while it's closed the account gets a random one and the CSS module hides
 *   Payload's New / Confirm Password fields; it opens them, empty, with Save
 *   and Cancel (Cancel puts the random one back). Either Save creates the
 *   account.
 * - An existing account: a Save shown only while Payload's own Change
 *   Password fields are open, so a new password saves right there. The same
 *   save as the top-right button; a saved form is unmodified, and Payload
 *   closes the fields itself on that.
 * - Someone else's account, also: "Send reset email" (hidden while the
 *   fields are open). Payload's own forgot-password email, branded by
 *   auth/invite.ts, whose link lets them choose a password; it lasts an hour,
 *   and finishing it also clears a sign-in lock.
 */
const randomPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
}

export function SetPassword() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  if (!id) return <SetPasswordToggle />
  return <AccountButtons id={id} others={Boolean(user && String(user.id) !== String(id))} />
}

function SetPasswordToggle() {
  const { dispatchFields, submit } = useForm()
  const [open, setOpen] = useState(false)

  const fill = (value: string) => {
    for (const path of ['password', 'confirm-password']) {
      dispatchFields({ type: 'UPDATE', path, value, initialValue: value })
    }
  }
  // A fresh form starts closed, so it needs the random password at once.
  useEffect(() => {
    fill(randomPassword())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new form
  }, [])

  return (
    <div className={styles.toggle} data-open={open || undefined}>
      {open ? (
        <Button buttonStyle="primary" size="medium" margin={false} onClick={() => void submit()}>
          Save
        </Button>
      ) : null}
      <Button
        buttonStyle="secondary"
        size="medium"
        margin={false}
        onClick={() => {
          fill(open ? randomPassword() : '')
          setOpen(!open)
        }}
      >
        {open ? 'Cancel' : 'Set password'}
      </Button>
      {open ? null : (
        <p className={styles.note}>Or leave it: once saved, Send reset email lets them choose their own.</p>
      )}
    </div>
  )
}

function AccountButtons({ id, others }: { id: number | string; others: boolean }) {
  const { submit } = useForm()
  const { config } = useConfig()
  const email = useFormFields(([fields]) => fields.email?.value)
  // Payload registers `password` while its Change Password fields are open
  // and removes it when they close (views/Edit/Auth): no DOM sniffing.
  const changing = useFormFields(([fields]) => Boolean(fields.password))
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (typeof email !== 'string' || !email) return
    setBusy(true)
    try {
      const url = formatAdminURL({ apiRoute: config.routes.api, path: `/${config.admin.user}/forgot-password` })
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Sent ${email} a link to choose a new password. It works for an hour.`)
    } catch (err) {
      toast.error(`The reset email didn't send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  if (!changing && !others) return null
  return (
    <div className={styles.row} data-doc={String(id)}>
      {changing ? (
        <Button buttonStyle="primary" size="medium" margin={false} onClick={() => void submit()}>
          Save
        </Button>
      ) : null}
      {others && !changing ? (
        <Button buttonStyle="secondary" size="medium" margin={false} disabled={busy} onClick={() => void send()}>
          {busy ? 'Sending…' : 'Send reset email'}
        </Button>
      ) : null}
    </div>
  )
}
