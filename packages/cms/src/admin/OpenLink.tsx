'use client'

import type { ReactNode } from 'react'
import { useFormFields } from '@payloadcms/ui'

import styles from './OpenLink.module.css'

/**
 * A button inside a contact field's right edge, shown once the field holds
 * something usable (fields/links.ts wires them):
 *   OpenLink  link fields (externalLink / siteLink): open in a new tab
 *   EmailLink email fields: write to the address (mailto:)
 *   CallLink  phone fields: call the number (tel:)
 */
function useValue(path: string) {
  const value = useFormFields(([fields]) => fields[path]?.value)
  return typeof value === 'string' ? value.trim() : ''
}

function FieldButton({ href, label, newTab, children }: { href: string; label: string; newTab?: boolean; children: ReactNode }) {
  return (
    <span className={styles.wrap}>
      <a className={styles.button} href={href} title={label} aria-label={label} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {children}
        </svg>
      </a>
    </span>
  )
}

export function OpenLink({ path }: { path: string }) {
  const href = useValue(path)
  if (!/^(https?:\/\/\S+\.\S+|\/\S*)$/i.test(href)) return null
  return (
    <FieldButton href={href} label="Open in a new tab" newTab>
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </FieldButton>
  )
}

export function EmailLink({ path }: { path: string }) {
  const email = useValue(path)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return (
    <FieldButton href={`mailto:${email}`} label={`Email ${email}`}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </FieldButton>
  )
}

/** tel: form of a saved number: "+" and digits, an extension as ";ext=". US
 * numbers are saved as "(415) 555-0123" (formatPhone), so they dial as +1. */
export function telHref(phone: string): string | null {
  const [main = '', ext] = phone.split(/\s*(?:ext\.?|x|#)\s*/i)
  let digits = main.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (!main.trim().startsWith('+') && digits.length === 10) digits = `1${digits}`
  const extension = ext && /^\d+$/.test(ext) ? `;ext=${ext}` : ''
  return `tel:+${digits}${extension}`
}

export function CallLink({ path }: { path: string }) {
  const phone = useValue(path)
  const href = telHref(phone)
  if (!href) return null
  return (
    <FieldButton href={href} label={`Call ${phone}`}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </FieldButton>
  )
}
