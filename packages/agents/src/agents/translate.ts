import { generateText } from 'ai'

import type { GenerateLike } from '../actions'
import { costFromResult, resolveModel } from '../model'
import type { AgentPayload, Doc } from '../payload'
import { createProposal } from '../proposals'
import { syntheticReceipt } from '../receipts'
import { claimRun, failRun, finishRun, startRun, updateRun } from '../runs'
import type { Patch } from '../verifiers'
import { nameOf } from './enrich'

/**
 * Translate: "fill in this page in French". On a site with the localisation recipe, an editor
 * switches the admin to another language and asks for a translation; this reads the default
 * language's words, translates them, and ends in one proposal the editor accepts per field,
 * written to that language only.
 *
 * Words only, structure untouched: the fields it writes are the localised ones (text,
 * textarea, rich text, wherever they sit, inside groups, arrays and blocks too). Rich text is
 * translated text node by text node, so headings, lists, links and bold survive as they are.
 * By default only empty translations are filled; `mode: 'all'` redoes every field.
 *
 * No web, no tools: one model call with the whole document's text in order (context helps
 * the wording), answered as JSON, checked for a translation of every piece.
 */
export type TranslateInput = {
  targetCollection: string
  targetId: string | number
  /** The language to write, e.g. `fr`. Not the default language. */
  locale: string
  /** `missing` (default): only fields that have no translation yet. `all`: every field. */
  mode?: 'missing' | 'all'
}

export type TranslateOptions = {
  runId?: string | number
  triggeredBy?: string | number
  model?: string
  generate?: GenerateLike
  signal?: AbortSignal
}

export type TranslateResult = {
  runId: string | number
  proposalId: string | number | null
  proposed: string[]
  pieces: number
  costUsd: number | null
}

type Field = Record<string, unknown> & { type?: string; name?: string; localized?: boolean; fields?: Field[]; blocks?: Array<Field | string>; tabs?: Field[] }

/** One string to translate: where it sits (a path through the document) and the original. */
export type Piece = { key: string; top: string; path: Array<string | number>; source: string }

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (typeof v === 'object' && v !== null && 'root' in v && !lexicalText(v).trim())

const lexicalText = (v: unknown): string => {
  const out: string[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const node = n as { text?: unknown; children?: unknown[]; root?: unknown }
    if (typeof node.text === 'string') out.push(node.text)
    if (node.root) walk(node.root)
    for (const c of node.children ?? []) walk(c)
  }
  walk(v)
  return out.join('')
}

/** The localised fields at the top level of a collection, through unnamed tabs, rows and collapsibles. */
function topFields(fields: Field[]): Field[] {
  return fields.flatMap((f) => {
    if (f.type === 'tabs') return (f.tabs ?? []).flatMap((t) => (t.name ? [{ ...t, type: 'group' }] : topFields(t.fields ?? [])))
    if ((f.type === 'row' || f.type === 'collapsible') && !f.name) return topFields(f.fields ?? [])
    return f.name ? [f] : []
  })
}

/** Does this field hold any localised words, itself or below? */
function holdsWords(f: Field): boolean {
  if (f.type === 'text' || f.type === 'textarea' || f.type === 'richText') return f.localized === true
  if (f.type === 'group' || f.type === 'array' || f.type === 'row' || f.type === 'collapsible') return (f.fields ?? []).some(holdsWords)
  if (f.type === 'tabs') return (f.tabs ?? []).some((t) => (t.fields ?? []).some(holdsWords))
  if (f.type === 'blocks') return (f.blocks ?? []).some((b) => typeof b === 'object' && (b.fields ?? []).some(holdsWords))
  return false
}

/** Top-level fields the agent may write in another language. Exported for tests. */
export const translatableFields = (fields: Field[]): string[] => topFields(fields).filter(holdsWords).map((f) => f.name!)

/**
 * Every string to translate in one field's value, walking the field config beside the data.
 * `target` is the same field in the language being written: with `onlyMissing`, a piece is
 * collected only where the translation is empty. Exported for tests.
 */
