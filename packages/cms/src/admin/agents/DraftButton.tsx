'use client'

import { Button, toast, useConfig } from '@payloadcms/ui'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { Sparkle } from './Sparkle'
import styles from './agents.module.css'
import { errorText, useAgents } from './useAgents'

/**
 * "Draft from notes" beside Create new, for collections whose contract lists
 * `draft`. Notes, a link or both go to the Draft agent; the run page shows
 * progress and then the proposal, which creates the document as a draft when
 * accepted. `?draft=1` opens the form directly (the command palette links
 * there).
 */
export function DraftButton({ collection }: { collection: string }) {
  const agents = useAgents()
  const { config } = useConfig()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const dialog = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [notes, setNotes] = useState('')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const singular = (() => {
    const label = config.collections.find((c) => c.slug === collection)?.labels?.singular
    return (typeof label === 'string' ? label : collection).toLowerCase()
  })()
  const enabled = Boolean(agents?.draft.includes(collection))

  useEffect(() => {
    if (!enabled || params.get('draft') !== '1') return
    dialog.current?.showModal()
    // Drop the flag so closing and reloading doesn't reopen it.
    const rest = new URLSearchParams(params)
    rest.delete('draft')
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false })
  }, [enabled, params, pathname, router])

  if (!agents || !enabled) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notes.trim() && !url.trim()) return
    setBusy(true)
    try {
      const input = { targetCollection: collection, ...(notes.trim() ? { notes: notes.trim() } : {}), ...(url.trim() ? { url: url.trim() } : {}), ...(title.trim() ? { title: title.trim() } : {}) }
      const { runId } = await agents.post<{ runId: string | number }>('enqueue', { agent: 'draft', input })
      toast.success(`Writing the ${singular}. You'll review it before anything is saved.`)
      router.push(agents.runURL(runId))
    } catch (err) {
      toast.error(`Couldn't start: ${errorText(err)}`)
      setBusy(false)
    }
  }

  return (
    <>
      <Button className={styles.control} buttonStyle="secondary" size="medium" margin={false} onClick={() => dialog.current?.showModal()}>
        <span className={styles.label}>
          <Sparkle />
          Draft from notes
        </span>
      </Button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${ids}-title`} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <form onSubmit={submit} className={styles.form}>
          <header>
            <h2 id={`${ids}-title`}>Draft a {singular}</h2>
            <p>Paste notes, a link, or both. The agent writes a draft using only what you give it. You review every field before it&apos;s saved, and nothing is published.</p>
          </header>
          <label htmlFor={`${ids}-notes`}>Notes</label>
          <textarea id={`${ids}-notes`} rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'What happened, who was involved, what comes next…'} autoFocus />
          <label htmlFor={`${ids}-url`}>
            Link <span className={styles.optional}>optional</span>
          </label>
          <input id={`${ids}-url`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <label htmlFor={`${ids}-title`}>
            Working title <span className={styles.optional}>optional</span>
          </label>
          <input id={`${ids}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <footer>
            <Button type="button" buttonStyle="secondary" size="medium" margin={false} onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" buttonStyle="primary" size="medium" margin={false} disabled={busy || (!notes.trim() && !url.trim())}>
              {busy ? 'Starting…' : 'Write draft'}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  )
}
