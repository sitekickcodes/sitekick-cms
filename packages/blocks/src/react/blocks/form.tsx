'use client'

import { useId, useRef, useState, type FormEvent } from 'react'

import { cn } from '../cn'
import { Band, SectionHeading } from '../shared'
import { Button } from '../ui/button'

/**
 * The Form section from the forms recipe in `@sitekick/cms` (`formBlock`): the form an
 * editor built, posted to `/api/forms/:id/submit`. Errors come back by field and show under
 * each one; once sent, the form's thank-you message takes its place. A hidden field and the
 * time it took to fill in let the server turn bots away; people never see either.
 *
 *   <RenderBlocks blocks={page.layout} custom={{ formBlock: FormSection }} />
 *
 * The page must populate the form (`depth: 1`); an unpopulated id renders nothing.
 */
export type FormFieldData = {
  id?: string | null
  blockType: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox'
  key?: string | null
  label: string
  required?: boolean | null
  placeholder?: string | null
  help?: string | null
  width?: 'full' | 'half' | null
  options?: { id?: string | null; label: string }[] | null
}

export type SiteFormData = {
  id: number | string
  title?: string
  fields?: FormFieldData[] | null
  submitLabel?: string | null
  confirmation?: string | null
}

export type FormSectionBlock = {
  blockType: 'formBlock'
  id?: string | null
  form?: SiteFormData | number | string | null
  heading?: string | null
  intro?: string | null
}

export function FormSection({ block, apiRoute = '/api' }: { block: FormSectionBlock; apiRoute?: string }) {
  const form = block.form && typeof block.form === 'object' ? block.form : null
  if (!form) return null
  return (
    <Band block="formBlock" innerClassName="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading heading={block.heading} />
        {block.intro ? <p className="text-lg text-sk-muted text-pretty">{block.intro}</p> : null}
      </div>
      <SiteForm form={form} apiRoute={apiRoute} />
    </Band>
  )
}

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; message: string } | { kind: 'error'; message: string; fields: Record<string, string> }

/** The form itself, for a page that places it without the section chrome. */
export function SiteForm({ form, apiRoute = '/api' }: { form: SiteFormData; apiRoute?: string }) {
  const ids = useId()
  const startedAt = useRef(Date.now())
  const [state, setState] = useState<State>({ kind: 'idle' })
  const fields = (form.fields ?? []).filter((f): f is FormFieldData & { key: string } => Boolean(f.key))
  const errors = state.kind === 'error' ? state.fields : {}

  if (state.kind === 'sent') {
    return (
      <div role="status" className="rounded-2xl border border-sk-line bg-sk-card p-6 text-sk-fg">
        <p className="text-lg font-medium">{state.message}</p>
      </div>
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const answers: Record<string, string | boolean> = {}
    for (const f of fields) answers[f.key] = f.blockType === 'checkbox' ? data.get(f.key) === 'on' : String(data.get(f.key) ?? '').trim()
    // Required fields first, in the browser: no round trip for the obvious. The server checks everything again.
    const missing = Object.fromEntries(fields.filter((f) => f.required && !answers[f.key]).map((f) => [f.key, f.blockType === 'checkbox' ? 'Please tick this box.' : `Please fill in ${f.label.toLowerCase()}.`]))
    if (Object.keys(missing).length) {
      setState({ kind: 'error', message: 'Please fill in the fields marked below.', fields: missing })
      return
    }
    setState({ kind: 'sending' })
    try {
      const res = await fetch(`${apiRoute}/forms/${encodeURIComponent(String(form.id))}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, website: String(data.get('website') ?? ''), startedAt: startedAt.current, page: window.location.pathname }),
      })
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string; errors?: Record<string, string> }
      if (res.ok) return setState({ kind: 'sent', message: json.message || 'Thanks, we got it.' })
      setState({ kind: 'error', message: json.error ?? 'Please check the fields marked below.', fields: json.errors ?? {} })
    } catch {
      setState({ kind: 'error', message: 'That didn’t send. Check your connection and try again.', fields: {} })
    }
  }

  const input = 'w-full rounded-xl border border-sk-line bg-sk-card px-4 py-3 text-base text-sk-fg placeholder:text-sk-muted/70 outline-none focus-visible:border-sk-accent focus-visible:ring-[3px] focus-visible:ring-sk-accent/25 aria-invalid:border-[color:var(--sk-danger,#b42318)]'

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2" aria-describedby={state.kind === 'error' ? `${ids}-error` : undefined}>
      {fields.map((f) => {
        const id = `${ids}-${f.key}`
        const error = errors[f.key]
        const describedBy = [f.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
        const common = { id, name: f.key, required: Boolean(f.required), 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy }
        const label = (
          <span className="text-sm font-medium text-sk-fg">
            {f.label}
            {f.required ? <span aria-hidden="true" className="text-sk-muted"> *</span> : null}
          </span>
        )
        return (
          <div key={f.id ?? f.key} className={cn('flex flex-col gap-2', f.width !== 'half' && 'sm:col-span-2')}>
            {f.blockType === 'checkbox' ? (
              <label htmlFor={id} className="flex items-start gap-3">
                <input type="checkbox" {...common} className="mt-1 size-4 accent-[color:var(--sk-accent)]" />
                {label}
              </label>
            ) : (
              <label htmlFor={id}>{label}</label>
            )}
            {f.blockType === 'textarea' ? (
              <textarea {...common} rows={5} placeholder={f.placeholder ?? undefined} className={cn(input, 'resize-y')} />
            ) : f.blockType === 'select' ? (
              <select {...common} defaultValue="" className={input}>
                <option value="" disabled>
                  {f.placeholder || 'Choose one'}
                </option>
                {(f.options ?? []).map((o) => (
                  <option key={o.id ?? o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.blockType !== 'checkbox' ? (
              <input
                {...common}
                type={f.blockType === 'email' ? 'email' : f.blockType === 'phone' ? 'tel' : 'text'}
                autoComplete={f.blockType === 'email' ? 'email' : f.blockType === 'phone' ? 'tel' : /name/i.test(f.label) ? 'name' : undefined}
                placeholder={f.placeholder ?? undefined}
                className={input}
              />
            ) : null}
            {f.help ? (
              <p id={`${id}-help`} className="text-sm text-sk-muted">
                {f.help}
              </p>
            ) : null}
            {error ? (
              <p id={`${id}-error`} className="text-sm font-medium text-[color:var(--sk-danger,#b42318)]">
                {error}
              </p>
            ) : null}
          </div>
        )
      })}
      {/* For bots only: hidden from people and from screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        {state.kind === 'error' ? (
          <p id={`${ids}-error`} role="alert" className="text-sm font-medium text-[color:var(--sk-danger,#b42318)]">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending…' : form.submitLabel || 'Send'}
        </Button>
      </div>
    </form>
  )
}
