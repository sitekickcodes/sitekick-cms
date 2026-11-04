import { describe, expect, test } from 'bun:test'

import type { Runner } from '../runner'
import { instrumentTools } from '../runner'
import { execTool, stubPayload } from '../testing/stub-payload'
import { runEdit } from './edit'

const pages = {
  slug: 'pages',
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text' },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        { slug: 'hero', labels: { singular: 'Hero' }, fields: [{ name: 'heading', type: 'textarea', required: true }] },
        {
          slug: 'faq',
          labels: { singular: 'FAQ' },
          fields: [
            { name: 'heading', type: 'text' },
            { name: 'items', type: 'array', fields: [{ name: 'question', type: 'text', required: true }, { name: 'answer', type: 'richText', required: true }] },
          ],
        },
      ],
    },
  ],
  custom: { sitekick: { agent: { writable: ['layout'], review: 'required' } } },
}

const seeded = async () => {
  const payload = stubPayload({ collections: [pages] })
  const page = await payload.create({ collection: 'pages', data: { title: 'Visit', layout: [{ id: 'h', blockType: 'hero', heading: 'Come see us' }] } })
  return { payload, page }
}

/** Plays the model: a first attempt with a mistake, then a fix. */
const scripted = (calls: unknown[][]): Runner => ({
  name: 'scripted',
  async run(def, input, ctx) {
    const tools = instrumentTools(typeof def.tools === 'function' ? def.tools(ctx, input) : def.tools, ctx)
    const prompt = def.prompt?.(input, ctx) ?? ''
    expect(prompt).toContain('The editor asks: add a parking FAQ')
    expect(prompt).toContain('[0] {"blockType":"hero","heading":"Come see us"}')
    expect(prompt).toContain('### faq — FAQ')
    const results = []
    for (const sections of calls) results.push(await execTool(tools.propose_sections, { sections, summary: 'Added a parking FAQ under the hero.' }))
    expect(results.slice(0, -1).every((r) => (r as { retry?: boolean }).retry)).toBe(true)
    return { text: '', costUsd: 0.03, steps: calls.length, finishReason: 'stop', finished: true, model: 'stub' }
  },
})

describe('runEdit', () => {
  test('a corrected plan becomes a proposal for the whole layout, with the current one for the diff', async () => {
    const { payload, page } = await seeded()
    const faq = { blockType: 'faq', heading: 'Parking', items: [{ question: 'Where do I park?', answer: 'Behind the hall.' }] }
    const result = await runEdit(
      payload,
      { targetCollection: 'pages', targetId: page.id, instruction: 'add a parking FAQ below the hero' },
      { runner: scripted([[{ keep: 0 }, { add: { ...faq, colour: 'red' } }], [{ keep: 0 }, { add: faq }]]) },
    )
    expect(result.proposalId).not.toBeNull()
    const proposal = (await payload.findByID({ collection: 'proposals', id: result.proposalId! }))!
    expect(proposal).toMatchObject({ kind: 'edit', targetId: String(page.id), agent: 'edit@1', summary: 'Added a parking FAQ under the hero.' })
    const patch = proposal.patch as Record<string, { value: Array<Record<string, unknown>>; current: unknown; receipts: Array<{ url: string }> }>
    expect(patch.layout!.value.map((r) => r.blockType)).toEqual(['hero', 'faq'])
    expect(patch.layout!.value[0]).toEqual({ id: 'h', blockType: 'hero', heading: 'Come see us' })
    expect(patch.layout!.current).toEqual(page.layout)
    expect(patch.layout!.receipts[0]!.url).toBe('editor:')
    const run = (await payload.findByID({ collection: 'runs', id: result.runId }))!
    expect(run).toMatchObject({ status: 'done', proposal: result.proposalId })
    expect((run.steps as Array<{ status: string }>).map((s) => s.status)).toEqual(['failed', 'done'])
    // The page itself is untouched until an editor accepts.
    expect((await payload.findByID({ collection: 'pages', id: page.id }))!.layout).toEqual(page.layout)
  })
  test('keeping everything finishes without a proposal', async () => {
    const { payload, page } = await seeded()
    const result = await runEdit(payload, { targetCollection: 'pages', targetId: page.id, instruction: 'add a parking FAQ' }, { runner: scripted([[{ keep: 0 }]]) })
    expect(result.proposalId).toBeNull()
  })
  test('needs a writable blocks field', async () => {
    const payload = stubPayload({ collections: [{ ...pages, custom: { sitekick: { agent: { writable: ['title'] } } } }] })
    await expect(runEdit(payload, { targetCollection: 'pages', targetId: 1, instruction: 'add a FAQ' }, { runner: scripted([]) })).rejects.toThrow('no sections field')
  })
})
