/**
 * Field discovery for the reference agents. Clients name things differently
 * (`website` vs `url`, `bio` vs `description`), so each agent slot is matched
 * by a small name heuristic over the collection's flattened fields, with
 * per-collection overrides winning.
 */
export type FlatField = { path: string; type: string; relationTo?: string }

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
    out.push({ path, type, ...(typeof field.relationTo === 'string' ? { relationTo: field.relationTo } : {}) })
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
