import { describe, expect, test } from 'bun:test'
import type { Field } from 'payload'

import { assertUnchangedSections } from '../endpoints'
import { fieldAtPath, sectionChanges } from '../render'

const fields: Field[] = [
  {
    name: 'layout',
    type: 'blocks',
    blocks: [
      { slug: 'hero', labels: { singular: 'Hero', plural: 'Heroes' }, fields: [{ name: 'heading', type: 'textarea' }, { name: 'image', type: 'upload', relationTo: 'media' }] },
      {
        slug: 'faq',
        labels: { singular: 'FAQ', plural: 'FAQs' },
        fields: [
          { name: 'heading', type: 'text' },
          { name: 'items', type: 'array', labels: { singular: 'Question', plural: 'Questions' }, label: 'Questions', fields: [{ name: 'question', type: 'text' }] },
        ],
      },
      { slug: 'cta', labels: { singular: 'Call to action', plural: 'Calls to action' }, fields: [{ name: 'heading', type: 'text' }] },
    ],
  },
]
const field = fieldAtPath(fields, 'layout')
const hero = { id: 'h', blockType: 'hero', heading: 'Welcome', image: 4 }
const faq = { id: 'f', blockType: 'faq', heading: 'Questions', items: [{ id: 'q1', question: 'Hours?' }] }
const cta = { id: 'c', blockType: 'cta', heading: 'Visit us' }

describe('sectionChanges', () => {
  test('marks each proposed section and lists removals', () => {
    const changes = sectionChanges(
      field,
      [hero, faq, cta],
      [
        { ...hero, heading: 'Hello there' },
        cta,
        { blockType: 'faq', heading: 'Parking', items: [{ question: 'Where?' }, { question: 'Cost?' }] },
        { ...faq, items: [...faq.items, { question: 'Dogs?' }] },
      ],
    )!
    expect(changes.map((c) => [c.change, c.type, c.title])).toEqual([
      ['changed', 'Hero', 'Hello there'],
      ['moved', 'Call to action', 'Visit us'],
      ['added', 'FAQ', 'Parking'],
      ['changed', 'FAQ', 'Questions'],
    ])
    expect(changes[0]!.details).toEqual(['Heading: “Welcome” → “Hello there”'])
    expect(changes[2]!.details).toEqual(['Heading: “Parking”', 'Questions: “Where?”, “Cost?”'])
    expect(changes[3]!.details).toEqual(['Questions: 1 → 2 (“Dogs?”)'])
  })
  test('removed sections come last; unchanged ones say so', () => {
    const changes = sectionChanges(field, [hero, faq, cta], [hero, cta])!
    expect(changes.map((c) => c.change)).toEqual(['same', 'same', 'removed'])
    expect(changes[2]).toMatchObject({ type: 'FAQ', title: 'Questions' })
  })
  test('not a blocks field: null', () => {
    expect(sectionChanges(null, [], [])).toBeNull()
  })
})

describe('assertUnchangedSections', () => {
  const patch = { layout: { value: [hero], current: [hero, faq] } }
  test('passes when the field still matches the snapshot, ignoring key order and empty keys', () => {
    expect(() => assertUnchangedSections(fields, ['layout'], patch, { layout: [{ image: 4, heading: 'Welcome', blockType: 'hero', id: 'h', blockName: null }, faq] })).not.toThrow()
  })
  test('refuses with 409 when someone edited the sections since', () => {
    let error: unknown
    try {
      assertUnchangedSections(fields, ['layout'], patch, { layout: [{ ...hero, heading: 'Edited by hand' }, faq] })
    } catch (err) {
      error = err
    }
    expect(error).toMatchObject({ status: 409 })
  })
})
