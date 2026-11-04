'use client'

import { Button, toast } from '@payloadcms/ui'
import React from 'react'

import styles from './InviteUser.module.css'

/**
 * Shown instead of "Invite sent" when the site has no mail provider yet
 * (no RESEND_API_KEY): the set-password link, ready to copy into a message.
 */
export function InviteLink({ email, link }: { email: string; link: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied.')
    } catch {
      toast.error('Couldn’t copy. Select the link and copy it.')
    }
  }
  return (
    <div className={styles.linkBox} role="status">
      <p>
        <strong>Email isn’t set up on this site yet,</strong> so nothing was sent. Send {email} this link yourself. It lets
        them choose a password and works for 7 days.
      </p>
      <div className={styles.linkRow}>
        <input
          className={styles.input}
          readOnly
          value={link}
          aria-label={`Set-password link for ${email}`}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button onClick={() => void copy()} size="medium" buttonStyle="secondary" margin={false}>
          Copy
        </Button>
      </div>
    </div>
  )
}
