'use client'

import { Button, toast, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Sparkle } from './Sparkle'
import styles from './agents.module.css'
import { errorText, useAgents } from './useAgents'

const EXAMPLES = ['Add a FAQ about parking below the hero, three questions', 'Make the hero heading shorter and warmer', 'Move the call to action to the end of the page']

/**
 * "Edit with words" in the document controls of collections whose contract
 * lists `edit`: the editor describes a change to the page's sections in
 * their own words; the Edit agent proposes the new sections, which the
 * editor reviews section by section with a preview before anything is saved.
 */
export function EditButton() {
  const agents = useAgents()
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  // The controls sit inside Payload's document <form>; a form can't nest, so the dialog lives on <body>.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!agents || !collectionSlug || !agents.edit.includes(collectionSlug) || id === undefined || id === null) return null

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = instruction.trim()
    if (text.length < 3 || busy) return
    setBusy(true)
    try {
      const { runId } = await agents.post<{ runId: string | number }>('enqueue', { agent: 'edit', input: { targetCollection: collectionSlug, targetId: id, instruction: text } })
      toast.success('Working on it. Nothing changes until you review it.')
      router.push(agents.runURL(runId))
    } catch (err) {
      toast.error(`Couldn't start: ${errorText(err)}`)
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        className={styles.control}
        buttonStyle="secondary"
        size="medium"
        margin={false}
        disabled={busy || modified}
        tooltip={modified ? 'Save first: the agent reads the saved version' : 'Describe a change to the sections; review it before it is saved'}
        onClick={() => dialog.current?.showModal()}
      >
        <span className={styles.label}>
          <Sparkle />
          Edit with words
        </span>
      </Button>
      {mounted
        ? createPortal(
            <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${ids}-title`} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
              <form onSubmit={submit} className={styles.form}>
                <header>
                  <h2 id={`${ids}-title`}>Edit with words</h2>
                  <p>Describe the change to this page&apos;s sections. The agent proposes it; you see a preview and decide. Nothing is saved or published until you accept.</p>
                </header>
                <label htmlFor={`${ids}-instruction`}>What should change?</label>
                <textarea
                  id={`${ids}-instruction`}
                  rows={5}
                  value={instruction}
                  maxLength={2000}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
                  }}
                  placeholder="Add a section about…"
                  autoFocus
                />
                <div className={styles.examples} aria-label="Examples">
                  {EXAMPLES.map((example) => (
                    <button key={example} type="button" className={styles.example} onClick={() => setInstruction(example)}>
                      {example}
                    </button>
                  ))}
                </div>
                <footer>
                  <Button type="button" buttonStyle="secondary" size="medium" margin={false} onClick={() => dialog.current?.close()}>
                    Cancel
                  </Button>
                  <Button type="submit" buttonStyle="primary" size="medium" margin={false} disabled={busy || instruction.trim().length < 3}>
                    {busy ? 'Starting…' : 'Propose change'}
                  </Button>
                </footer>
              </form>
            </dialog>,
            document.body,
          )
        : null}
    </>
  )
}
