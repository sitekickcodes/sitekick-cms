'use client'

import { Button, toast, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Sparkle } from './Sparkle'
import styles from './agents.module.css'
import { errorText, useAgents } from './useAgents'

/**
 * "Find details" in the document controls of collections whose contract
 * lists `enrich`. Starts a research run on the saved document and opens the
 * run, which shows progress and then links to the proposal to review. The
 * agent reads what is saved, so unsaved edits disable it.
 */
export function EnrichButton() {
  const agents = useAgents()
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!agents || !collectionSlug || !agents.enrich.includes(collectionSlug) || id === undefined || id === null) return null

  const start = async () => {
    setBusy(true)
    try {
      const { runId } = await agents.post<{ runId: string | number }>('enqueue', { agent: 'enrich', input: { targetCollection: collectionSlug, targetId: id } })
      toast.success('Researching. Nothing changes until you review it.')
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
      tooltip={modified ? 'Save first: the agent reads the saved version' : 'Search the web for missing details and propose them for review'}
      onClick={start}
    >
      <span className={styles.label}>
        <Sparkle />
        {busy ? 'Starting…' : 'Find details'}
      </span>
    </Button>
  )
}
