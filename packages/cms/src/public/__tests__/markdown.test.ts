import { describe, expect, test } from 'bun:test'

import { readContract } from '../../agent/contract'
import { Posts } from '../../agent/__tests__/fixture'
import { docToMarkdown, lexicalToMarkdown, prefersMarkdown } from '../markdown'

const body = {
  root: {
    children: [
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Why' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Bold', format: 1 }, { type: 'text', text: ' and ' }, { type: 'link', fields: { url: 'https://x.y' }, children: [{ type: 'text', text: 'a link' }] }] },
      { type: 'list', listType: 'number', children: [{ type: 'listitem', children: [{ type: 'text', text: 'one' }] }, { type: 'listitem', children: [{ type: 'text', text: 'two' }] }] },
      { type: 'quote', children: [{ type: 'text', text: 'said' }] },
    ],
  },
}

describe('lexicalToMarkdown', () => {
  test('handles headings, inline formats, links, lists and quotes', () => {
    expect(lexicalToMarkdown(body)).toBe('## Why\n\n**Bold** and [a link](https://x.y)\n\n1. one\n2. two\n\n> said')
    expect(lexicalToMarkdown(null)).toBe('')
  })
})

describe('docToMarkdown', () => {
  test('title, excerpt, facts, then rich text sections', async () => {
    const md = await docToMarkdown(
      { title: 'Hello', slug: 'hello', excerpt: 'Blurb', body, updatedAt: '2026-01-02T00:00:00.000Z', secret: 'hidden' },
      readContract(Posts),
      { site: { name: 'Demo', url: 'https://demo.test' } },
    )
    expect(md).toBe('# Hello\n\n> Blurb\n\n- Source: https://demo.test/news/hello\n- Updated: 2026-01-02\n\n## Body\n\n## Why\n\n**Bold** and [a link](https://x.y)\n\n1. one\n2. two\n\n> said\n')
    expect(md).not.toContain('hidden')
  })
})

describe('prefersMarkdown', () => {
  test('explicit opt-in only', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true)
    expect(prefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false)
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false)
    expect(prefersMarkdown(null)).toBe(false)
  })
})
