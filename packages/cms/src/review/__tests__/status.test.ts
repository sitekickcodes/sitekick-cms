import { describe, expect, test } from 'bun:test'

import { fieldLabel, lexicalParagraphs, renderValue } from '../render'
import { asDecisions, asPatch, asQuestion, asSteps, computeStatus, hostOf, isFinal, readableExcerpt, setAtPath, topLevelOf, type Patch } from '../shared'

const patch: Patch = {
  bio: { value: 'A new bio', current: 'Old bio' },
  'seo.title': { value: 'Jane Doe · Candidate' },
  website: { value: 'https://jane.example' },
}

describe('computeStatus', () => {
  test('open until every field has a decision', () => {
    expect(computeStatus(patch, {})).toBe('open')
    expect(computeStatus(patch, { bio: 'accepted' })).toBe('open')
    expect(computeStatus(patch, { bio: 'accepted', 'seo.title': 'rejected' })).toBe('open')
  })
  test('accepted when all accepted, rejected when all rejected, partial otherwise', () => {
    expect(computeStatus(patch, { bio: 'accepted', 'seo.title': 'accepted', website: 'accepted' })).toBe('accepted')
    expect(computeStatus(patch, { bio: 'rejected', 'seo.title': 'rejected', website: 'rejected' })).toBe('rejected')
    expect(computeStatus(patch, { bio: 'accepted', 'seo.title': 'rejected', website: 'accepted' })).toBe('partial')
  })
  test('decisions for paths outside the patch do not count', () => {
    expect(computeStatus(patch, { bio: 'accepted', 'seo.title': 'accepted', website: 'accepted', stray: 'rejected' })).toBe('accepted')
    expect(computeStatus(patch, { stray: 'accepted' })).toBe('open')
  })
  test('an empty patch is rejected: nothing to accept', () => {
    expect(computeStatus({}, {})).toBe('rejected')
  })
  test('isFinal', () => {
    expect(isFinal('open')).toBe(false)
    for (const s of ['accepted', 'partial', 'rejected', 'superseded']) expect(isFinal(s)).toBe(true)
    expect(isFinal(undefined)).toBe(false)
  })
})

describe('json readers', () => {
  test('asPatch keeps only entries with a value key', () => {
    expect(asPatch({ a: { value: 1 }, b: { nope: 1 }, c: 'x', d: null })).toEqual({ a: { value: 1 } })
    expect(asPatch(null)).toEqual({})
    expect(asPatch([{ value: 1 }])).toEqual({})
  })
  test('asDecisions drops unknown values', () => {
    expect(asDecisions({ a: 'accepted', b: 'rejected', c: 'maybe', d: 1 })).toEqual({ a: 'accepted', b: 'rejected' })
    expect(asDecisions('accepted')).toEqual({})
  })
  test('asSteps and asQuestion tolerate partial data', () => {
    expect(asSteps([{ label: 'Read site', status: 'done', at: '2026-11-03T10:00:00Z' }, { label: 'Odd', status: 'weird' }, { nope: true }, null])).toEqual([
      { label: 'Read site', status: 'done', detail: undefined, at: '2026-11-03T10:00:00Z' },
      { label: 'Odd', status: 'done', detail: undefined, at: '' },
    ])
    expect(asQuestion({ text: 'Which site?', options: ['A', 'B', '', 3] })).toEqual({ text: 'Which site?', options: ['A', 'B'] })
    expect(asQuestion({ text: '  ' })).toBeNull()
    expect(asQuestion(null)).toBeNull()
  })
})

describe('setAtPath', () => {
  test('nested groups keep their siblings', () => {
    const base = { seo: { title: 'Old', description: 'Keep me' }, title: 'T' }
    const out = setAtPath(base, 'seo.title', 'New')
    expect(out).toEqual({ seo: { title: 'New', description: 'Keep me' }, title: 'T' })
    expect(base.seo.title).toBe('Old')
  })
  test('array rows keep their siblings', () => {
    const base = { links: [{ url: 'a', label: 'A' }, { url: 'b', label: 'B' }] }
    expect(setAtPath(base, 'links.1.url', 'c')).toEqual({ links: [{ url: 'a', label: 'A' }, { url: 'c', label: 'B' }] })
  })
  test('creates arrays for numeric segments and objects otherwise', () => {
    expect(setAtPath({}, 'links.0.url', 'x')).toEqual({ links: [{ url: 'x' }] })
    expect(setAtPath(undefined, 'a.b', 1)).toEqual({ a: { b: 1 } })
  })
  test('topLevelOf and hostOf', () => {
    expect(topLevelOf('seo.title')).toBe('seo')
    expect(topLevelOf('bio')).toBe('bio')
    expect(hostOf('https://www.example.org/a?b')).toBe('example.org')
    expect(hostOf('not a url')).toBe('not a url')
  })
})

