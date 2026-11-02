'use client'

import { useState } from 'react'
import { usePreferences } from '@payloadcms/ui'

import { HELP_WELCOME_PREFERENCE } from '../../help/shared'
import { ArrowRightIcon, BookIcon, CloseIcon } from '../HelpIcons'
import { useHelp } from '../HelpProvider'
import styles from '../Dashboard.module.css'

/** Points new editors at Help; dismissed once per account, in preferences. */
export function WelcomeCard({ siteName }: { siteName: string }) {
  const { show } = useHelp()
  const { setPreference } = usePreferences()
  const [dismissed, setDismissed] = useState(false)
  const [failed, setFailed] = useState(false)

  const dismiss = async () => {
    setDismissed(true)
    setFailed(false)
    try {
      await setPreference(HELP_WELCOME_PREFERENCE, true)
    } catch {
      setDismissed(false)
      setFailed(true)
    }
  }

  if (dismissed) return null
  return (
    <aside className={styles.welcome} aria-label="Welcome to Help">
      <BookIcon className={styles.welcomeIcon} size={22} aria-hidden />
      <div className={styles.welcomeBody}>
        <h2>New here? Start with Help.</h2>
        <p>Short articles on editing {siteName}: pages, media, publishing and your account. Help is always in the sidebar.</p>
        <button type="button" className={styles.welcomeOpen} onClick={() => show()}>
          Open Help <ArrowRightIcon size={16} aria-hidden />
        </button>
        {failed ? (
          <p className={styles.welcomeError} role="status">
            Your dismissal could not be saved. Please try again.
          </p>
        ) : null}
      </div>
      <button type="button" className={styles.welcomeDismiss} aria-label="Dismiss welcome" title="Dismiss" onClick={dismiss}>
        <CloseIcon size={20} aria-hidden />
      </button>
    </aside>
  )
}
