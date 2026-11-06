import type { Field, FlattenedField } from 'payload'
import { flattenAllFields } from 'payload/shared'

import { rowLabelOf } from '../conventions/rowLabelOf'

/**
 * Turns a proposal's raw values into something an editor can read without
 * knowing the schema: field labels from the target collection's config and
 * each value as text, paragraphs, a list, a media reference or (last resort)
 * pretty JSON. Pure functions over config and values; no Payload calls.
 */

export type Rendered =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'rich'; items: RichItem[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'ref'; collection: string; id: string; label: string; src?: string }
  | { kind: 'image'; src: string; credit?: string }
  | { kind: 'links'; items: Array<{ label: string; href: string }> }
  | { kind: 'json'; text: string }

/** One block of rich text as the review shows it: headings stay headings, lists stay lists. */
export type RichItem =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }

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

/** The top-level blocks of a Lexical tree, keeping what kind of block each is. */
export function lexicalBlocks(value: unknown): RichItem[] {
  if (!isLexical(value)) return []
  const out: RichItem[] = []
  for (const block of value.root.children ?? []) {
    const b = block as { type?: string; tag?: string; listType?: string; children?: unknown[] }
    if (b.type === 'list') {
      const items = (b.children ?? []).map((item) => textOf(item).trim()).filter(Boolean)
      if (items.length) out.push({ type: 'list', ordered: b.listType === 'number', items })
      continue
    }
    const text = textOf(b).trim()
    if (!text) continue
    if (b.type === 'heading') out.push({ type: 'heading', text, level: Number(String(b.tag ?? 'h2').slice(1)) || 2 })
    else if (b.type === 'quote') out.push({ type: 'quote', text })
    else out.push({ type: 'paragraph', text })
  }
  return out
}

/** One string per top-level block, for plain text (search, labels); list items get a bullet. */
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
    const items = lexicalBlocks(value)
    return items.length ? { kind: 'rich', items } : { kind: 'empty' }
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

/** One section of a blocks field in a proposal, as the editor reads the change. */
export type SectionChange = {
  change: 'same' | 'changed' | 'added' | 'removed' | 'moved'
  /** The block's label, e.g. "FAQ". */
  type: string
  /** The section's own heading, when it has one. */
  title?: string
  /** "Heading: “Old” → “New”", "Questions: 3 → 4", or for a new section its content in brief. */
  details: string[]
}

type Row = Record<string, unknown> & { id?: unknown; blockType?: unknown }

const clip = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const blockFor = (field: FlattenedField, slug: unknown): { label: string; fields: FlattenedField[] } | null => {
  if (field.type !== 'blocks') return null
  const block = field.blocks.find((b): b is Exclude<typeof b, string> => typeof b !== 'string' && b.slug === slug)
  if (!block) return null
  return { label: fieldLabelText(block.labels?.singular, block.slug), fields: block.flattenedFields }
}