describe('render', () => {
  const fields = [
    { name: 'title', type: 'text' as const, label: 'Headline' },
    { name: 'seo', type: 'group' as const, label: 'SEO', fields: [{ name: 'title', type: 'text' as const }] },
    { name: 'links', type: 'array' as const, fields: [{ name: 'url', type: 'text' as const, label: 'URL' }] },
    { name: 'photo', type: 'upload' as const, relationTo: 'media' },
    { type: 'tabs' as const, tabs: [{ label: 'Content', fields: [{ name: 'body', type: 'richText' as const }] }] },
  ]
  test('fieldLabel walks groups, arrays and tabs', () => {
    expect(fieldLabel(fields, 'title')).toBe('Headline')
    expect(fieldLabel(fields, 'seo.title')).toBe('SEO › Title')
    expect(fieldLabel(fields, 'links.0.url')).toBe('Links › #1 › URL')
    expect(fieldLabel(fields, 'body')).toBe('Body')
    expect(fieldLabel(fields, 'missing.path')).toBe('missing.path')
  })
  test('lexical becomes paragraphs and bullets', () => {
    const doc = {
      root: {
        children: [
          { type: 'heading', children: [{ type: 'text', text: 'Hello' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'One ' }, { type: 'text', text: 'two' }] },
          { type: 'list', children: [{ type: 'listitem', children: [{ type: 'text', text: 'a' }] }, { type: 'listitem', children: [{ type: 'text', text: 'b' }] }] },
          { type: 'paragraph', children: [] },
        ],
      },
    }
    expect(lexicalParagraphs(doc)).toEqual(['Hello', 'One two', '• a', '• b'])
    expect(renderValue(doc, null)).toEqual({ kind: 'paragraphs', items: ['Hello', 'One two', '• a', '• b'] })
  })
  test('primitives, arrays, refs and objects', () => {
    expect(renderValue('', null)).toEqual({ kind: 'empty' })
    expect(renderValue(true, null)).toEqual({ kind: 'text', text: 'Yes' })
    expect(renderValue(['a', 'b'], null)).toEqual({ kind: 'list', items: ['a', 'b'] })
    expect(renderValue({ a: 1 }, null)).toEqual({ kind: 'json', text: '{\n  "a": 1\n}' })
    const photo = fields[3] as never
    expect(renderValue(12, photo)).toEqual({ kind: 'ref', collection: 'media', id: '12', label: 'Media #12' })
  })
})


describe('readableExcerpt', () => {
  test('drops inline link targets and images, keeps the words', () => {
    expect(readableExcerpt("About me [image: Delba https://delba.dev/_next/image?url=x] Hey, I'm Delba. LinkedIn [https://www.linkedin.com/in/d/] · GitHub [https://github.com/d] · X [https://x.com/…")).toBe("About me Hey, I'm Delba. LinkedIn · GitHub · X")
  })
})

describe('renderValue for agent shapes', () => {
  test('a web image and rows of links read as such', () => {
    expect(renderValue({ sourceUrl: 'https://a.example/j.jpg', credit: 'a.example' }, null)).toEqual({ kind: 'image', src: 'https://a.example/j.jpg', credit: 'a.example' })
    expect(renderValue([{ platform: 'GitHub', url: 'https://github.com/d' }, { url: 'https://www.youtube.com/@d' }], null)).toEqual({
      kind: 'links',
      items: [
        { label: 'GitHub', href: 'https://github.com/d' },
        { label: 'youtube.com', href: 'https://www.youtube.com/@d' },
      ],
    })
    expect(renderValue([{ name: 'no link' }], null).kind).toBe('json')
  })
})
