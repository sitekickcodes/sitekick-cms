import { lexicalToMarkdown, markdownToLexical } from './lexical'

/**
 * Blocks as an agent reads and writes them. The model never sees Payload's
 * storage shape: rich text is Markdown, uploads and relationships are ids,
 * row ids and empty values are left out. `fromModel` turns the model's JSON
 * back into storage shape and reports every problem in words the model can
 * act on (unknown field, option not allowed, required, the field's own
 * validation), so the agent can correct itself before anything is proposed.
 */
type FieldConfig = Record<string, unknown> & {
  type: string
  name?: string
  fields?: FieldConfig[]
  tabs?: Array<{ name?: string; fields?: FieldConfig[] }>
  blocks?: BlockConfig[]
  options?: unknown[]
  relationTo?: unknown
  required?: boolean
  hasMany?: boolean
  minRows?: number
  maxRows?: number
  admin?: { description?: unknown; condition?: (...args: never[]) => unknown; readOnly?: boolean; hidden?: boolean }
  validate?: (...args: never[]) => unknown
}
export type BlockConfig = { slug: string; labels?: { singular?: unknown }; fields: FieldConfig[]; admin?: { group?: unknown } }
export type BlockRow = Record<string, unknown> & { blockType: string; id?: string }

const LAYOUT = new Set(['row', 'collapsible'])

/** The named data fields of a field list, looking through rows, collapsibles, unnamed groups and unnamed tabs. */
export function dataFields(fields: FieldConfig[] = []): FieldConfig[] {
  const out: FieldConfig[] = []
  for (const f of fields) {
    if (f.type === 'ui') continue
    if (LAYOUT.has(f.type) || (f.type === 'group' && !f.name)) out.push(...dataFields(f.fields))
    else if (f.type === 'tabs') for (const tab of f.tabs ?? []) out.push(...(tab.name ? [{ type: 'group', name: tab.name, fields: tab.fields } as FieldConfig] : dataFields(tab.fields)))
    else if (f.name) out.push(f)
  }
  return out
}

export const labelText = (label: unknown, fallback: string): string =>
  typeof label === 'string' ? label : label && typeof label === 'object' ? String((label as Record<string, unknown>).en ?? Object.values(label)[0] ?? fallback) : fallback

const optionValues = (options: unknown[] = []): string[] =>
  options.map((o) => (typeof o === 'string' ? o : o && typeof o === 'object' ? String((o as { value?: unknown }).value) : '')).filter(Boolean)

const relationOf = (f: FieldConfig): string => (typeof f.relationTo === 'string' ? f.relationTo : Array.isArray(f.relationTo) ? f.relationTo.join('|') : '')

/** One line per field, nested for arrays and groups: what the model may write. */
function describeFields(fields: FieldConfig[], indent: string): string[] {
  const lines: string[] = []
  for (const f of dataFields(fields)) {
    if (f.admin?.hidden || f.admin?.readOnly) continue
    const bits: string[] = []
    switch (f.type) {
      case 'richText':
        bits.push('rich text: write Markdown')
        break
      case 'upload':
        bits.push(`image: a ${relationOf(f)} id (use search_media), or omit`)
        break
      case 'relationship':
        bits.push(`link to ${relationOf(f)}: an id from the list of pages`)
        break
      case 'select':
      case 'radio':
        bits.push(`one of ${optionValues(f.options).map((v) => JSON.stringify(v)).join(', ')}${f.hasMany ? ' (a list)' : ''}`)
        break
      case 'array':
        bits.push(`list${f.minRows ? `, at least ${f.minRows}` : ''}${f.maxRows ? `, at most ${f.maxRows}` : ''} of rows`)
        break
      default:
        bits.push(f.type)
    }
    if (f.required) bits.push('required')
    const description = typeof f.admin?.description === 'string' ? ` — ${f.admin.description}` : ''
    lines.push(`${indent}- ${f.name} (${bits.join(', ')})${description}`)
    if (f.type === 'array' || f.type === 'group') lines.push(...describeFields(f.fields ?? [], `${indent}  `))
  }
  return lines
}

/** The block catalogue in prompt form. */
export function describeBlocks(blocks: BlockConfig[]): string {
  return blocks
    .map((b) => [`### ${b.slug} — ${labelText(b.labels?.singular, b.slug)}`, ...describeFields(b.fields, '')].join('\n'))
    .join('\n\n')
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const idOf = (v: unknown): string | number | null =>
  typeof v === 'string' || typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? ((v as { id: string | number }).id ?? null) : null

/** Stored values → what the model reads. */
export function toModel(fields: FieldConfig[], data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of dataFields(fields)) {
    const v = data[f.name!]
    if (isEmpty(v)) continue
    if (f.type === 'richText') {
      const md = lexicalToMarkdown(v)
      if (md) out[f.name!] = md
    } else if (f.type === 'upload' || f.type === 'relationship') out[f.name!] = Array.isArray(v) ? v.map(idOf) : idOf(v)
    else if (f.type === 'array' && Array.isArray(v)) out[f.name!] = v.map((row) => toModel(f.fields ?? [], (row ?? {}) as Record<string, unknown>))
    else if (f.type === 'group' && v && typeof v === 'object') out[f.name!] = toModel(f.fields ?? [], v as Record<string, unknown>)
    else out[f.name!] = v
  }
  return out
}

