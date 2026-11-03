import { describe, expect, test } from 'bun:test'

import type { Receipt } from '../receipts'
import type { Runner } from '../runner'
import { instrumentTools } from '../runner'
import { execTool, stubPayload } from '../testing/stub-payload'
import { resolveDraftFieldMap, runDraft } from './draft'

const posts = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'content', type: 'richText' },
    { name: 'meta', type: 'group', fields: [{ name: 'title', type: 'text' }, { name: 'description', type: 'textarea' }] },
  ],
  custom: { sitekick: { agent: { writable: ['title', 'excerpt', 'content', 'meta'], review: 'required' } } },
}

const draft = {
  title: 'Parking changes at the town hall',
  excerpt: 'From May the north car park closes for resurfacing; use the east entrance.',
  bodyMarkdown: '## What is changing\n\nThe north car park closes on **1 May** for resurfacing, [the council says](https://council.example/notice).\n\n- Use the east entrance\n- Blue badge bays move to the front\n\n## When\n\nWork runs for six weeks.'.padEnd(120, '.'),
  metaTitle: 'Town hall parking changes from May',
  metaDescription: 'The north car park closes for resurfacing from 1 May; the east entrance stays open.',
  coverSearchPhrase: 'town hall car park',
}

const scripted: Runner = {
  name: 'scripted',
  async run(def, input, ctx) {
    const tools = instrumentTools(typeof def.tools === 'function' ? def.tools(ctx, input) : def.tools, ctx)
    expect(def.prompt?.(input, ctx)).toContain("Editor's notes")
    await execTool(tools.finish, draft)
    return { text: '', costUsd: 0.05, steps: 1, finishReason: 'stop', finished: true, model: 'stub' }
  },
}

describe('runDraft', () => {
  test('field map finds meta.* inside a group', () => {
    expect(resolveDraftFieldMap(posts.fields)).toEqual({ title: 'title', excerpt: 'excerpt', body: 'content', metaTitle: 'meta.title', metaDescription: 'meta.description' })
  })
  test('from a URL plus notes: receipts for both, Lexical body, proposal without targetId', async () => {
    const payload = stubPayload({ collections: [posts] })
    const fetch = async (url: string) => ({ receipt: { url, fetchedAt: 'now', sha256: 'h', excerpt: 'Notice', title: 'Council notice' } satisfies Receipt, text: 'The north car park closes 1 May.', status: 200 })
    const result = await runDraft(payload, { targetCollection: 'posts', url: 'https://council.example/notice', notes: 'Mention the east entrance.' }, { runner: scripted, fetch: fetch as never })
    expect(result.proposalId).not.toBeNull()
    expect(result.dropped).toEqual({})
    const proposal = (await payload.findByID({ collection: 'proposals', id: result.proposalId! }))!
    expect(proposal.targetId).toBeUndefined()
    expect(proposal.kind).toBe('draft')
    const patch = proposal.patch as Record<string, { value: unknown; receipts: Receipt[] }>
    expect(Object.keys(patch).sort()).toEqual(['content', 'excerpt', 'meta.description', 'meta.title', 'title'])
    expect(patch.title?.receipts.map((r) => r.url)).toEqual(['https://council.example/notice', 'notes:'])
    const body = patch.content?.value as { root: { children: Array<{ type: string }> } }
    expect(body.root.children.map((c) => c.type)).toEqual(['heading', 'paragraph', 'list', 'heading', 'paragraph'])
    expect(String(proposal.summary)).toContain('town hall car park')
    expect(await payload.findByID({ collection: 'runs', id: result.runId })).toMatchObject({ status: 'done', proposal: result.proposalId, kind: 'draft@1' })
  })
  test('needs a source and a collection with title/body', async () => {
    const payload = stubPayload({ collections: [posts, { slug: 'tags', fields: [{ name: 'label', type: 'text' }] }] })
    await expect(runDraft(payload, { targetCollection: 'posts' }, { runner: scripted })).rejects.toThrow('needs notes')
    await expect(runDraft(payload, { targetCollection: 'tags', notes: 'x' }, { runner: scripted })).rejects.toThrow('no title/body')
  })
})
