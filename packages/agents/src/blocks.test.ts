import { describe, expect, test } from 'bun:test'

import { applySectionPlan, describeBlocks, rowToModel } from './blocks'
import type { BlockConfig, BlockRow } from './blocks'
import { markdownToLexical } from './lexical'

const blocks: BlockConfig[] = [
  {
    slug: 'hero',
    labels: { singular: 'Hero' },
    fields: [
      { name: 'heading', type: 'textarea', required: true },
      { name: 'image', type: 'upload', relationTo: 'media' },
      {
        type: 'row',
        fields: [{ name: 'surface', type: 'select', options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }] }],
      },
    ],
  },
  {
    slug: 'faq',
    labels: { singular: 'FAQ' },
    fields: [
      { name: 'heading', type: 'text', admin: { description: 'Blank = no heading.' } },
      {
        name: 'items',
        type: 'array',
        minRows: 1,
        fields: [
          { name: 'question', type: 'text', required: true },
          { name: 'answer', type: 'richText', required: true },
        ],
      },
    ],
  },
  {
    slug: 'cta',
    labels: { singular: 'Call to action' },
    fields: [
      { name: 'heading', type: 'text', required: true },
      {
        name: 'buttons',
        type: 'array',
        maxRows: 2,
        fields: [
          { name: 'label', type: 'text', required: true },
          { name: 'type', type: 'radio', options: ['page', 'url'] },
          {
            name: 'page',
            type: 'relationship',
            relationTo: 'pages',
            admin: { condition: (_: unknown, sibling: { type?: string }) => sibling?.type !== 'url' },
            validate: (v: unknown, { siblingData }: { siblingData?: { type?: string } }) => (siblingData?.type === 'url' || v ? true : 'Pick a page, or switch the link to a URL.'),
          },
          { name: 'href', type: 'text', admin: { condition: (_: unknown, sibling: { type?: string }) => sibling?.type === 'url' } },
        ],
      },
    ],
  },
]
const field = {
  type: 'blocks' as const,
  name: 'layout',
  blocks,
  validate: (rows: unknown) => ((rows as BlockRow[]).filter((r) => r.blockType === 'hero').length > 1 ? 'A page can only have one Hero.' : true),
}
const current: BlockRow[] = [
  { id: 'a', blockType: 'hero', heading: 'Welcome', image: 7, surface: 'light' },
  { id: 'b', blockType: 'cta', heading: 'Get in touch', buttons: [{ id: 'x', label: 'Contact', type: 'page', page: 3 }] },
]
const known = { media: new Set(['7']), pages: new Set(['3', '4']) }

describe('blocks for agents', () => {
  test('describeBlocks lists fields with types, options and limits, through rows', () => {
    const text = describeBlocks(blocks)
    expect(text).toContain('### faq — FAQ')
    expect(text).toContain('- surface (one of "light", "dark")')
    expect(text).toContain('- answer (rich text: write Markdown, required)')
    expect(text).toContain('- heading (text) — Blank = no heading.')
    expect(text).toContain('- buttons (list, at most 2 of rows)')
  })
  test('rowToModel: Markdown for rich text, ids for refs, no row ids or blanks', () => {
    const row: BlockRow = { id: 'f', blockType: 'faq', heading: '', items: [{ id: 'r1', question: 'Q?', answer: markdownToLexical('Yes, **always**.') }] }
    expect(rowToModel(blocks, row)).toEqual({ blockType: 'faq', items: [{ question: 'Q?', answer: 'Yes, **always**.' }] })
    expect(rowToModel(blocks, { blockType: 'hero', heading: 'Hi', image: { id: 7, url: '/x.jpg' } })).toEqual({ blockType: 'hero', heading: 'Hi', image: 7 })
  })
  test('a plan keeps rows byte for byte, edits named fields, adds new sections', async () => {
    const result = await applySectionPlan({
      plan: [
        { keep: 0 },
        { add: { blockType: 'faq', heading: 'Parking', items: [{ question: 'Where?', answer: 'Behind the **hall**.' }] } },
        { edit: 1, set: { heading: 'Say hello' } },
      ],
      current,
      blocksField: field,
      known,
      payload: {},
    })
    expect(result.problems).toEqual([])
    expect(result.changed).toBe(true)
    expect(result.layout[0]).toBe(current[0]!)
    expect(result.layout[1]).toMatchObject({ blockType: 'faq', heading: 'Parking' })
    expect(result.layout[1]!.id).toBeUndefined()
    const answer = (result.layout[1]!.items as Array<{ answer: { root: { children: unknown[] } } }>)[0]!.answer
    expect(answer.root.children).toHaveLength(1)
    expect(result.layout[2]).toEqual({ ...current[1]!, heading: 'Say hello' })
  })
  test('all keeps in order is no change', async () => {
    const result = await applySectionPlan({ plan: [{ keep: 0 }, { keep: 1 }], current, blocksField: field, known, payload: {} })
    expect(result).toMatchObject({ problems: [], changed: false })
  })
  test('problems are reported in words the model can act on', async () => {
    const result = await applySectionPlan({
      plan: [
        { keep: 0 },
        { keep: 0 },
        { add: { blockType: 'hero', heading: 'Second', surface: 'neon' } },
        { add: { blockType: 'gallery' } },
        { add: { blockType: 'faq', items: [{ question: 'Q', answer: { html: '<p>' } }], colour: 'red' } },
        { add: { blockType: "cta", heading: "Go", buttons: [{ label: "Book", type: "page" }, { label: "Map", type: "page", page: 99 }] } },
        { add: { blockType: 'hero', heading: 'Hi', image: 12 } },
      ],
      current,
      blocksField: field,
      known,
      payload: {},
    })
    const text = result.problems.join('\n')
    expect(text).toContain('section 0 is used twice')
    expect(text).toContain('"neon" is not an option (light, dark)')
    expect(text).toContain('"gallery" is not a section type')
    expect(text).toContain('there is no field "colour"')
    expect(text).toContain('write rich text as a Markdown string')
    expect(text).toContain('buttons #1 › page: Pick a page')
    expect(text).toContain('99 is not a known pages id')
    expect(text).toContain('12 is not a known media id')
    expect(text).toContain('The page: A page can only have one Hero.')
  })
  test('required fields and conditions', async () => {
    const result = await applySectionPlan({
      plan: [{ add: { blockType: 'cta', buttons: [{ label: 'Map', type: 'url', href: 'https://maps.example' }] } }],
      current: [],
      blocksField: field,
      known,
      payload: {},
    })
    expect(result.problems).toEqual(['Section 1 (Call to action) › heading: required'])
  })
})