export function collectPieces(field: Field, source: unknown, target: unknown, onlyMissing: boolean, path: Array<string | number> = [], out: Piece[] = []): Piece[] {
  const top = String(path[0] ?? field.name)
  const here = path.length ? path : [field.name!]
  const push = (p: Array<string | number>, text: string) => out.push({ key: String(out.length + 1), top, path: p, source: text })

  switch (field.type) {
    case 'text':
    case 'textarea':
      if (field.localized && typeof source === 'string' && source.trim() && (!onlyMissing || isBlank(target))) push(here, source)
      return out
    case 'richText':
      if (!field.localized || !source || typeof source !== 'object' || (onlyMissing && !isBlank(target))) return out
      walkText(source, [...here], (p, text) => push(p, text))
      return out
    case 'group':
    case 'row':
    case 'collapsible':
      for (const sub of topFields(field.fields ?? [])) collectPieces(sub, get(source, sub.name!), get(target, sub.name!), onlyMissing, [...here, sub.name!], out)
      return out
    case 'array':
      if (!Array.isArray(source)) return out
      source.forEach((row, i) => {
        const match = rowMatch(target, row, i)
        for (const sub of topFields(field.fields ?? [])) collectPieces(sub, get(row, sub.name!), get(match, sub.name!), onlyMissing, [...here, i, sub.name!], out)
      })
      return out
    case 'blocks':
      if (!Array.isArray(source)) return out
      source.forEach((row, i) => {
        const block = (field.blocks ?? []).find((b) => typeof b === 'object' && b.slug === (row as { blockType?: unknown })?.blockType) as Field | undefined
        if (!block) return
        const match = rowMatch(target, row, i)
        for (const sub of topFields(block.fields ?? [])) collectPieces(sub, get(row, sub.name!), get(match, sub.name!), onlyMissing, [...here, i, sub.name!], out)
      })
      return out
    default:
      return out
  }
}

/** The same row in the other language: by id when rows have ids, else by position. */
const rowMatch = (target: unknown, row: unknown, i: number): unknown => {
  if (!Array.isArray(target)) return undefined
  const id = (row as { id?: unknown })?.id
  return (id !== undefined && target.find((t) => (t as { id?: unknown })?.id === id)) || target[i]
}

const get = (v: unknown, key: string | number): unknown => (v && typeof v === 'object' ? (v as Record<string | number, unknown>)[key] : undefined)

/** Text nodes in a Lexical value, with their paths (`root.children.0.children.1.text`). */
function walkText(value: unknown, path: Array<string | number>, visit: (path: Array<string | number>, text: string) => void) {
  const walk = (node: unknown, p: Array<string | number>) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: unknown; text?: unknown; children?: unknown[]; root?: unknown }
    if (n.type === 'text' && typeof n.text === 'string' && n.text.trim()) visit([...p, 'text'], n.text)
    if (n.root) walk(n.root, [...p, 'root'])
    n.children?.forEach((c, i) => walk(c, [...p, 'children', i]))
  }
  walk(value, path)
}

/** Write a value at a path, creating nothing: the path came from the source's own shape. */
function setAt(root: Record<string, unknown>, path: Array<string | number>, value: unknown) {
  let cursor: unknown = root
  for (const key of path.slice(0, -1)) cursor = (cursor as Record<string | number, unknown>)[key]
  ;(cursor as Record<string | number, unknown>)[path[path.length - 1]!] = value
}

/**
 * The value each top-level field should have in the target language: the source's structure
 * with the translations in place. Where a translation already exists and was not redone, it
 * is kept. Exported for tests.
 */
export function applyPieces(fields: string[], source: Doc, target: Doc | null, pieces: Piece[], translations: Record<string, string>, mode: 'missing' | 'all'): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const name of fields) {
    const mine = pieces.filter((p) => p.top === name)
    if (!mine.length) continue
    // Start from the source (it has every row and every rich text node); keep translated
    // leaves the editor already has when only the missing ones were asked for.
    const base = structuredClone({ [name]: source[name] }) as Record<string, unknown>
    if (mode === 'missing' && target) keepExisting(base, name, source[name], target[name])
    for (const p of mine) setAt(base, p.path, translations[p.key])
    out[name] = base[name]
  }
  return out
}

/** Copy existing translations over the source clone, leaf by leaf, wherever the target has one. */
function keepExisting(base: Record<string, unknown>, name: string, source: unknown, target: unknown) {
  const walk = (s: unknown, t: unknown, path: Array<string | number>) => {
    if (t === undefined || t === null) return
    if (typeof s === 'string' || (s && typeof s === 'object' && 'root' in s)) {
      if (!isBlank(t)) setAt(base, path, structuredClone(t))
      return
    }
    if (Array.isArray(s)) return s.forEach((row, i) => walk(row, rowMatch(t, row, i), [...path, i]))
    if (s && typeof s === 'object') for (const k of Object.keys(s)) if (k !== 'id' && k !== 'blockType') walk((s as Record<string, unknown>)[k], get(t, k), [...path, k])
  }
  walk(source, target, [name])
}

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', de: 'German', en: 'English', es: 'Spanish', fr: 'French', hi: 'Hindi', it: 'Italian', ja: 'Japanese', ko: 'Korean',
  nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', ru: 'Russian', tl: 'Tagalog', uk: 'Ukrainian', vi: 'Vietnamese', zh: 'Chinese',
}
const languageName = (code: string, labels?: Record<string, string>) => labels?.[code] ?? LANGUAGE_NAMES[code.split('-')[0]!] ?? code