export function rowToModel(blocks: BlockConfig[], row: BlockRow): Record<string, unknown> {
  const block = blocks.find((b) => b.slug === row.blockType)
  return { blockType: row.blockType, ...(block ? toModel(block.fields, row) : {}) }
}

/** Ids the model may point at, per collection slug. A missing slug means "any id". */
export type KnownIds = Record<string, Set<string>>

type Ctx = { known: KnownIds; problems: string[] }

/** Model values → stored values for the given fields. Unknown or ill-typed values are reported, not written. */
export function fromModel(fields: FieldConfig[], input: Record<string, unknown>, where: string, ctx: Ctx): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const named = new Map(dataFields(fields).map((f) => [f.name!, f]))
  for (const [key, value] of Object.entries(input)) {
    if (key === 'blockType' || key === 'id' || key === 'blockName') continue
    const f = named.get(key)
    if (!f) {
      ctx.problems.push(`${where}: there is no field "${key}" (fields: ${[...named.keys()].join(', ')})`)
      continue
    }
    if (value === null || value === undefined) {
      out[key] = null
      continue
    }
    const at = `${where} › ${key}`
    switch (f.type) {
      case 'richText':
        if (typeof value === 'string') out[key] = markdownToLexical(value)
        else ctx.problems.push(`${at}: write rich text as a Markdown string`)
        break
      case 'upload':
      case 'relationship': {
        const relation = relationOf(f)
        const ids = Array.isArray(value) ? value : [value]
        const bad = ids.filter((id) => (typeof id !== 'string' && typeof id !== 'number') || (ctx.known[relation] && !ctx.known[relation].has(String(id))))
        if (bad.length) ctx.problems.push(`${at}: ${bad.map((b) => JSON.stringify(b)).join(', ')} is not a known ${relation} id${f.type === 'upload' ? ' (use search_media, or leave the image out)' : ''}`)
        else out[key] = f.hasMany ? ids : ids[0]
        break
      }
      case 'select':
      case 'radio': {
        const allowed = optionValues(f.options)
        const values = Array.isArray(value) ? value : [value]
        const bad = values.filter((v) => !allowed.includes(String(v)))
        if (bad.length) ctx.problems.push(`${at}: ${bad.map((b) => JSON.stringify(b)).join(', ')} is not an option (${allowed.join(', ')})`)
        else out[key] = f.hasMany ? values : values[0]
        break
      }
      case 'array':
        if (!Array.isArray(value)) ctx.problems.push(`${at}: expected a list of rows`)
        else out[key] = value.map((row, i) => (row && typeof row === 'object' ? fromModel(f.fields ?? [], row as Record<string, unknown>, `${at} #${i + 1}`, ctx) : (ctx.problems.push(`${at} #${i + 1}: expected an object`), {})))
        break
      case 'group':
        if (typeof value !== 'object' || Array.isArray(value)) ctx.problems.push(`${at}: expected an object`)
        else out[key] = fromModel(f.fields ?? [], value as Record<string, unknown>, at, ctx)
        break
      case 'number':
        if (typeof value === 'number') out[key] = value
        else if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) out[key] = Number(value)
        else ctx.problems.push(`${at}: expected a number`)
        break
      case 'checkbox':
        out[key] = Boolean(value)
        break
      case 'text':
      case 'textarea':
      case 'email':
      case 'code':
        if (typeof value === 'string' || typeof value === 'number') out[key] = String(value)
        else ctx.problems.push(`${at}: expected text`)
        break
      default:
        out[key] = value
    }
  }
  return out
}

/** Config functions take Payload's own argument types; a dry run calls them loosely. */
const call = (fn: (...args: never[]) => unknown, ...args: unknown[]): unknown => (fn as (...a: unknown[]) => unknown)(...args)

/** The minimum of a PayloadRequest that Payload's built-in validators read. */
const validatorReq = (payload: unknown) => ({
  payload,
  user: null,
  t: (key: string, vars?: Record<string, unknown>) => {
    const k = key.replace(/^validation:/, '')
    if (k === 'required') return 'This field is required.'
    return vars ? `${k} ${JSON.stringify(vars)}` : k
  },
  i18n: { language: 'en' },
  context: {},
})

/**
 * Run Payload's per-field validation (built-in and custom) over stored-shape
 * data, honouring `admin.condition`. A validator that throws is skipped: it
 * needs more of the request than a dry run has, and the real save will run it.
 */
