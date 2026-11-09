import { describe, expect, test } from 'bun:test'

import type { GenerateLike } from '../actions'
import type { Doc } from '../payload'
import { stubPayload } from '../testing/stub-payload'
import { collectPieces, parseJSON, runTranslate, translatableFields } from './translate'

const rich = (...children: unknown[]) => ({ root: { type: 'root', children: [{ type: 'paragraph', children }] } })
const text = (t: string, format = 0) => ({ type: 'text', text: t, format })

const pages = {
  slug: 'pages',
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'slug', type: 'text' },
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        { slug: 'hero', fields: [{ name: 'heading', type: 'text', localized: true }, { name: 'href', type: 'text' }] },
        { slug: 'faq', fields: [{ name: 'items', type: 'array', fields: [{ name: 'question', type: 'text', localized: true }, { name: 'answer', type: 'richText', localized: true }] }] },
      ],
    },
    { name: 'publishedAt', type: 'date' },
  ],
  // The contract lets agents research nothing; translating doesn't need it to.
  custom: { sitekick: { agent: { writable: [], review: 'required' } } },
}

const english: Doc = {
  id: 'p1',
  title: 'Visit us',
  slug: 'visit',
  body: rich(text('Open '), text('every day', 1), text(' from nine.')),
  layout: [
    { id: 'b1', blockType: 'hero', heading: 'Come see us', href: '/visit' },
    { id: 'b2', blockType: 'faq', items: [{ id: 'q1', question: 'Parking?', answer: rich(text('Yes, free.')) }] },
  ],
}

/** French so far: the title is done, nothing else. */
const frenchSoFar: Doc = {
  id: 'p1',
  title: 'Venez nous voir',
  slug: 'visit',
  body: null,
  layout: [
    { id: 'b1', blockType: 'hero', heading: null, href: '/visit' },
    { id: 'b2', blockType: 'faq', items: [{ id: 'q1', question: null, answer: null }] },
  ],
}

/** A stub payload that reads per language, as Payload does with `locale` and no fallback. */
const localised = () => {
  const payload = stubPayload({ collections: [pages] })
  payload.config.localization = { defaultLocale: 'en', locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }] }
  const byLocale: Record<string, Doc> = { en: english, fr: frenchSoFar }
  const base = payload.findByID.bind(payload)
  payload.findByID = async (args) => (args.collection === 'pages' ? structuredClone(byLocale[args.locale ?? 'en'] ?? null) : base(args))
  return payload
}

/** Plays the model: "translates" by wrapping each piece in «», keeping keys. */
const fakeModel = (calls: string[] = []): GenerateLike => async (args) => {
  const prompt = 'prompt' in args && args.prompt ? args.prompt : ''
  calls.push(prompt)
  const input = JSON.parse(prompt) as Record<string, string>
  return { text: '```json\n' + JSON.stringify(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, `«${v.trim()}»`]))) + '\n```' }
}

test('translatableFields: top-level fields that hold localised words, blocks included', () => {
  expect(translatableFields(pages.fields as never)).toEqual(['title', 'body', 'layout'])
})

describe('collectPieces', () => {
  test('rich text goes node by node, so formatting survives', () => {
    const pieces = collectPieces(pages.fields[2] as never, english.body, null, true, ['body'])
    expect(pieces.map((p) => p.source)).toEqual(['Open ', 'every day', ' from nine.'])
    expect(pieces[1]!.path).toEqual(['body', 'root', 'children', 0, 'children', 1, 'text'])
  })
  test('blocks and arrays by row; shared fields like href are left alone; only what is missing', () => {
    const pieces = collectPieces(pages.fields[3] as never, english.layout, frenchSoFar.layout, true, ['layout'])
    expect(pieces.map((p) => p.source)).toEqual(['Come see us', 'Parking?', 'Yes, free.'])
  })
  test('a done translation is skipped unless everything is asked for', () => {
    expect(collectPieces(pages.fields[0] as never, 'Visit us', 'Venez nous voir', true, ['title'])).toEqual([])
    expect(collectPieces(pages.fields[0] as never, 'Visit us', 'Venez nous voir', false, ['title'])).toHaveLength(1)
  })
})

test('parseJSON forgives fences and stray prose', () => {
  expect(parseJSON('```json\n{"1":"a"}\n```')).toEqual({ '1': 'a' })
  expect(parseJSON('Here you go: {"1":"a"} hope it helps')).toEqual({ '1': 'a' })
  expect(parseJSON('nope')).toBeNull()
})