/** A short plain-text version of a value, for one line of a change list. */
function brief(value: unknown, field: FlattenedField): string {
  if (value === undefined || value === null || value === '') return ''
  if (isLexical(value)) return lexicalParagraphs(value).join(' ')
  if (field.type === 'upload' || field.type === 'relationship') return `#${String(typeof value === 'object' && value && 'id' in value ? (value as { id: unknown }).id : value)}`
  if (Array.isArray(value)) return String(value.length)
  if (typeof value === 'object') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/** What a row leads with (as in its admin header); for a text-only section, its first line. */
function rowTitle(fields: FlattenedField[], row: Row): string | undefined {
  const label = rowLabelOf(row)
  if (label) return clip(label, 70)
  const rich = fields.find((f) => f.type === 'richText' && isLexical(row[f.name]))
  const first = rich ? lexicalParagraphs(row[rich.name])[0] : undefined
  return first ? clip(first, 70) : undefined
}

function arrayDetail(label: string, f: FlattenedField, before: unknown, after: unknown): string {
  const a = Array.isArray(before) ? (before as Row[]) : []
  const b = Array.isArray(after) ? (after as Row[]) : []
  const fields = 'flattenedFields' in f ? (f.flattenedFields as FlattenedField[]) : []
  const titles = (rows: Row[]) => rows.map((r) => rowTitle(fields, r)).filter(Boolean) as string[]
  const added = titles(b).filter((t) => !titles(a).includes(t))
  if (a.length === b.length) return `${label}: edited${added.length ? ` (${added.map((t) => `“${t}”`).join(', ')})` : ''}`
  return `${label}: ${a.length} → ${b.length}${added.length ? ` (${added.map((t) => `“${t}”`).join(', ')})` : ''}`
}

function fieldDetails(fields: FlattenedField[], before: Row | null, after: Row, language: string): string[] {
  const out: string[] = []
  for (const f of fields) {
    if (!('name' in f) || f.type === 'join') continue
    const label = fieldLabelText(f.label, f.name, language)
    const a = before?.[f.name]
    const b = after[f.name]
    if (before && sameValue(a, b)) continue
    if (f.type === 'array') {
      if (!before) {
        const n = Array.isArray(b) ? b.length : 0
        const fieldsOf = 'flattenedFields' in f ? (f.flattenedFields as FlattenedField[]) : []
        const t = (Array.isArray(b) ? (b as Row[]) : []).map((r) => rowTitle(fieldsOf, r)).filter(Boolean) as string[]
        if (n) out.push(`${label}: ${t.length ? t.map((x) => `“${x}”`).join(', ') : n}`)
      } else out.push(arrayDetail(label, f, a, b))
      continue
    }
    if (f.type === 'group') {
      const inner = 'flattenedFields' in f ? (f.flattenedFields as FlattenedField[]) : []
      out.push(...fieldDetails(inner, before ? ((a ?? {}) as Row) : null, (b ?? {}) as Row, language).map((d) => `${label} › ${d}`))
      continue
    }
    const nb = brief(b, f)
    const na = before ? brief(a, f) : ''
    if (!before) {
      if (nb && f.type !== 'select' && f.type !== 'radio' && f.type !== 'checkbox') out.push(`${label}: “${clip(nb)}”`)
    } else if (!na) out.push(`${label}: “${clip(nb)}” (new)`)
    else if (!nb) out.push(`${label}: removed`)
    else if (f.type === 'richText') out.push(`${label}: rewritten (“${clip(nb, 70)}”)`)
    else out.push(`${label}: “${clip(na, 60)}” → “${clip(nb, 60)}”`)
  }
  return out
}

/** Indexes of a longest increasing run, for telling moved sections from ones that only shifted. */
function longestIncreasing(seq: number[]): Set<number> {
  const tails: number[] = []
  const prev: number[] = new Array(seq.length).fill(-1)
  seq.forEach((v, i) => {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (seq[tails[mid]!]! < v) lo = mid + 1
      else hi = mid
    }
    prev[i] = lo > 0 ? tails[lo - 1]! : -1
    tails[lo] = i
  })
  const keep = new Set<number>()
  let k = tails.length ? tails[tails.length - 1]! : -1
  while (k >= 0) {
    keep.add(k)
    k = prev[k]!
  }
  return keep
}

/**
 * The change list for a blocks field: the proposed sections in order, each
 * marked same, changed, added or moved (matched to the current ones by row
 * id), then the removed ones.
 */
export function sectionChanges(field: FlattenedField | null, current: unknown, proposed: unknown, language = 'en'): SectionChange[] | null {
  if (!field || field.type !== 'blocks') return null
  const before = (Array.isArray(current) ? current : []) as Row[]
  const after = (Array.isArray(proposed) ? proposed : []) as Row[]
  const index = new Map(before.map((row, i) => [String(row.id), i]))
  const keptOrder = after.map((row) => (row.id !== undefined ? index.get(String(row.id)) : undefined)).filter((i): i is number => i !== undefined)
  const inPlace = longestIncreasing(keptOrder)
  let kept = 0
  const used = new Set<number>()
  const out: SectionChange[] = after.map((row) => {
    const block = blockFor(field, row.blockType)
    const type = block?.label ?? titleCase(String(row.blockType ?? 'section'))
    const title = block ? rowTitle(block.fields, row) : undefined
    const was = row.id !== undefined ? index.get(String(row.id)) : undefined
    if (was === undefined) return { change: 'added', type, title, details: block ? fieldDetails(block.fields, null, row, language) : [] }
    used.add(was)
    const moved = !inPlace.has(kept++)
    const details = block ? fieldDetails(block.fields, before[was]!, row, language) : []
    return { change: details.length ? 'changed' : moved ? 'moved' : 'same', type, title, details: moved && details.length ? ['Moved', ...details] : details }
  })
  before.forEach((row, i) => {
    if (used.has(i)) return
    const block = blockFor(field, row.blockType)
    out.push({ change: 'removed', type: block?.label ?? titleCase(String(row.blockType ?? 'section')), title: block ? rowTitle(block.fields, row) : undefined, details: [] })
  })
  return out
}
