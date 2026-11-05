import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Runner } from '../runner'
import { instrumentTools } from '../runner'
import { execTool } from '../testing/stub-payload'
import { checkPatch, draftCase, formatSummary, runEvals, summarize, type JudgeFn } from './index'

const posts = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'content', type: 'richText' },
  ],
  custom: { sitekick: { agent: { writable: ['title', 'excerpt', 'content'], review: 'required' } } },
}

/** Proposes a title that depends on the model, so two models grade differently. */
const scripted: Runner = {
  name: 'scripted',
  async run(def, input, ctx) {
    const tools = instrumentTools(typeof def.tools === 'function' ? def.tools(ctx, input) : def.tools, ctx)
    const good = ctx.model === 'good/model'
    await execTool(tools.finish, {
      title: good ? 'Volunteers plant 120 trees on the river path' : 'Exciting news!!!',
      excerpt: 'Forty volunteers planted trees on Saturday.',
      bodyMarkdown: 'Forty volunteers planted 120 trees along the river path on Saturday, with the parks department.'.padEnd(120, '.'),
    })
    return { text: '', costUsd: 0.01, steps: 1, finishReason: 'stop', finished: true, model: ctx.model ?? 'stub' }
  },
}

const judge: JudgeFn = async ({ proposal }) => {
  const title = String((proposal.patch as Record<string, { value: unknown }>).title?.value)
  return /trees/.test(title) ? { score: 5, reason: 'Accurate.', costUsd: 0.002 } : { score: 2, reason: 'Vague title.', costUsd: 0.002 }
}

describe('checkPatch', () => {
  const patch = { title: { value: 'Volunteers plant 120 trees' }, meta: { value: { title: 'Trees' } }, count: { value: 3 } }
  test('values, patterns, functions, nested paths and forbidden fields', () => {
    const results = checkPatch(
      patch,
      { title: /120 trees/, 'meta.title': 'Trees', count: (v: unknown) => (v === 3 ? true : 'wrong count'), excerpt: 'x' },
      ['author'],
    )
    expect(results).toEqual([
      { path: 'title', pass: true },
      { path: 'meta.title', pass: true },
      { path: 'count', pass: true },
      { path: 'excerpt', pass: false, reason: 'not proposed' },
      { path: 'author', pass: true },
    ])
    expect(checkPatch(patch, { title: 'Other' }, ['count']).map((r) => r.pass)).toEqual([false, false])
  })
})

describe('runEvals', () => {
  test('each model on each case, isolated, graded, summed and written to the ledger', async () => {
    const ledger = join(mkdtempSync(join(tmpdir(), 'evals-')), 'ledger.jsonl')
    const cases = [
      draftCase({
        id: 'draft-volunteer-day',
        collections: [posts],
        input: { targetCollection: 'posts', notes: '40 volunteers planted 120 trees on Saturday.' },
        expect: { title: /trees/i },
        forbid: ['author'],
        judge: 'The title is specific and every fact comes from the notes.',
      }),
    ]
    const results = await runEvals({ cases, models: ['good/model', 'weak/model'], runner: scripted, judge, ledger, commit: 'abc123' })
    expect(results.map((r) => [r.model, r.pass, r.judge?.score])).toEqual([
      ['good/model', true, 5],
      ['weak/model', false, 2],
    ])
    expect(results[0]!.costUsd).toBeCloseTo(0.012)
    expect(readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l).commit)).toEqual(['abc123', 'abc123'])
    const summary = summarize(results)
    expect(summary.map((s) => [s.model, s.passed, s.meanScore])).toEqual([
      ['good/model', 1, 5],
      ['weak/model', 0, 2],
    ])
    expect(formatSummary(summary)).toContain('good/model')
  })

  test('a failing agent is a failed case, not a crash', async () => {
    const broken: Runner = { name: 'broken', run: () => Promise.reject(new Error('gateway down')) }
    const [result] = await runEvals({ cases: [draftCase({ id: 'x', collections: [posts], input: { targetCollection: 'posts', notes: 'n' } })], models: ['m'], runner: broken, judge })
    expect(result).toMatchObject({ pass: false, case: 'x' })
    expect(result!.error).toContain('gateway down')
  })
})
