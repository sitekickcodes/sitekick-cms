'use client'

import { Button, toast, useAuth, useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React, { useState } from 'react'

import { InviteLink } from './InviteLink'
import styles from './InviteUser.module.css'

const when = (iso: unknown) =>
  typeof iso === 'string' && iso
    ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

/**
 * "Send invite" in a user's sidebar (admins only): emails them a link to
 * choose a password and sign in (POST /api/<users>/:id/invite, see
 * auth/invite.ts). Says whether they've been invited and signed in, so a
 * dormant account is easy to spot and nudge.
 */
export function InviteButton() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const invitedAt = useFormFields(([fields]) => fields.invitedAt?.value)
  const lastLoginAt = useFormFields(([fields]) => fields.lastLoginAt?.value)
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [handOff, setHandOff] = useState<{ email: string; link: string } | null>(null)

  const roles = (user as { roles?: unknown } | null)?.roles
  const admin = Array.isArray(roles) && roles.includes('admin')
  // Your own account, a new unsaved one, or an editor looking at themself.
  if (!id || !admin || String(user?.id) === String(id)) return null

  const invited = when(sentAt ?? invitedAt)
  const signedIn = when(lastLoginAt)

  const send = async () => {
    setBusy(true)
    try {
      const url = formatAdminURL({ apiRoute: config.routes.api, path: `/${config.admin.user}/${id}/invite` })
      const res = await fetch(url, { method: 'post', credentials: 'include' })
      const json = (await res.json()) as { error?: string; email?: string; invitedAt?: string; link?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSentAt(json.invitedAt ?? new Date().toISOString())
      if (json.link) setHandOff({ email: json.email ?? 'them', link: json.link })
      else toast.success(`Invite sent to ${json.email}.`)
    } catch (err) {
      toast.error(`Invite didn't send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <Button onClick={() => void send()} disabled={busy} size="medium" buttonStyle="secondary" margin={false}>
        {busy ? 'Sending…' : invited ? 'Resend invite' : 'Send invite'}
      </Button>
      <div className={styles.hint}>
        {signedIn
          ? `Signed in ${signedIn}. Resending sends a fresh set-password link.`
          : invited
            ? `Invited ${invited}; hasn't signed in yet. The link lasts 7 days.`
            : 'Gives them a link to choose a password and sign in.'}
      </div>
      {handOff && <InviteLink {...handOff} />}
    </div>
  )
}
