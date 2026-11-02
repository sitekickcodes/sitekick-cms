'use client'

import { Button, toast, useAuth, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React, { useState } from 'react'

import type { Role } from '../access'
import styles from './InviteUser.module.css'

/**
 * "Invite someone" above the Users list (admins only). One step instead of
 * the stock create form, which demands a password the person would never
 * use: email + role → POST /api/<users>/invite creates the account and emails
 * a set-your-password link (auth/invite.ts). Registered on the users
 * collection's `admin.components.beforeListTable` by auth/users.ts.
 */
export function InviteUser() {
  const { user } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [busy, setBusy] = useState(false)

  const roles = (user as { roles?: unknown } | null)?.roles
  if (!Array.isArray(roles) || !roles.includes('admin')) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const url = formatAdminURL({ apiRoute: config.routes.api, path: `/${config.admin.user}/invite` })
      const res = await fetch(url, {
        method: 'post',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const json = (await res.json()) as { error?: string; email?: string; id?: number | string }
      if (!res.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`)
        if (json.id) router.refresh()
        return
      }
      toast.success(`Invite sent to ${json.email}.`)
      setEmail('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(`Invite didn't send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className={styles.bar}>
        <Button onClick={() => setOpen(true)} size="medium" buttonStyle="primary" margin={false}>
          Invite someone
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div>
        <label htmlFor="invite-email" className={styles.label}>
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />
      </div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Role</legend>
        <div className={styles.radios}>
          <label>
            <input type="radio" name="invite-role" value="editor" checked={role === 'editor'} onChange={() => setRole('editor')} />{' '}
            Editor
          </label>
          <label>
            <input type="radio" name="invite-role" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} />{' '}
            Admin
          </label>
        </div>
        <p className={styles.hint}>
          {role === 'admin'
            ? 'Admins can edit everything and manage users.'
            : 'Editors can edit content. They cannot manage users or roles.'}
        </p>
      </fieldset>
      <div className={styles.hint}>
        They&apos;ll get an email with a link to choose a password. The link lasts 7 days; you can resend it from their
        account.
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={busy} size="medium" buttonStyle="primary" margin={false}>
          {busy ? 'Sending…' : 'Send invite'}
        </Button>
        <Button onClick={() => setOpen(false)} size="medium" buttonStyle="secondary" margin={false}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