const SYSTEM = (from: string, to: string) => `You translate a website's content from ${from} into ${to} for the people who will read the site.

You get a JSON object of numbered pieces, in the order they appear on the page. Reply with a JSON object with exactly the same keys, each value the translation of that piece, and nothing else: no markdown fences, no comments.

Rules:
- Natural, idiomatic ${to} in the register a good local website would use, not word for word.
- Keep names of people, organisations, products and places as they are, unless they have a common ${to} form.
- Keep numbers, dates, prices, email addresses, URLs and anything in {curly braces} exactly.
- A piece can be part of a sentence that continues in the next piece (bold or a link in the middle). Translate it so the pieces read correctly joined in order, and keep any leading or trailing space.
- Never add, drop or explain content.`

async function translatePieces(pieces: Piece[], from: string, to: string, opts: TranslateOptions): Promise<{ translations: Record<string, string>; costUsd: number | null }> {
  const resolved = resolveModel({ purpose: 'actions', override: opts.model })
  const generate = opts.generate ?? ((args) => generateText({ ...args, abortSignal: opts.signal }))
  let costUsd: number | null = null
  const translations: Record<string, string> = {}
  // Batches keep each reply well inside the model's output limit on long pages.
  for (const batch of chunk(pieces, 120)) {
    let missing = batch
    for (let attempt = 0; attempt < 2 && missing.length; attempt++) {
      const input = Object.fromEntries(missing.map((p) => [p.key, p.source]))
      const result = await generate({ model: resolved.model, providerOptions: resolved.providerOptions, system: SYSTEM(from, to), prompt: JSON.stringify(input, null, 1) })
      const cost = costFromResult(result)
      if (cost !== null) costUsd = (costUsd ?? 0) + cost
      const parsed = parseJSON(result.text)
      for (const p of missing) {
        const value = parsed?.[p.key]
        if (typeof value === 'string' && value.trim()) translations[p.key] = keepEdgeSpace(p.source, value)
      }
      missing = missing.filter((p) => translations[p.key] === undefined)
    }
    if (missing.length) throw new Error(`The translation came back incomplete (${missing.length} of ${batch.length} pieces missing). Try again.`)
  }
  return { translations, costUsd }
}

const chunk = <T,>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

/** A JSON object from a model reply, forgiving fences and stray prose around it. */
export function parseJSON(text: string): Record<string, unknown> | null {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  for (const candidate of [body, body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)]) {
    try {
      const value = JSON.parse(candidate) as unknown
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
    } catch {
      // try the next shape
    }
  }
  return null
}

/** Text nodes meet at spaces ("Read the " + link "guide"); the translation keeps them. */
const keepEdgeSpace = (source: string, value: string) => {
  const lead = /^\s+/.exec(source)?.[0] ?? ''
  const trail = /\s+$/.exec(source)?.[0] ?? ''
  return `${lead}${value.trim()}${trail}`
}

