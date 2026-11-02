import { describe, expect, test } from 'bun:test'

import { fillSEO, seoDefaults, seoText } from '../seoDefaults'

const site = { name: 'Demo Co.' }

describe('seoDefaults', () => {
  test('title gets the site suffix, description comes from the first prose slot', () => {
    const out = seoDefaults({ title: 'Our story', excerpt: '<p>Where we  came from.</p>', coverImage: 7 }, site)
    expect(out).toEqual({ title: 'Our story · Demo Co.', description: 'Where we came from.', image: 7 })
  })
  test('reads Lexical text', () => {
    const body = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hi ' }, { type: 'text', text: 'there' }] }] } }
    expect(seoText(body)).toBe('Hi there')
  })
  test('fillSEO keeps typed overrides but follows the content otherwise', () => {
    const original = { title: 'A', meta: { title: 'A · Demo Co.', description: 'A · Demo Co.', image: null } }
    const followed = fillSEO({ title: 'B' }, site, original)
    expect(followed.title).toBe('B · Demo Co.')
    const typed = fillSEO({ title: 'B', meta: { title: 'Custom' } }, site, original)
    expect(typed.title).toBe('Custom')
  })
})
