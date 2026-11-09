'use client'

import { Button, toast, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React, { useState } from 'react'

import styles from './redirects.module.css'

type Result = { created: number; updated: number; errors: { line: number; message: string }[] }

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

/**
 * "Import from a spreadsheet" above the Redirects list (redirects recipe): paste two
 * columns, old address and new, straight from a sheet or a CSV. The usual job at a
 * relaunch, when the old site's URLs have to land somewhere. Posts to
 * /api/redirects/import, which reports the lines it couldn't use.
 */
export function ImportRedirects() {
  const { config } = useConfig()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(formatAdminURL({ apiRoute: config.routes.api, path: '/redirects/import' }), {
        method: 'post',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string }
      if (!res.ok) return void toast.error(json.error ?? `Import failed (HTTP ${res.status}).`)
      setResult({ created: json.created ?? 0, updated: json.updated ?? 0, errors: json.errors ?? [] })
      setText('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {result ? (
        <div className={styles.result} role="status">
          <p>
            {result.created || result.updated
              ? `Added ${plural(result.created, 'redirect')}${result.updated ? `, updated ${result.updated.toLocaleString()}` : ''}.`
              : 'Nothing was added.'}
            {result.errors.length ? ` ${plural(result.errors.length, 'line')} couldn’t be used:` : ''}
          </p>
          {result.errors.length ? (
            <ul className={styles.errors}>
              {result.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Line {e.line}: {e.message}
                </li>
              ))}
              {result.errors.length > 20 ? <li>…and {result.errors.length - 20} more.</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      {open ? (
        <form onSubmit={submit} className={styles.form}>
          <div>
            <label htmlFor="redirects-import" className={styles.label}>
              Old address, new address — one per line
            </label>
            <textarea
              id="redirects-import"
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'/about-us, /about\nhttps://old-site.com/team.html, /people\n/summer-sale, /shop, temporary'}
              autoFocus
              required
              spellCheck={false}
            />
          </div>
          <p className={styles.hint}>
            Paste two columns from a spreadsheet, or type them with a comma between. Full old URLs are fine. Add “temporary” as a third column for a short-term redirect. An old address that’s already here is updated, so pasting a corrected list again is safe.
          </p>
          <div className={styles.actions}>
            <Button type="submit" disabled={busy || !text.trim()} size="medium" buttonStyle="primary" margin={false}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
            <Button type="button" onClick={() => setOpen(false)} size="medium" buttonStyle="secondary" margin={false}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.bar}>
          <Button
            onClick={() => {
              setResult(null)
              setOpen(true)
            }}
            size="medium"
            buttonStyle="secondary"
            margin={false}
          >
            Import from a spreadsheet
          </Button>
        </div>
      )}
    </>
  )
}
