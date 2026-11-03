import { describe, expect, test } from 'bun:test'

import type { Receipt } from '../receipts'
import type { Runner } from '../runner'
import { instrumentTools } from '../runner'
import { execTool, stubPayload } from '../testing/stub-payload'
import { shapeLinkRows } from '../fields'
import { resolveFieldMap, runEnrich } from './enrich'

const site = 'https://janedoe.example/'
const pageText = 'Jane Doe — Official site. Jane Doe is the director of Example Org in Leeds. She joined in 2019. Follow [https://x.com/janedoe] [image: Jane https://janedoe.example/jane.jpg]'
const fetchStub = async (url: string) => ({
  receipt: { url, fetchedAt: 'now', sha256: 'h', excerpt: pageText.slice(0, 50), title: 'Jane Doe — Official site' } satisfies Receipt,
  text: pageText,
  status: 200,
})

const people = {
  slug: 'people',
  fields: [
    { name: 'name', type: 'text' },
    { type: 'row', fields: [{ name: 'website', type: 'text' }, { name: 'email', type: 'email' }] },
    { name: 'bio', type: 'textarea' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'social', type: 'array', fields: [{ name: 'platform', type: 'text' }, { name: 'url', type: 'text' }] },
  ],
  custom: { sitekick: { agent: { writable: ['bio', 'social', 'photo'], fillEmptyOnly: ['website'], review: 'required' } } },
}

/** A runner that plays a model: fetch, propose four slots (one with a bad quote), finish. */
const scripted = (script: (tools: ReturnType<typeof instrumentTools>) => Promise<void>): Runner => ({
  name: 'scripted',
  async run(def, input, ctx) {
    const tools = instrumentTools(typeof def.tools === 'function' ? def.tools(ctx, input) : def.tools, ctx)
    await script(tools)
    return { text: '', costUsd: 0.1, steps: 4, finishReason: 'stop', finished: true, model: 'stub' }
  },
})

describe('resolveFieldMap', () => {
  test('maps slots by name heuristic through layout fields; overrides win', () => {
    expect(resolveFieldMap(people.fields)).toEqual({ website: 'website', bio: 'bio', image: 'photo', social: 'social' })
    expect(resolveFieldMap([{ name: 'url', type: 'text' }, { name: 'description', type: 'richText' }], { bio: 'about' })).toEqual({ website: 'url', bio: 'about', image: undefined, social: undefined })
  })
})

describe('shapeLinkRows', () => {
  const found = [
    { platform: 'LinkedIn', url: 'https://linkedin.com/in/d' },
    { platform: 'Twitter', url: 'https://x.com/d' },
    { platform: 'GitHub', url: 'https://github.com/d' },
  ]
  test('fits rows to a select, mapping aliases and falling back to other', () => {
    const rowFields = [
      { name: 'platform', type: 'select', options: ['x', 'linkedin', 'other'] },
      { name: 'url', type: 'text' },
    ]
    expect(shapeLinkRows(found, rowFields)).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/d' },
      { platform: 'x', url: 'https://x.com/d' },
      { platform: 'other', url: 'https://github.com/d' },
    ])
    // No `other`: an unknown platform is dropped rather than failing on save.
    expect(shapeLinkRows(found, [{ name: 'network', type: 'select', options: [{ label: 'X', value: 'x' }] }, { name: 'link', type: 'text' }])).toEqual([{ network: 'x', link: 'https://x.com/d' }])
  })
  test('a free-text label keeps the platform name as given', () => {
    expect(shapeLinkRows(found.slice(0, 1), [{ name: 'label', type: 'text' }, { name: 'url', type: 'text' }])).toEqual([{ label: 'LinkedIn', url: 'https://linkedin.com/in/d' }])
  })
})

