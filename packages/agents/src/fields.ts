/**
 * Field discovery for the reference agents. Clients name things differently
 * (`website` vs `url`, `bio` vs `description`), so each agent slot is matched
 * by a small name heuristic over the collection's flattened fields, with
 * per-collection overrides winning.
 */
/** `fields` is kept for arrays: the row schema, for shaping proposed rows. */
export type FlatField = { path: string; type: string; relationTo?: string; fields?: Array<Record<string, unknown>> }

const layout = new Set(['row', 'collapsible', 'tabs'])

export function flattenFields(fields: Array<Record<string, unknown>>, prefix = ''): FlatField[] {
  const out: FlatField[] = []
  for (const field of fields) {
    const type = String(field.type ?? '')
    const name = typeof field.name === 'string' ? field.name : undefined
    const inner = Array.isArray(field.fields) ? (field.fields as Array<Record<string, unknown>>) : []
    if (type === 'tabs' && Array.isArray(field.tabs)) {
      for (const tab of field.tabs as Array<Record<string, unknown>>) {
        const tabName = typeof tab.name === 'string' ? tab.name : undefined
        out.push(...flattenFields((tab.fields as Array<Record<string, unknown>>) ?? [], tabName ? `${prefix}${tabName}.` : prefix))
      }
      continue
    }
    if (layout.has(type) || (type === 'group' && !name)) {
      out.push(...flattenFields(inner, prefix))
      continue
    }
    if (!name) continue
    const path = `${prefix}${name}`
    out.push({ path, type, ...(typeof field.relationTo === 'string' ? { relationTo: field.relationTo } : {}), ...(type === 'array' ? { fields: inner } : {}) })
    if (type === 'group') out.push(...flattenFields(inner, `${path}.`))
  }
  return out
}

/** First field whose last path segment matches, preferring the listed types in order. */
export function pickField(fields: FlatField[], pattern: RegExp, preferTypes: string[] = []): string | undefined {
  const matches = fields.filter((f) => pattern.test(f.path.split('.').pop() ?? ''))
  for (const type of preferTypes) {
    const hit = matches.find((f) => f.type === type)
    if (hit) return hit.path
  }
  return matches[0]?.path
}

const PLATFORM_ALIASES: Record<string, string> = { twitter: 'x', 'x.com': 'x', 'twitter.com': 'x', ig: 'instagram', yt: 'youtube', bsky: 'bluesky' }
const optionValue = (o: unknown) => (typeof o === 'string' ? o : o && typeof o === 'object' && typeof (o as { value?: unknown }).value === 'string' ? (o as { value: string }).value : null)

/**
 * Fit `{ platform, url }` rows found by an agent to the collection's own row
 * schema: the URL goes to the row's url-like text field, the platform to its
 * select (matched case-insensitively, common aliases mapped, else `other`
 * when the select has it, else the row is dropped). Rows that cannot be
 * placed are dropped so the editor never accepts a value that fails saving.
 */
export function shapeLinkRows(rows: Array<{ platform?: string; url: string }>, rowFields: Array<Record<string, unknown>> = []): Array<Record<string, string>> {
  const flat = flattenFields(rowFields)
  const urlField = pickField(flat, /^(url|link|href|profile|address)$/i, ['text']) ?? flat.find((f) => f.type === 'text')?.path
  const platformDef = rowFields.find((f) => f.type === 'select' && typeof f.name === 'string') as { name: string; options?: unknown[] } | undefined
  const labelField = platformDef ? undefined : pickField(flat, /^(platform|label|name|title|network)$/i, ['text'])
  if (!urlField) return []
  const options = (platformDef?.options ?? []).map(optionValue).filter((v): v is string => v !== null)
  const out: Array<Record<string, string>> = []
  for (const row of rows) {
    const shaped: Record<string, string> = { [urlField]: row.url }
    if (platformDef) {
      const raw = (row.platform ?? '').trim().toLowerCase()
      const wanted = PLATFORM_ALIASES[raw] ?? raw
      const match = options.find((o) => o.toLowerCase() === wanted) ?? (options.includes('other') ? 'other' : undefined)
      if (!match) continue
      shaped[platformDef.name] = match
    } else if (labelField && row.platform) shaped[labelField] = row.platform
    out.push(shaped)
  }
  return out
}