export async function validateFields(fields: FieldConfig[], data: Record<string, unknown>, where: string, ctx: { problems: string[]; payload: unknown; root: Record<string, unknown> }): Promise<void> {
  const req = validatorReq(ctx.payload)
  for (const f of dataFields(fields)) {
    const value = data[f.name!]
    const condition = f.admin?.condition
    if (typeof condition === 'function') {
      try {
        if (!call(condition, ctx.root, data, { user: null })) continue
      } catch {
        /* treat as shown */
      }
    }
    const at = `${where} › ${f.name}`
    if (f.required && isEmpty(value) && f.type !== 'array' && f.type !== 'checkbox') {
      ctx.problems.push(`${at}: required`)
      continue
    }
    if (typeof f.validate === 'function') {
      try {
        const result = await call(f.validate, value, { data: ctx.root, siblingData: data, req, required: f.required, operation: 'update', event: 'submit', path: [], preferences: { fields: {} }, previousValue: undefined, blockData: data })
        if (typeof result === 'string') ctx.problems.push(`${at}: ${result}`)
      } catch {
        /* see above */
      }
    }
    if (f.type === 'array' && Array.isArray(value)) {
      for (const [i, row] of value.entries()) await validateFields(f.fields ?? [], (row ?? {}) as Record<string, unknown>, `${at} #${i + 1}`, ctx)
    } else if (f.type === 'group' && value && typeof value === 'object') await validateFields(f.fields ?? [], value as Record<string, unknown>, at, ctx)
  }
}

/** What the agent proposes: the page's sections in their new order. */
export type SectionPlan = Array<{ keep: number } | { edit: number; set: Record<string, unknown> } | { add: Record<string, unknown> & { blockType: string } }>

export type AppliedPlan = { layout: BlockRow[]; problems: string[]; changed: boolean }

const sectionName = (blocks: BlockConfig[], row: { blockType?: unknown }, n: number) =>
  `Section ${n + 1} (${labelText(blocks.find((b) => b.slug === row.blockType)?.labels?.singular, String(row.blockType))})`

/**
 * Build the new layout from a plan over the current one. Kept sections are
 * copied byte for byte (ids, images, rich text untouched); edits replace the
 * named fields only; additions get no id so Payload assigns one. Then the
 * whole layout is validated, including the blocks field's own rule.
 */
export async function applySectionPlan({
  plan,
  current,
  blocksField,
  known,
  payload,
}: {
  plan: SectionPlan
  current: BlockRow[]
  blocksField: FieldConfig & { blocks: BlockConfig[] }
  known: KnownIds
  payload: unknown
}): Promise<AppliedPlan> {
  const blocks = blocksField.blocks
  const ctx = { known, problems: [] as string[] }
  const used = new Set<number>()
  const layout: BlockRow[] = []
  const claim = (i: number, n: number): BlockRow | null => {
    if (!Number.isInteger(i) || i < 0 || i >= current.length) {
      ctx.problems.push(`Step ${n + 1}: there is no current section ${i}`)
      return null
    }
    if (used.has(i)) {
      ctx.problems.push(`Step ${n + 1}: section ${i} is used twice; keep or edit each section once`)
      return null
    }
    used.add(i)
    return current[i]!
  }
  plan.forEach((step, n) => {
    if ('keep' in step) {
      const row = claim(step.keep, n)
      if (row) layout.push(row)
    } else if ('edit' in step) {
      const row = claim(step.edit, n)
      if (!row) return
      const block = blocks.find((b) => b.slug === row.blockType)
      layout.push({ ...row, ...fromModel(block?.fields ?? [], step.set ?? {}, sectionName(blocks, row, layout.length), ctx) })
    } else if ('add' in step) {
      const block = blocks.find((b) => b.slug === step.add.blockType)
      if (!block) {
        ctx.problems.push(`Step ${n + 1}: "${step.add.blockType}" is not a section type (${blocks.map((b) => b.slug).join(', ')})`)
        return
      }
      layout.push({ blockType: block.slug, ...fromModel(block.fields, step.add, sectionName(blocks, step.add, layout.length), ctx) })
    }
  })
  const root = { [blocksField.name ?? 'layout']: layout }
  for (const [i, row] of layout.entries()) {
    const block = blocks.find((b) => b.slug === row.blockType)
    if (block) await validateFields(block.fields, row, sectionName(blocks, row, i), { problems: ctx.problems, payload, root })
  }
  if (typeof blocksField.validate === 'function') {
    try {
      const result = await call(blocksField.validate, layout, { data: root, siblingData: root, req: validatorReq(payload), required: blocksField.required, operation: 'update', event: 'submit', path: [], preferences: { fields: {} } })
      if (typeof result === 'string') ctx.problems.push(`The page: ${result}`)
    } catch {
      /* see validateFields */
    }
  }
  const changed = JSON.stringify(layout) !== JSON.stringify(current)
  return { layout, problems: ctx.problems, changed }
}