describe('runEnrich', () => {
  test('end to end with a scripted runner: receipts, verifiers, contract, proposal, run status', async () => {
    const payload = stubPayload({ collections: [people] })
    const jane = await payload.create({ collection: 'people', data: { name: 'Jane Doe', website: '' } })
    const judged: string[] = []
    const result = await runEnrich(
      payload,
      { targetCollection: 'people', targetId: jane.id },
      {
        fetch: fetchStub as never,
        search: undefined,
        urlAlive: async () => ({ ok: true }),
        judge: async ({ bio }) => {
          judged.push(bio)
          return { judgement: { claims: [{ sentence: bio, supported: true, receipt: 0 }] }, costUsd: 0.03 }
        },
        runner: scripted(async (tools) => {
          expect(await execTool(tools.propose, { slot: 'bio', value: 'x', sourceUrl: site, quote: 'director' })).toMatchObject({ error: expect.stringContaining('fetch the source page first') })
          await execTool(tools.fetch_page, { url: site })
          expect(await execTool(tools.propose, { slot: 'website', value: 'https://janedoe.example', sourceUrl: site, quote: 'Jane Doe — Official site' })).toEqual({ ok: true, slot: 'website' })
          expect(await execTool(tools.propose, { slot: 'bio', value: 'Jane Doe is the director of Example Org in Leeds. She joined in 2019.', sourceUrl: site, quote: 'Jane Doe is the director of Example Org in Leeds. She joined in 2019.' })).toEqual({ ok: true, slot: 'bio' })
          expect(await execTool(tools.propose, { slot: 'social', value: [{ platform: 'x', url: 'https://x.com/janedoe' }], sourceUrl: site, quote: 'she is a famous astronaut' })).toMatchObject({ error: expect.stringContaining('does not appear') })
          expect(await execTool(tools.propose, { slot: 'image', value: { url: 'https://janedoe.example/jane.jpg', credit: 'janedoe.example' }, sourceUrl: site, quote: 'https://janedoe.example/jane.jpg' })).toEqual({ ok: true, slot: 'image' })
          await execTool(tools.finish, { result: 'done', summary: 'Found the official site and a bio; no socials confirmed.' })
        }),
      },
    )
    expect(result.proposalId).not.toBeNull()
    expect(result.proposed.sort()).toEqual(['bio', 'photo', 'website'])
    expect(result.costUsd).toBeCloseTo(0.13, 6)
    expect(judged).toHaveLength(1)

    const proposal = (await payload.findByID({ collection: 'proposals', id: result.proposalId! }))!
    const patch = proposal.patch as Record<string, { value: unknown; receipts: Receipt[]; current?: unknown }>
    expect(patch.website).toMatchObject({ value: 'https://janedoe.example', current: '' })
    expect(patch.bio?.receipts[0]).toMatchObject({ url: site, excerpt: expect.stringContaining('director of Example Org') })
    expect(patch.photo?.value).toEqual({ sourceUrl: 'https://janedoe.example/jane.jpg', credit: 'janedoe.example' })
    expect(String(proposal.summary)).toContain('no socials confirmed')

    const run = (await payload.findByID({ collection: 'runs', id: result.runId }))!
    expect(run).toMatchObject({ status: 'done', proposal: result.proposalId, targetCollection: 'people', targetId: String(jane.id), kind: 'enrich@1' })
    expect((run.steps as Array<{ label: string }>).map((s) => s.label)).toContain('Read janedoe.example')
    expect(run.costUsd).toBeCloseTo(0.13, 6)
  })
  test('a bio the judge rejects is dropped and the reason reaches the summary; a failing runner fails the run', async () => {
    const payload = stubPayload({ collections: [people] })
    const jane = await payload.create({ collection: 'people', data: { name: 'Jane Doe' } })
    const result = await runEnrich(
      payload,
      { targetCollection: 'people', targetId: jane.id },
      {
        fetch: fetchStub as never,
        urlAlive: async () => ({ ok: true }),
        judge: async ({ bio }) => ({ judgement: { claims: [{ sentence: bio, supported: false, receipt: null }] }, costUsd: null }),
        runner: scripted(async (tools) => {
          await execTool(tools.fetch_page, { url: site })
          await execTool(tools.propose, { slot: 'bio', value: 'Jane Doe is the director of Example Org in Leeds. She joined in 2019.', sourceUrl: site, quote: 'Jane Doe is the director of Example Org in Leeds' })
          await execTool(tools.finish, { result: 'incomplete', summary: 'Only a bio was found.' })
        }),
      },
    )
    expect(result.proposalId).toBeNull()
    expect(result.dropped.bio).toContain('unsupported')

    const failing: Runner = { name: 'failing', run: () => Promise.reject(new Error('model outage')) }
    await expect(runEnrich(payload, { targetCollection: 'people', targetId: jane.id }, { runner: failing, fetch: fetchStub as never })).rejects.toThrow('model outage')
    const runs = payload.store.get('runs')!
    expect(runs[runs.length - 1]).toMatchObject({ status: 'failed', error: 'model outage' })
  })
  test('a bio quotes every sentence through sources; an unsupported sentence is trimmed, not the whole bio', async () => {
    const payload = stubPayload({ collections: [people] })
    const jane = await payload.create({ collection: 'people', data: { name: 'Jane Doe' } })
    const other = 'https://news.example/jane'
    const bio = 'Jane Doe is the director of Example Org in Leeds. She joined in 2019. She won a Nobel prize.'
    let receiptsSeen = 0
    const result = await runEnrich(
      payload,
      { targetCollection: 'people', targetId: jane.id },
      {
        fetch: fetchStub as never,
        urlAlive: async () => ({ ok: true }),
        judge: async ({ receipts }) => {
          receiptsSeen = receipts.length
          return {
            judgement: {
              claims: [
                { sentence: 'Jane Doe is the director of Example Org in Leeds.', supported: true, receipt: 0 },
                { sentence: 'She joined in 2019.', supported: true, receipt: 1 },
                { sentence: 'She won a Nobel prize.', supported: false, receipt: null },
              ],
            },
            costUsd: null,
          }
        },
        runner: scripted(async (tools) => {
          await execTool(tools.fetch_page, { url: site })
          const unread = { slot: 'bio', value: bio, sourceUrl: site, quote: 'director of Example Org', sources: [{ sourceUrl: other, quote: 'She joined in 2019' }] }
          expect(await execTool(tools.propose, unread)).toMatchObject({ error: expect.stringContaining('(sources[0])') })
          await execTool(tools.fetch_page, { url: other })
          expect(await execTool(tools.propose, unread)).toEqual({ ok: true, slot: 'bio' })
          await execTool(tools.finish, { result: 'done', summary: 'Bio from the official site and a news profile.' })
        }),
      },
    )
    expect(receiptsSeen).toBe(2)
    expect(result.proposed).toEqual(['bio'])
    const proposal = (await payload.findByID({ collection: 'proposals', id: result.proposalId! }))!
    const patch = proposal.patch as Record<string, { value: unknown; receipts: Receipt[]; note?: string }>
    expect(patch.bio).toMatchObject({ value: 'Jane Doe is the director of Example Org in Leeds. She joined in 2019.', note: expect.stringContaining('Nobel') })
    expect(patch.bio?.receipts.map((r) => r.url)).toEqual([site, other])
  })
})