export async function runTranslate(payload: AgentPayload, input: TranslateInput, opts: TranslateOptions = {}): Promise<TranslateResult> {
  const localization = payload.config.localization
  if (!localization || !Array.isArray(localization.locales) || !localization.locales.length) throw new Error('This site has one language; there is nothing to translate into.')
  const codes = localization.locales.map((l) => (typeof l === 'string' ? l : l.code))
  const labels = Object.fromEntries(localization.locales.map((l) => (typeof l === 'string' ? [l, l] : [l.code, typeof l.label === 'string' ? l.label : l.code])))
  const from = localization.defaultLocale
  if (!codes.includes(input.locale)) throw new Error(`“${input.locale}” isn’t one of this site’s languages (${codes.join(', ')}).`)
  if (input.locale === from) throw new Error('That’s the default language: translations go from it, not into it.')

  const collection = payload.config.collections.find((c) => c.slug === input.targetCollection)
  if (!collection) throw new Error(`Unknown collection “${input.targetCollection}”.`)
  if (isPrivate(collection)) throw new Error('Agents don’t work on this collection.')
  const fields = translatableFields(collection.fields as Field[])
  if (!fields.length) throw new Error('Nothing in this collection is translated per language.')

  const read = (locale: string) => payload.findByID({ collection: input.targetCollection, id: input.targetId, depth: 0, draft: true, locale, fallbackLocale: false, overrideAccess: true, disableErrors: true })
  const [source, target] = await Promise.all([read(from), read(input.locale)])
  if (!source) throw new Error(`${input.targetCollection}/${input.targetId} not found`)
  const name = nameOf(source)
  const toName = languageName(input.locale, labels)
  const fromName = languageName(from, labels)
  const englishTo = LANGUAGE_NAMES[input.locale.split('-')[0]!] ?? toName
  const englishFrom = LANGUAGE_NAMES[from.split('-')[0]!] ?? fromName
  const mode = input.mode ?? 'missing'
  const title = `Translate to ${toName}: ${name}`

  const run = opts.runId !== undefined ? { id: opts.runId } : await startRun(payload, { kind: 'translate@1', title, targetCollection: input.targetCollection, targetId: input.targetId, input, triggeredBy: opts.triggeredBy, model: opts.model })
  if (!(await claimRun(payload, run.id))) throw new Error(`run ${run.id} is held by another worker or exhausted`)
  let costUsd: number | null = null
  try {
    const byName = new Map(topFields(collection.fields as Field[]).map((f) => [f.name!, f]))
    const pieces: Piece[] = []
    for (const field of fields) collectPieces(byName.get(field)!, source[field], target?.[field], mode === 'missing', [field], pieces)
    // Keys are global across fields so the model sees one numbered page.
    pieces.forEach((p, i) => (p.key = String(i + 1)))

    if (!pieces.length) {
      const summary = mode === 'missing' ? `Everything already has a ${toName} translation. Ask for “Translate everything again” to redo it.` : `There’s no ${fromName} text to translate yet.`
      await finishRun(payload, run.id, { proposal: null, costUsd: null, summary })
      return { runId: run.id, proposalId: null, proposed: [], pieces: 0, costUsd: null }
    }

    await updateRun(payload, run.id, { stage: 'Translating', now: `Translating ${pieces.length} piece${pieces.length === 1 ? '' : 's'} of text into ${toName}` })
    const result = await translatePieces(pieces, englishFrom, englishTo, opts)
    costUsd = result.costUsd
    await updateRun(payload, run.id, { stage: 'Preparing review', now: 'Putting the translation in place' })

    const values = applyPieces(fields, source, target, pieces, result.translations, mode)
    const patch: Patch = {}
    for (const [field, value] of Object.entries(values)) {
      const originals = pieces.filter((p) => p.top === field).map((p) => p.source).join(' ')
      patch[field] = {
        value,
        // What the review shows as "now": this language as it is, empty where untranslated.
        current: target?.[field] ?? null,
        // The "source" of a translation is the original text; the receipt says so.
        receipts: [{ ...syntheticReceipt('editor', originals), title: `${fromName} original` }],
        ...(mode === 'missing' && keptSome(byName.get(field)!, source[field], target?.[field]) ? { note: 'Only the parts without a translation were filled in; the rest is kept as it was.' } : {}),
      }
    }
    const proposal = await createProposal(payload, {
      targetCollection: input.targetCollection,
      targetId: input.targetId,
      target: target ?? null,
      kind: 'translate',
      title,
      patch,
      locale: input.locale,
      // Translating writes no new facts, only the localised words already there: every one of
      // those fields is in scope, whatever the collection's contract lets agents research.
      contract: { writable: fields, review: 'required' },
      summary: `${pieces.length} piece${pieces.length === 1 ? '' : 's'} of text translated from ${fromName} into ${toName}${mode === 'missing' ? ', where there was no translation yet' : ''}. Accepting writes the ${toName} version only; ${fromName} stays as it is.`,
      runId: run.id,
      agent: 'translate@1',
    })
    await finishRun(payload, run.id, { proposal: proposal.id, costUsd, summary: proposal.id ? `Proposed ${Object.keys(proposal.proposed).length} field(s) in ${toName}` : 'Nothing to propose' })
    return { runId: run.id, proposalId: proposal.id, proposed: Object.keys(proposal.proposed), pieces: pieces.length, costUsd }
  } catch (err) {
    await failRun(payload, run.id, err, { costUsd })
    throw err
  }
}

/** Did this field already have some translation that the run kept? */
const keptSome = (field: Field, source: unknown, target: unknown): boolean =>
  collectPieces(field, source, target, false, [field.name!]).length > collectPieces(field, source, target, true, [field.name!]).length

const isPrivate = (c: { custom?: Record<string, unknown> }) => Boolean((c.custom as { sitekick?: { private?: boolean } } | undefined)?.sitekick?.private)
