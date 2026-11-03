'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, TextField, TextareaField, UploadField, toast, useConfig, useDocumentInfo, useField, useForm, useFormFields, useFormModified, useLocale } from '@payloadcms/ui'
import type { TextFieldClientProps, TextareaFieldClientProps, UploadFieldClientProps } from 'payload'

import { seoDefaults } from '../conventions/seoDefaults'
import { Sparkle } from './agents/Sparkle'
import { errorText, useAgents } from './agents/useAgents'
import styles from './SEOFields.module.css'

/**
 * The SEO tab's fields, in place of @payloadcms/plugin-seo's stock ones (the
 * seo convention swaps them in): a readiness overview, title and description
 * with a length hint and a "Use content" reset, the sharing image, and a
 * search-result preview with the page's real address.
 */
type SiteProps = { siteName?: string; siteIcon?: string }

function Icon({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}
const Check = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)
const Alert = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </Icon>
)
const CircleCheck = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)
const Globe = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </Icon>
)
const Undo = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
)

function displayAddress(url: URL) {
  let path = url.pathname
  try {
    path = decodeURI(path)
  } catch {
    /* An unfinished URL can contain a bare %. */
  }
  return `${url.host}${path.replaceAll('/', ' › ')}`
}

function LengthHint({ value, min, max }: { value: string; min: number; max: number }) {
  const length = value.length
  const good = length >= min && length <= max
  const message = !length ? 'Add some text' : length > max ? 'May be cut off in search' : length < min ? 'Room for more detail' : 'Suggested length'
  return (
    <div className={styles.lengthHint}>
      <span className={styles.lengthState} data-good={good}>
        {good ? <Check /> : <Alert />}
        {message}
      </span>
      <span>
        {length} characters · Aim for {min}–{max}
      </span>
    </div>
  )
}

function UseContent({ kind, path, readOnly, siteName }: { kind: 'title' | 'description'; path: string; readOnly?: boolean; siteName: string }) {
  const { getData } = useForm()
  const { setValue, disabled, formProcessing } = useField<string>({ path })
  const noun = kind === 'title' ? 'title' : 'summary'
  return (
    <Button
      className={styles.reset}
      buttonStyle="pill"
      size="medium"
      aria-label={`Use content ${noun}`}
      disabled={readOnly || disabled || formProcessing}
      onClick={() => setValue(seoDefaults(getData(), { name: siteName })[kind])}
    >
      <span className={styles.resetLabel}>
        <Undo size={14} />
        <span>
          Use content<span className={styles.resetKind}> {noun}</span>
        </span>
      </span>
    </Button>
  )
}

export function SEOTitle(props: TextFieldClientProps & SiteProps) {
  const { path, value = '' } = useField<string>({ potentiallyStalePath: props.path })
  return (
    <div className={styles.textField}>
      <TextField {...props} field={{ ...props.field, label: 'Search title', admin: { ...props.field.admin, style: { marginBottom: 8 } } }} />
      <UseContent kind="title" path={path} readOnly={props.readOnly} siteName={props.siteName ?? ''} />
      <LengthHint value={value ?? ''} min={50} max={60} />
    </div>
  )
}

export function SEODescription(props: TextareaFieldClientProps & SiteProps) {
  const { path, value = '' } = useField<string>({ potentiallyStalePath: props.path })
  return (
    <div className={styles.textField}>
      <TextareaField {...props} field={{ ...props.field, label: 'Search description', admin: { ...props.field.admin, rows: 3, style: { marginBottom: 8 } } }} />
      <UseContent kind="description" path={path} readOnly={props.readOnly} siteName={props.siteName ?? ''} />
      <LengthHint value={value ?? ''} min={100} max={150} />
    </div>
  )
}

export function SEOImage(props: UploadFieldClientProps & SiteProps) {
  return (
    <div className={styles.imageField}>
      <UploadField {...props} />
    </div>
  )
}

