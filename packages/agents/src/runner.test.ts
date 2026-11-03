import { describe, expect, test } from 'bun:test'
import { tool } from 'ai'
import { z } from 'zod'

import { CostLimitError, aiSdkRunner, instrumentTools, labelFor } from './runner'
import type { GenerateFn, RunContext } from './runner'
import type { RunStep } from './runs'
import { execTool, stubPayload } from './testing/stub-payload'

const ctxFor = (steps: RunStep[]): RunContext => ({
  payload: stubPayload(),
  run: 'r1',
  log: async (s) => {
    steps.push({ at: 'now', ...s })
  },
})

describe('instrumentTools', () => {
  test('logs running/done per call and turns a throw into a result', async () => {
    const steps: RunStep[] = []
    const tools = instrumentTools(
      {
        fetch_page: tool({ inputSchema: z.object({ url: z.string() }), execute: async ({ url }) => ({ got: url }) }),
        boom: tool({
          inputSchema: z.object({}),
          execute: async (): Promise<{ ok: true }> => {
            throw new Error('nope')
          },
        }),
      },
      ctxFor(steps),
    )
    expect(await execTool(tools.fetch_page, { url: 'https://example.org/a' })).toEqual({ got: 'https://example.org/a' })
    expect(await execTool(tools.boom, {})).toEqual({ error: 'nope' })
    expect(steps.map((s) => [s.label, s.status])).toEqual([
      ['fetch page: example.org', 'running'],
      ['fetch page: example.org', 'done'],
      ['boom', 'running'],
      ['boom', 'failed'],
    ])
  })
  test('labelFor', () => {
    expect(labelFor('web_search', { query: 'jane doe site' })).toBe('web search: jane doe site')
    expect(labelFor('propose', { slot: 'bio' })).toBe('propose: bio')
    expect(labelFor('finish', { result: 'done' })).toBe('finish: done')
  })
})

describe('aiSdkRunner', () => {
  test('drives the loop, detects the finish tool, reports cost and model', async () => {
    const seen: Parameters<GenerateFn>[0][] = []
    const generate: GenerateFn = async (args) => {
      seen.push(args)
      await execTool(args.tools.finish, { summary: 'done' })
      return { text: 'ok', finishReason: 'stop', steps: [{ providerMetadata: { gateway: { cost: '0.02' } }, toolCalls: [{ toolName: 'finish' }] }] }
    }
    const steps: RunStep[] = []
    const result = await aiSdkRunner({ generate }).run(
      {
        id: 'x@1',
        description: 'x',
        instructions: 'Do it.',
        model: 'actions',
        limits: { maxSteps: 5, maxCostUsd: 1 },
        tools: () => ({ finish: tool({ inputSchema: z.object({ summary: z.string() }), execute: async () => ({ ok: true }) }) }),
      },
      { hello: 'world' },
      ctxFor(steps),
    )
    expect(result).toMatchObject({ text: 'ok', costUsd: 0.02, steps: 1, finished: true, model: 'anthropic/claude-sonnet-5-5' })
    expect(seen[0]?.system).toBe('Do it.')
    expect(seen[0]?.prompt).toBe('{"hello":"world"}')
    expect(seen[0]?.stopWhen).toHaveLength(2)
    expect(seen[0]?.providerOptions.gateway.models.length).toBeGreaterThan(0)
    expect(steps.map((s) => s.status)).toEqual(['running', 'done'])
  })
  test('aborts when the cost limit is passed', async () => {
    const generate: GenerateFn = async (args) => {
      await args.onStepFinish?.({ providerMetadata: { gateway: { cost: '0.6' } } })
      await args.onStepFinish?.({ providerMetadata: { gateway: { cost: '0.6' } } })
      if (args.abortSignal?.aborted) throw new Error('aborted')
      return { text: '', finishReason: 'stop', steps: [] }
    }
    await expect(
      aiSdkRunner({ generate }).run({ id: 'x', description: 'x', instructions: 'x', model: 'actions', limits: { maxSteps: 5, maxCostUsd: 1 }, tools: {} }, {}, ctxFor([])),
    ).rejects.toBeInstanceOf(CostLimitError)
  })
})
