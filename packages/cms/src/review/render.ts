import type { Field, FlattenedField } from 'payload'
import { flattenAllFields } from 'payload/shared'

/**
 * Turns a proposal's raw values into something an editor can read without
 * knowing the schema: field labels from the target collection's config and
 * each value as text, paragraphs, a list, a media reference or (last resort)
 * pretty JSON. Pure functions over config and values; no Payload calls.
 */

export type Rendered =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'paragraphs'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'ref'; collection: string; id: string; label: string; src?: string }
  | { kind: 'image'; src: string; credit?: string }
  | { kind: 'links'; items: Array<{ label: string; href: string }> }
  | { kind: 'json'; text: string }

/** Where a value points when the field is a relationship or upload. */
export type RefTarget = { collection: string; id: string }

/** A field label (string, locale map, function or `false`) as text. */
export function fieldLabelText(label: unknown, name: string, language = 'en'): string {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const map = label as Record<string, string>
    return map[language] ?? map.en ?? Object.values(map)[0] ?? titleCase(name)
  }
  return titleCase(name)
}

/** `metaTitle` → "Meta title", `seo_image` → "Seo image". */
export function titleCase(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : name
}

/**
 * The field a dotted path lands on, walking groups, tabs and arrays
 * (numeric segments skip into the row). Nothing when the path is not in the
 * schema, so a stale proposal still renders with its raw path.
 */
export function fieldAtPath(fields: Field[], path: string): FlattenedField | null {
  let current: FlattenedField[] = flattenAllFields({ fields })
  let found: FlattenedField | null = null
  for (const segment of path.split('.').filter(Boolean)) {
    if (/^\d+$/.test(segment)) continue
    const match = current.find((f) => 'name' in f && f.name === segment)
    if (!match) return null
    found = match
    current = 'flattenedFields' in match && Array.isArray(match.flattenedFields) ? (match.flattenedFields as FlattenedField[]) : []
  }
  return found
}

/** "SEO › Title" for `seo.title`; the raw path when the schema has no such field. */
export function fieldLabel(fields: Field[], path: string, language = 'en'): string {
  const parts: string[] = []
  let current: FlattenedField[] = flattenAllFields({ fields })
  for (const segment of path.split('.').filter(Boolean)) {
    if (/^\d+$/.test(segment)) {
      parts.push(`#${Number(segment) + 1}`)
      continue
    }
    const match = current.find((f) => 'name' in f && f.name === segment)
    if (!match) return path
    parts.push(fieldLabelText(match.label, match.name, language))
    current = 'flattenedFields' in match && Array.isArray(match.flattenedFields) ? (match.flattenedFields as FlattenedField[]) : []
  }
  return parts.join(' › ') || path
}

/** The collection a single relationship/upload value refers to, if the field names exactly one. */
export function refTarget(field: FlattenedField | null, value: unknown): RefTarget | null {
  if (!field || (field.type !== 'upload' && field.type !== 'relationship')) return null
  if (field.hasMany) return null
  if (typeof field.relationTo === 'string') {
    if (typeof value === 'string' || typeof value === 'number') return { collection: field.relationTo, id: String(value) }
    return null
  }
  // Polymorphic: `{ relationTo, value }`.
  if (value && typeof value === 'object' && 'relationTo' in value && 'value' in value) {
    const v = value as { relationTo: unknown; value: unknown }
    if (typeof v.relationTo === 'string' && (typeof v.value === 'string' || typeof v.value === 'number')) {
      return { collection: v.relationTo, id: String(v.value) }
    }
  }
  return null
}

/** Whether a value looks like a Lexical editor state. */
export function isLexical(value: unknown): value is { root: { children?: unknown[] } } {
  return Boolean(value && typeof value === 'object' && 'root' in value && typeof (value as { root: unknown }).root === 'object')
}

/** Every text node under `node`, joined; list items and line breaks become spaces. */
function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: unknown; children?: unknown[] }
  if (typeof n.text === 'string') return n.text
  if (n.type === 'linebreak') return ' '
  return (n.children ?? []).map(textOf).join('')
}

/** One string per top-level block; list items get a bullet, headings keep their text. */
export function lexicalParagraphs(value: unknown): string[] {
  if (!isLexical(value)) return []
  const out: string[] = []
  for (const block of value.root.children ?? []) {
    const b = block as { type?: string; children?: unknown[] }
    if (b.type === 'list') {
      for (const item of b.children ?? []) {
        const text = textOf(item).trim()
        if (text) out.push(`• ${text}`)
      }
      continue
    }
    const text = textOf(b).trim()
    if (text) out.push(text)
  }
  return out
}

/**
 * A value as something readable. `ref` is returned unresolved; the view
 * resolves it to a title and thumbnail with the editor's access.
 */
export function renderValue(value: unknown, field: FlattenedField | null): Rendered {
  if (value === undefined || value === null || value === '') return { kind: 'empty' }
  const ref = refTarget(field, value)
  if (ref) return { kind: 'ref', ...ref, label: `${titleCase(ref.collection)} #${ref.id}` }
  if (isLexical(value)) {
    const items = lexicalParagraphs(value)
    return items.length ? { kind: 'paragraphs', items } : { kind: 'empty' }
  }
  if (typeof value === 'boolean') return { kind: 'text', text: value ? 'Yes' : 'No' }
  if (typeof value === 'number') return { kind: 'text', text: String(value) }
  if (typeof value === 'string') return { kind: 'text', text: value }
  // An image an agent found on the web; imported into the media library on accept.
  if (webImage(value)) return { kind: 'image', src: value.sourceUrl, ...(typeof value.credit === 'string' && value.credit ? { credit: value.credit } : {}) }
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'empty' }
    if (value.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      return { kind: 'list', items: value.map((v) => String(v)) }
    }
    // Rows that each carry a link (social profiles, related links): label + URL.
    const links = value.map(linkRow)
    if (links.every((l): l is { label: string; href: string } => l !== null)) return { kind: 'links', items: links }
    return { kind: 'json', text: JSON.stringify(value, null, 2) }
  }
  return { kind: 'json', text: JSON.stringify(value, null, 2) }
}

const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v)

function webImage(value: unknown): value is { sourceUrl: string; credit?: unknown } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && isHttp((value as { sourceUrl?: unknown }).sourceUrl))
}

function linkRow(row: unknown): { label: string; href: string } | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const href = [r.url, r.href, r.link].find(isHttp)
  if (!href) return null
  const label = [r.platform, r.label, r.title, r.name].find((v): v is string => typeof v === 'string' && Boolean(v.trim()))
  return { label: label?.trim() ?? new URL(href).hostname.replace(/^www\./, ''), href }
}
