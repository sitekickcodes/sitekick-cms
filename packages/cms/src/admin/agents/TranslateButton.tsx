'use client'

import { Button, PopupList, toast, useConfig, useDocumentInfo, useFormModified, useLocale } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Sparkle } from './Sparkle'
import styles from './agents.module.css'
import { errorText, useAgents } from './useAgents'

/**
 * "Translate from English" in the document controls of a translated collection
 * (recipes/localization.ts places it), shown while the admin is switched to another
 * language. Starts the Translate agent on the saved document: it fills in the fields that
 * have no translation yet, and the editor reviews the result per field. The menu offers
 * "Translate everything again" for a page whose original has changed.
 */
export function TranslateButton() {
  const agents = useAgents()
  const { config } = useConfig()
  const locale = useLocale()
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const localization = config.localization
  const from = localization ? localization.locales.find((l) => l.code === localization.defaultLocale) : undefined
  const fromName = typeof from?.label === 'string' ? from.label : (localization ? localization.defaultLocale : '')
  if (!agents || !localization || !collectionSlug || !(agents.translate ?? []).includes(collectionSlug) || id === undefined || id === null) return null
  if (!locale?.code || locale.code === localization.defaultLocale) return null
  const toName = typeof locale.label === 'string' ? locale.label : locale.code

  const start = async (mode: 'missing' | 'all') => {
    setBusy(true)
    try {
      const { runId } = await agents.post<{ runId: string | number }>('enqueue', { agent: 'translate', input: { targetCollection: collectionSlug, targetId: id, locale: locale.code, mode } })
      toast.success(`Translating into ${toName}. Nothing changes until you review it.`)
      router.push(agents.runURL(runId))
    } catch (err) {
      toast.error(`Couldn't start: ${errorText(err)}`)
      setBusy(false)
    }
  }

  return (
    <Button
      className={styles.control}
      buttonStyle="secondary"
      size="medium"
      margin={false}
      disabled={busy || modified}
      tooltip={modified ? 'Save first: the agent reads the saved version' : `Translate what has no ${toName} version yet, for you to review`}
      onClick={() => start('missing')}
      SubMenuPopupContent={({ close }) => (
        <PopupList.ButtonGroup>
          <PopupList.Button
            onClick={() => {
              close()
              void start('all')
            }}
          >
            Translate everything again
          </PopupList.Button>
        </PopupList.ButtonGroup>
      )}
    >
      <span className={styles.label}>
        <Sparkle />
        {busy ? 'Starting…' : `Translate from ${fromName}`}
      </span>
    </Button>
  )
}