/** "Write with AI": the agent kit's seo action reads the saved document and fills title and description in the form. */
function WriteSEO() {
  const agents = useAgents()
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const title = useField<string>({ path: 'meta.title' })
  const description = useField<string>({ path: 'meta.description' })
  const [busy, setBusy] = useState(false)
  if (!agents || !collectionSlug || id === undefined || id === null) return null

  const write = async () => {
    setBusy(true)
    try {
      const { value } = await agents.post<{ value: { title: string; description: string } }>('action', { action: 'seo', input: { collection: collectionSlug, id } })
      title.setValue(value.title)
      description.setValue(value.description)
      toast.success('Search details written. Read them over, then save.')
    } catch (err) {
      toast.error(`Couldn't write search details: ${errorText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      className={styles.writeSEO}
      buttonStyle="pill"
      size="medium"
      margin={false}
      disabled={busy || modified || title.disabled}
      tooltip={modified ? 'Save first: the agent reads the saved version' : 'Write a search title and description from the content'}
      onClick={write}
    >
      <span className={styles.resetLabel}>
        <Sparkle />
        {busy ? 'Writing…' : 'Write with AI'}
      </span>
    </Button>
  )
}

export function SEOOverview() {
  const title = useFormFields(([fields]) => String(fields['meta.title']?.value ?? ''))
  const description = useFormFields(([fields]) => String(fields['meta.description']?.value ?? ''))
  const image = useFormFields(([fields]) => Boolean(fields['meta.image']?.value))
  const checks = [
    { label: 'Search title', good: Boolean(title.trim()) && title.length <= 60 },
    { label: 'Description', good: Boolean(description.trim()) && description.length <= 150 },
    { label: image ? 'Sharing image' : 'Default sharing image', good: true },
  ]
  const missing = checks.filter((check) => !check.good).length
  return (
    <section className={styles.overview} aria-label="Search and sharing checks">
      <div className={styles.overviewHeading} role="status">
        <span className={styles.overviewIcon} data-ready={!missing}>
          {missing ? <Alert size={18} /> : <CircleCheck size={18} />}
        </span>
        <strong>{missing ? `${missing} search ${missing === 1 ? 'detail needs' : 'details need'} attention` : 'Search details ready'}</strong>
        <WriteSEO />
      </div>
      <ul className={styles.checks}>
        {checks.map(({ label, good }) => (
          <li key={label} data-good={good}>
            {good ? <Check /> : <Alert />}
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SEOPreview({ siteName, siteIcon }: SiteProps) {
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { id, collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  const route = useFormFields(([fields]) => JSON.stringify({ slug: fields.slug?.value }))
  const title = useFormFields(([fields]) => String(fields['meta.title']?.value ?? ''))
  const description = useFormFields(([fields]) => String(fields['meta.description']?.value ?? ''))
  const [address, setAddress] = useState<{ route: string; url: string | null }>()

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void fetch(`${api}/plugin-seo/generate-url`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, collectionSlug, doc: JSON.parse(route), locale: locale?.code }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Preview URL unavailable')
          const { result } = await response.json()
          const url = new URL(result)
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid preview URL')
          if (!controller.signal.aborted) setAddress({ route, url: url.href })
        })
        .catch(() => {
          if (!controller.signal.aborted) setAddress({ route, url: null })
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, collectionSlug, id, locale?.code, route])

  const url = address?.route === route && address.url ? new URL(address.url) : undefined
  return (
    <section className={styles.preview} aria-label="Search result preview">
      <div className={styles.previewHeading}>
        <Globe size={18} />
        <h3>Search result preview</h3>
      </div>
      <p className={styles.previewNote}>An example of how this page may appear in search. Search engines may choose different text.</p>
      <div className={styles.result}>
        <div className={styles.resultSite}>
          <span className={styles.siteIcon}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the site's own small icon */}
            {siteIcon ? <img src={siteIcon} width={24} height={24} alt="" /> : <Globe size={18} />}
          </span>
          <div className={styles.resultAddress}>
            <span>{siteName}</span>
            <span className={styles.resultURL} title={url?.href}>
              {url ? displayAddress(url) : address?.route === route && address.url === null ? 'Page address unavailable' : 'Loading page address…'}
            </span>
          </div>
        </div>
        <div className={styles.resultTitle}>{title || 'Your page title will appear here'}</div>
        <p className={styles.resultDescription}>{description || 'Add a description to show people what this page is about.'}</p>
      </div>
    </section>
  )
}