describe('runTranslate', () => {
  test('fills the missing French, keeps what is there, and proposes it in French only', async () => {
    const payload = localised()
    const calls: string[] = []
    const result = await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel(calls) })
    expect(result.pieces).toBe(6)
    expect(result.proposed.sort()).toEqual(['body', 'layout'])
    expect(calls).toHaveLength(1)

    const proposal = payload.store.get('proposals')!.find((p) => p.id === result.proposalId)!
    expect(proposal).toMatchObject({ kind: 'translate', locale: 'fr', status: 'open', title: 'Translate to Français: Visit us' })
    const patch = proposal.patch as Record<string, { value: unknown; current?: unknown; receipts: { title?: string }[] }>
    // Formatting and the spaces between nodes kept.
    expect(patch.body!.value).toEqual(rich(text('«Open» '), text('«every day»', 1), text(' «from nine.»')))
    // Structure and shared values from the page; words translated.
    expect(patch.layout!.value).toEqual([
      { id: 'b1', blockType: 'hero', heading: '«Come see us»', href: '/visit' },
      { id: 'b2', blockType: 'faq', items: [{ id: 'q1', question: '«Parking?»', answer: rich(text('«Yes, free.»')) }] },
    ])
    // "Current" is the French as it was, for the review.
    expect(patch.layout!.current).toEqual(frenchSoFar.layout)
    expect(patch.body!.receipts[0]!.title).toBe('English original')
    // The title already had French: not proposed. Nothing in the sections had French: no "kept" note.
    expect(patch.title).toBeUndefined()
    expect((patch.layout as { note?: string }).note).toBeUndefined()
  })

  test('a field with some French already keeps it and says so', async () => {
    const payload = localised()
    const fr = structuredClone(frenchSoFar)
    ;(fr.layout as Array<Record<string, unknown>>)[0]!.heading = 'Venez nous voir'
    const base = payload.findByID.bind(payload)
    payload.findByID = async (args) => (args.collection === 'pages' ? structuredClone(args.locale === 'fr' ? fr : english) : base(args))
    const result = await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel() })
    const patch = payload.store.get('proposals')!.find((p) => p.id === result.proposalId)!.patch as Record<string, { value: Array<Record<string, unknown>>; note?: string }>
    expect(patch.layout!.value[0]!.heading).toBe('Venez nous voir')
    expect(patch.layout!.note).toContain('kept as it was')
  })

  test('mode all redoes everything, the title included', async () => {
    const payload = localised()
    const result = await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr', mode: 'all' }, { generate: fakeModel() })
    expect(result.proposed.sort()).toEqual(['body', 'layout', 'title'])
  })

  test('a French translation leaves research waiting in English open', async () => {
    const payload = localised()
    await payload.create({ collection: 'proposals', data: { status: 'open', targetCollection: 'pages', targetId: 'p1', kind: 'enrich', patch: {} } })
    await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel() })
    const statuses = payload.store.get('proposals')!.map((p) => [p.kind, p.status])
    expect(statuses).toEqual([
      ['enrich', 'open'],
      ['translate', 'open'],
    ])
    // A second French run replaces the first.
    await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel() })
    expect(payload.store.get('proposals')!.map((p) => p.status)).toEqual(['open', 'superseded', 'open'])
  })

  test('an incomplete reply is asked again, then fails the run with a reason', async () => {
    const payload = localised()
    let n = 0
    const forgetful: GenerateLike = async () => ({ text: JSON.stringify(n++ === 0 ? { '1': 'un' } : {}) })
    await expect(runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: forgetful })).rejects.toThrow(/incomplete/)
    expect(n).toBe(2)
    expect(payload.store.get('runs')!.at(-1)).toMatchObject({ status: 'failed' })
  })

  test('refuses the default language, unknown languages and one-language sites', async () => {
    const payload = localised()
    await expect(runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'en' }, { generate: fakeModel() })).rejects.toThrow(/default language/)
    await expect(runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'de' }, { generate: fakeModel() })).rejects.toThrow(/isn’t one of/)
    payload.config.localization = false
    await expect(runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel() })).rejects.toThrow(/one language/)
  })

  test('nothing missing: the run finishes without a proposal and says how to redo it', async () => {
    const payload = localised()
    const base = payload.findByID.bind(payload)
    payload.findByID = async (args) => (args.collection === 'pages' ? structuredClone(english) : base(args))
    const result = await runTranslate(payload, { targetCollection: 'pages', targetId: 'p1', locale: 'fr' }, { generate: fakeModel() })
    expect(result.proposalId).toBeNull()
    expect(String(payload.store.get('runs')!.at(-1)!.now)).toContain('already has a Français translation')
  })
})
