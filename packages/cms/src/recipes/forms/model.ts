/**
 * The rules of a form, free of Payload so they're tested on their own: what a field is,
 * how answers are checked, and how a submission reads in a list and an email. Shared by
 * the submit endpoint and (types only) the site's form renderer.
 */
export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox'

export type FormField = {
  blockType: FormFieldType
  /** Set once from the label and kept, so past submissions still line up. */
  key: string
  label: string
  required?: boolean | null
  placeholder?: string | null
  help?: string | null
  width?: 'full' | 'half' | null
  options?: { label: string; value?: string | null; id?: string | null }[] | null
}

export type FormDefinition = {
  id: number | string
  title: string
  fields?: FormField[] | null
  submitLabel?: string | null
  confirmation?: string | null
}

export type Answer = { key: string; label: string; value: string }

/** Answers are stored as text: long enough for a message, short enough not to be an attack. */
export const MAX_ANSWER = 5000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** `Your email` → `your-email`, unique within the form (`-2`, `-3`). */
export function nameFor(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'field'
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`
  taken.add(name)
  return name
}

/** A select option's stored value: its own, or one made from its label. */
export const optionValue = (o: { label: string; value?: string | null }) => (o.value?.trim() ? o.value.trim() : nameFor(o.label, new Set()))

/**
 * Check what came in against the form. Returns the answers in the form's order (labels kept,
 * so a later edit to the form doesn't change old submissions) or the problems by field name.
 */
export function checkAnswers(form: FormDefinition, input: Record<string, unknown>): { answers: Answer[] } | { errors: Record<string, string> } {
  const answers: Answer[] = []
  const errors: Record<string, string> = {}
  for (const field of form.fields ?? []) {
    const raw = input[field.key]
    let value = field.blockType === 'checkbox' ? (raw === true || raw === 'true' || raw === 'on' ? 'Yes' : '') : typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
    if (!value) {
      if (field.required) errors[field.key] = field.blockType === 'checkbox' ? 'Please tick this box.' : `Please fill in ${field.label.toLowerCase()}.`
      else answers.push({ key: field.key, label: field.label, value: field.blockType === 'checkbox' ? 'No' : '' })
      continue
    }
    if (value.length > MAX_ANSWER) {
      errors[field.key] = `That's too long: up to ${MAX_ANSWER} characters.`
      continue
    }
    if (field.blockType === 'email' && !EMAIL.test(value)) errors[field.key] = 'Please enter an email address like name@example.com.'
    if (field.blockType === 'phone' && value.replace(/\D/g, '').length < 7) errors[field.key] = 'Please enter a full phone number.'
    if (field.blockType === 'select') {
      const option = (field.options ?? []).find((o) => optionValue(o) === value || o.label === value)
      if (!option) errors[field.key] = 'Please choose one of the options.'
      else value = option.label
    }
    if (!errors[field.key]) answers.push({ key: field.key, label: field.label, value })
  }
  return Object.keys(errors).length ? { errors } : { answers }
}

/** A submission's title in lists: who it's from if the form asked, else its first answer. */
export function summaryOf(answers: Answer[], fields: FormField[] = []): string {
  const byType = (type: FormFieldType) => answers.find((a) => a.value && fields.find((f) => f.key === a.key)?.blockType === type)
  const name = answers.find((a) => a.value && /\bname\b/i.test(a.label))
  const email = byType('email')
  const first = answers.find((a) => a.value && a.value !== 'No')
  const pick = [name?.value, email?.value].filter(Boolean).join(' · ') || first?.value || 'Empty submission'
  return pick.length > 120 ? `${pick.slice(0, 118)}…` : pick
}

/** The submitter's address, for Reply-To on the notification. */
export const replyToOf = (answers: Answer[], fields: FormField[] = []): string | undefined =>
  answers.find((a) => a.value && fields.find((f) => f.key === a.key)?.blockType === 'email')?.value

/** The notification email: every answer, labelled, and a link to the submission. */
export function notificationOf({ form, answers, site, url }: { form: Pick<FormDefinition, 'title'>; answers: Answer[]; site: string; url: string }) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rows = answers.filter((a) => a.value)
  // "Demo Co." shouldn't end a sentence with two stops; "What is it about?" needs no colon.
  const place = site.replace(/\.+$/, '')
  const heading = (label: string) => (/[?:!]$/.test(label) ? label : `${label}:`)
  return {
    subject: `New ${form.title} submission`,
    text: [`Someone filled in "${form.title}" on ${place}.`, '', ...rows.map((a) => `${heading(a.label)}\n${a.value}\n`), `See it in the admin: ${url}`].join('\n'),
    html: [
      `<p>Someone filled in <strong>${esc(form.title)}</strong> on ${esc(place)}.</p>`,
      '<table cellpadding="6" style="border-collapse:collapse">',
      ...rows.map((a) => `<tr><th align="left" valign="top" style="color:#555;font-weight:600">${esc(a.label)}</th><td style="white-space:pre-wrap">${esc(a.value)}</td></tr>`),
      '</table>',
      `<p><a href="${esc(url)}">See it in the admin</a></p>`,
    ].join('\n'),
  }
}
