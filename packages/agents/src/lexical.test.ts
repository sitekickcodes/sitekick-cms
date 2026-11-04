import { describe, expect, test } from 'bun:test'

import { FORMAT, lexicalToMarkdown, lexicalToText, markdownToLexical, parseInline } from './lexical'

describe('markdownToLexical', () => {
  test('headings, paragraphs, lists, quotes, links and emphasis', () => {
    const md = `# Title

Intro with **bold**, *italic*, \`code\` and a [link](https://example.org/a).
Second line of the same paragraph.

## Section

- one
- two with **bold**

1. first
2. second

> A quote
> continued

---

Last.`
    const { root } = markdownToLexical(md)
    const types = root.children.map((c) => c.type)
    expect(types).toEqual(['heading', 'paragraph', 'heading', 'list', 'list', 'quote', 'paragraph'])
    const [h1, p, h2, ul, ol, quote, last] = root.children
    expect(h1).toMatchObject({ type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Title', format: 0 }] })
    expect(h2).toMatchObject({ tag: 'h2' })
    if (p?.type !== 'paragraph') throw new Error('expected paragraph')
    expect(p.children.map((c) => (c.type === 'text' ? [c.text, c.format] : ['link', c.fields.url]))).toEqual([
      ['Intro with ', 0],
      ['bold', FORMAT.bold],
      [', ', 0],
      ['italic', FORMAT.italic],
      [', ', 0],
      ['code', FORMAT.code],
      [' and a ', 0],
      ['link', 'https://example.org/a'],
      ['. Second line of the same paragraph.', 0],
    ])
    expect(ul).toMatchObject({ type: 'list', listType: 'bullet', tag: 'ul' })
    if (ul?.type !== 'list' || ol?.type !== 'list') throw new Error('expected lists')
    expect(ul.children.map((i) => i.value)).toEqual([1, 2])
    expect(ul.children[1]?.children).toEqual([
      { type: 'text', text: 'two with ', format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
      { type: 'text', text: 'bold', format: FORMAT.bold, detail: 0, mode: 'normal', style: '', version: 1 },
    ])
    expect(ol).toMatchObject({ listType: 'number', tag: 'ol' })
    expect(quote).toMatchObject({ type: 'quote', children: [{ text: 'A quote continued' }] })
    expect(last).toMatchObject({ type: 'paragraph', children: [{ text: 'Last.' }] })
    expect(root).toMatchObject({ type: 'root', direction: 'ltr', format: '', indent: 0, version: 1 })
  })
  test('link nodes carry the Payload link fields and nested bold', () => {
    const [link] = parseInline('[**Bold** site](https://example.org)')
    expect(link).toMatchObject({ type: 'link', version: 3, fields: { url: 'https://example.org', newTab: false, linkType: 'custom' } })
    if (link?.type !== 'link') throw new Error('expected link')
    expect(link.children).toMatchObject([{ text: 'Bold', format: FORMAT.bold }, { text: ' site', format: 0 }])
  })
  test('bold italic combine; unknown syntax survives as text', () => {
    expect(parseInline('***both***')).toMatchObject([{ text: 'both', format: FORMAT.bold | FORMAT.italic }])
    expect(parseInline('a | table | row')).toMatchObject([{ text: 'a | table | row' }])
    expect(markdownToLexical('').root.children).toEqual([])
  })
  test('lexicalToText round-trips the words', () => {
    expect(lexicalToText(markdownToLexical('## Hi\n\nSome **words** [here](https://x.y).\n\n- a\n- b'))).toBe('Hi\nSome words here.\na\nb')
  })
})

describe('lexicalToMarkdown', () => {
  test('round-trips what markdownToLexical makes', () => {
    const md = '## Getting here\n\nTake the **5** bus or [walk](https://maps.example).\n\n- Bike racks out front\n- *Free* parking after 6\n\n1. One\n2. Two\n\n> Worth the trip'
    expect(lexicalToMarkdown(markdownToLexical(md))).toBe(md)
  })
})
