'use client'

import { Button, toast, useDocumentInfo, useField } from '@payloadcms/ui'
import { useState } from 'react'

import { Sparkle } from './Sparkle'
import styles from './agents.module.css'
import { errorText, useAgents } from './useAgents'

/**
 * "Describe image" under an upload collection's `alt` field: the model looks
 * at the saved file and fills the field in place. The editor reads it and
 * saves; nothing is written until they do.
 */
export function AltTextButton() {
  const agents = useAgents()
  const { id, collectionSlug } = useDocumentInfo()
  const { value, setValue, disabled } = useField<string>({ path: 'alt' })
  const [busy, setBusy] = useState(false)

  if (!agents || !collectionSlug) return null
  const saved = id !== undefined && id !== null

  const describe = async () => {
    setBusy(true)
    try {
      const { value: alt } = await agents.post<{ value: string }>('action', { action: 'altText', input: { mediaId: id, collection: collectionSlug } })
      setValue(alt)
      toast.success('Description added. Check it reads right, then save.')
    } catch (err) {
      toast.error(`Couldn't describe the image: ${errorText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.fieldAction}>
      <Button
        buttonStyle="pill"
        size="medium"
        margin={false}
        disabled={busy || disabled || !saved}
        tooltip={saved ? undefined : 'Save the upload first'}
        onClick={describe}
      >
        <span className={styles.label}>
          <Sparkle />
          {busy ? 'Looking at the image…' : value ? 'Describe again' : 'Describe image'}
        </span>
      </Button>
    </div>
  )
}
