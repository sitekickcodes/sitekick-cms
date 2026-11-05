import type { EmailField, FieldHook, TextField } from 'payload'

/**
 * Link and email fields that behave like it. Payload has no URL field type,
 * so every link is a bare text box: "example.org" saves as-is and renders as
 * a broken relative link on the site. These wrap an existing field definition
 * (keeping its name, label and description) and add:
 *
 *   externalLink — a web address. On save: trims, and adds https:// to a
 *                  bare domain ("example.org" → "https://example.org"). Then
 *                  it must be a real http(s) address. Placeholder "https://".
 *   siteLink     — the same, but a page on this site ("/donate", "#section")
 *                  and mailto:/tel: are fine too (nav, footer, buttons).
 *   emailField   — Payload's email type (validates the format); trims and
 *                  lowercases on save.
 *   tidyEmail    — trims and lowercases only, no format check. For public-form
 *                  submissions, where a stricter check than the form's own
 *                  could turn a real sign-up into an error for the visitor.
 *   lenientLink  — tidies only, no check: public-form input.
 *   phoneField   — a phone number: US numbers saved as "(415) 555-0123"
 *                  (an extension kept), anything else must at least be one.
 *
 * Each also gets a button inside the input's right edge (admin/OpenLink.tsx):
 * links open in a new tab, emails start a message, phones call.
 *
 * No data or schema change: these are all varchar columns either way.
 */

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const BARE_DOMAIN = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#:]\S*)?$/i
const WEB = /^https?:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i

/** Tidy a typed link: trim, and give a bare domain its https://. */
export function normalizeLink(value: unknown, { sitePaths = false } = {}): unknown {
  if (typeof value !== 'string') return value
  const v = value.trim()
  if (!v) return null
  if (sitePaths && /^[/#]/.test(v)) return v
  if (SCHEME.test(v)) return v.replace(/^(https?):\/\//i, (_m, s: string) => `${s.toLowerCase()}://`)
  if (v.startsWith('//')) return `https:${v}`
  return BARE_DOMAIN.test(v) ? `https://${v}` : v
}

const tidyLink =
  (sitePaths: boolean): FieldHook =>
  ({ value }) =>
    normalizeLink(value, { sitePaths })

const tidyEmailHook: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || null : value)

type Text = Omit<TextField, 'type'> & { type?: 'text' }

export const OPEN_LINK = '@sitekick/cms/admin#OpenLink'
export const EMAIL_LINK = '@sitekick/cms/admin#EmailLink'
export const CALL_LINK = '@sitekick/cms/admin#CallLink'

const withButton = <A extends TextField['admin'] | EmailField['admin']>(button: string, admin: A): A =>
  ({
    ...admin,
    // First: the button anchors to the input's bottom edge, so it must follow it directly.
    components: { ...admin?.components, afterInput: [button, ...(admin?.components?.afterInput ?? [])] },
  }) as A
const withOpenLink = (admin: TextField['admin']) => withButton(OPEN_LINK, admin)
/** Addresses and numbers are the same in every language (recipes/localization.ts reads this). */
const shared = (field: { custom?: Record<string, unknown> }) => ({
  ...field.custom,
  sitekick: { localized: false, ...(field.custom?.sitekick as object | undefined) },
})
const withHook = (field: Text, hook: FieldHook) => ({
  ...field.hooks,
  beforeValidate: [...(field.hooks?.beforeValidate ?? []), hook],
})

export function externalLink(field: Text): TextField {
  return {
    ...field,
    custom: shared(field),
    type: 'text',
    hooks: withHook(field, tidyLink(false)),
    admin: withOpenLink({ placeholder: 'https://', ...field.admin }),
    validate: (value: unknown) => {
      if (value == null || value === '') return field.required ? 'Enter a web address, e.g. https://example.org' : true
      return (typeof value === 'string' && WEB.test(value)) || 'Enter a full web address, e.g. https://example.org'
    },
  } as TextField
}

export function siteLink(field: Text): TextField {
  return {
    ...field,
    custom: shared(field),
    type: 'text',
    hooks: withHook(field, tidyLink(true)),
    admin: withOpenLink({ placeholder: '/page-on-this-site or https://', ...field.admin }),
    validate: (value: unknown) => {
      if (value == null || value === '') return field.required ? 'Enter where this links: a page on this site (/join) or a full web address.' : true
      if (typeof value !== 'string') return 'Enter a link.'
      if (/^[/#]/.test(value) || /^(mailto|tel):\S+$/i.test(value) || WEB.test(value)) return true
      return 'Start with / for a page on this site, or use a full web address (https://…).'
    },
  } as TextField
}

export function emailField(field: Omit<EmailField, 'type'> & { type?: 'email' | 'text' }): EmailField {
  return {
    ...field,
    custom: shared(field),
    type: 'email',
    hooks: { ...field.hooks, beforeValidate: [...(field.hooks?.beforeValidate ?? []), tidyEmailHook] },
    admin: withButton(EMAIL_LINK, field.admin),
  } as EmailField
}

export function tidyEmail(field: Text): TextField {
  return { ...field, custom: shared(field), type: 'text', hooks: withHook(field, tidyEmailHook), admin: withButton(EMAIL_LINK, field.admin) } as TextField
}

/** Tidy only (https:// on a bare domain, trimmed), no check: public-form input. */
export function lenientLink(field: Text): TextField {
  return { ...field, custom: shared(field), type: 'text', hooks: withHook(field, tidyLink(false)) } as TextField
}

/** "(415) 555-0123" for a US number (10 digits, or 11 starting with 1), with
 * any extension kept; anything else is left as typed. */
export function formatPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const v = value.trim()
  if (!v) return null
  const [main = '', ext] = v.split(/\s*(?:ext\.?|x|#)\s*/i)
  let digits = main.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1') && !main.trim().startsWith('+')) digits = digits.slice(1)
  if (main.trim().startsWith('+1') && digits.length === 11) digits = digits.slice(1)
  if (digits.length !== 10) return v
  const us = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return ext && /^\d+$/.test(ext) ? `${us} ext. ${ext}` : us
}

export function phoneField(field: Text): TextField {
  return {
    ...field,
    custom: shared(field),
    type: 'text',
    hooks: withHook(field, ({ value }) => formatPhone(value)),
    admin: withButton(CALL_LINK, { placeholder: '(415) 555-0123', ...field.admin }),
    validate: (value: unknown) => {
      if (value == null || value === '') return field.required ? 'Enter a phone number.' : true
      const digits = String(value).replace(/\D/g, '')
      return (digits.length >= 10 && digits.length <= 15) || 'Enter a full phone number, e.g. (415) 555-0123.'
    },
  } as TextField
}
