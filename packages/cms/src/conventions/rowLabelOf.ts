/**
 * The text a row leads with, for row headers and change lists: its own
 * name, heading, title, label or question, whichever it has, then a quote or
 * caption, then (one level down) a group's label, then the first line of
 * its rich text. The eyebrow only as a last resort (it is the same small
 * label on many sections), and never an id. Pure, so the server-rendered
 * review view and the client row labels agree.
 */
const LABEL_KEYS = ['name', 'heading', 'headline', 'title', 'label', 'question', 'term', 'quote', 'caption', 'text', 'value', 'handle', 'attribution']

export function rowLabelOf(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  for (const key of LABEL_KEYS) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\s+/g, ' ')
    if (typeof v === 'number') return String(v)
  }
  // One level into groups (e.g. a link group's label).
  if (depth === 0) {
    for (const v of Object.values(row)) {
      const inner = v && typeof v === 'object' && !Array.isArray(v) && !('root' in v) ? rowLabelOf(v, 1) : null
      if (inner) return inner
    }
    for (const v of Object.values(row)) {
      const line = v && typeof v === 'object' && 'root' in v ? firstLine((v as { root: unknown }).root) : ''
      if (line) return line
    }
  }
  return typeof row.eyebrow === 'string' && row.eyebrow.trim() ? row.eyebrow.trim() : null
}

/** The first non-empty block of a Lexical tree, as text. */
function firstLine(root: unknown): string {
  const text = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const n = node as { text?: unknown; children?: unknown[] }
    return typeof n.text === 'string' ? n.text : (n.children ?? []).map(text).join('')
  }
  for (const block of ((root as { children?: unknown[] } | null)?.children ?? [])) {
    const t = text(block).trim().replace(/\s+/g, ' ')
    if (t) return t
  }
  return ''
}

const ADDRESS_KEYS = ['url', 'href', 'link', 'website', 'email', 'phone']

/**
 * For a row with no words of its own (a social link: a platform and a URL): the choice it
 * made, by its option label, and the address, shortened. "LinkedIn · linkedin.com/in/lee".
 */
export function choiceLabelOf(data: unknown, choices: Record<string, Record<string, string>> = {}): string | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const parts: string[] = []
  for (const [name, options] of Object.entries(choices)) {
    const v = row[name]
    if (typeof v === 'string' && v) {
      parts.push(options[v] ?? v)
      break
    }
  }
  for (const key of ADDRESS_KEYS) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) {
      parts.push(shortAddress(v.trim()))
      break
    }
  }
  return parts.length ? parts.join(' · ') : null
}

const shortAddress = (value: string) => value.replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/^mailto:|^tel:/i, '').replace(/\/$/, '')
