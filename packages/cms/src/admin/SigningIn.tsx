'use client'

import { LoadingOverlay, useAuth } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'

/**
 * The login screen's "Signing in..." state, the twin of Payload's own
 * "Logging out..." (its Logout view renders this same LoadingOverlay).
 * Rendered by AuthFrame right after the login form, and registered on
 * `admin.components.afterLogin` for anyone using Payload's stock login view.
 *
 * It sits outside Payload's login <Form>, so it can't read the form's
 * processing state from context. It watches what the form does instead:
 *  - while a submit is in flight Payload disables the submit button
 *    (FormSubmit sets `disabled` while processing), so a disabled button =
 *    signing in;
 *  - on success Payload sets the user before it navigates to the dashboard,
 *    so once `user` is set the overlay stays up until this view unmounts.
 *    The dashboard is the slow part, which is the point.
 * A failed sign-in re-enables the button and the overlay goes, leaving
 * Payload's error toast.
 *
 * It doesn't put the cursor in the email field on load (Yimby did, Oct 14
 * 2026): password managers open their suggestions when a field gains focus,
 * and a field focused before 1Password was ready never offered them, since
 * clicking an already-focused field fires no new focus (Joel, Oct 16).
 *
 * Payload also disables the button for ~100ms while it checks the fields
 * client-side, so a submit has to stay in flight past SHOW_AFTER_MS before
 * the overlay appears: an empty or invalid form never flashes it.
 */
const SHOW_AFTER_MS = 200

export function SigningIn() {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // The form is a sibling: AuthFrame's login column, or Payload's own
    // template wrap when registered via afterLogin. No Payload class names.
    const button = anchor.current?.parentElement?.querySelector<HTMLButtonElement>(
      'form button[type="submit"]',
    )
    if (!button) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = () => {
      clearTimeout(timer)
      if (button.disabled) {
        timer = setTimeout(() => setSubmitting(true), SHOW_AFTER_MS)
      } else {
        setSubmitting(false)
      }
    }

    const observer = new MutationObserver(sync)
    observer.observe(button, { attributes: true, attributeFilter: ['disabled'] })
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <span hidden ref={anchor} />
      {submitting || user ? <LoadingOverlay animationDuration="0ms" loadingText="Signing in..." /> : null}
    </>
  )
}
