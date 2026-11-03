import { describe, expect, test } from 'bun:test'

import { AgentsDisabledError, agentsDisabled, askEditor, canTransition, claimRun, failRun, finishRun, startRun, updateRun } from './runs'
import { stubPayload } from './testing/stub-payload'

describe('status machine', () => {
  test('allowed and refused transitions', () => {
    expect(canTransition('queued', 'running')).toBe(true)
    expect(canTransition('running', 'waiting')).toBe(true)
    expect(canTransition('waiting', 'running')).toBe(true)
    expect(canTransition('running', 'done')).toBe(true)
    expect(canTransition('done', 'running')).toBe(false)
    expect(canTransition('cancelled', 'queued')).toBe(false)
    expect(canTransition('failed', 'queued')).toBe(true)
  })
})

describe('kill switch', () => {
  test('reads SITEKICK_AGENTS_DISABLED', () => {
    expect(agentsDisabled({})).toBe(false)
    expect(agentsDisabled({ SITEKICK_AGENTS_DISABLED: '0' })).toBe(false)
    expect(agentsDisabled({ SITEKICK_AGENTS_DISABLED: 'false' })).toBe(false)
    expect(agentsDisabled({ SITEKICK_AGENTS_DISABLED: '1' })).toBe(true)
    expect(agentsDisabled({ SITEKICK_AGENTS_DISABLED: 'yes' })).toBe(true)
  })
  test('startRun refuses when disabled', async () => {
    process.env.SITEKICK_AGENTS_DISABLED = '1'
    try {
      await expect(startRun(stubPayload(), { kind: 'enrich@1', title: 'x' })).rejects.toBeInstanceOf(AgentsDisabledError)
    } finally {
      delete process.env.SITEKICK_AGENTS_DISABLED
    }
  })
})

describe('run lifecycle', () => {
  test('start, claim with lease, steps, finish', async () => {
    const payload = stubPayload()
    const run = await startRun(payload, { kind: 'enrich@1', title: 'Enrich: Jane', targetCollection: 'people', targetId: 7, input: { a: 1 }, triggeredBy: 'u1' })
    expect(run).toMatchObject({ status: 'queued', attempts: 0, targetId: '7', steps: [] })

    expect(await claimRun(payload, run.id, { leaseMs: 60_000 })).toBe(true)
    let doc = (await payload.findByID({ collection: 'runs', id: run.id }))!
    expect(doc.status).toBe('running')
    expect(doc.attempts).toBe(1)
    expect(Date.parse(String(doc.leaseUntil))).toBeGreaterThan(Date.now())
    // Held by this worker: a second claimant is refused until the lease lapses.
    expect(await claimRun(payload, run.id)).toBe(false)
    await payload.update({ collection: 'runs', id: run.id, data: { leaseUntil: new Date(Date.now() - 1000).toISOString() }, context: { sitekickAgent: 'runs' } })
    expect(await claimRun(payload, run.id)).toBe(true)
    expect((await payload.findByID({ collection: 'runs', id: run.id }))?.attempts).toBe(2)

    await updateRun(payload, run.id, { stage: 'Reading', step: { label: 'fetch page: example.org', status: 'running' } })
    await updateRun(payload, run.id, { step: { label: 'fetch page: example.org', status: 'done', detail: '12 KB' } })
    await updateRun(payload, run.id, { step: { label: 'web search: jane', status: 'done' } })
    doc = (await payload.findByID({ collection: 'runs', id: run.id }))!
    expect(doc.stage).toBe('Reading')
    expect(doc.now).toBe('web search: jane')
    expect(doc.steps).toMatchObject([{ label: 'fetch page: example.org', status: 'done', detail: '12 KB' }, { label: 'web search: jane', status: 'done' }])

    await finishRun(payload, run.id, { proposal: 'p1', costUsd: 0.2, summary: 'Proposed 2 fields' })
    doc = (await payload.findByID({ collection: 'runs', id: run.id }))!
    expect(doc).toMatchObject({ status: 'done', proposal: 'p1', costUsd: 0.2, leaseUntil: null, now: 'Proposed 2 fields' })
    expect(await claimRun(payload, run.id)).toBe(false)
    expect(payload.writes.every((w) => w.collection !== 'runs' || w.context?.sitekickAgent === 'runs')).toBe(true)
  })
  test('attempts cap and failRun', async () => {
    const payload = stubPayload()
    const run = await startRun(payload, { kind: 'draft@1', title: 'x' })
    await payload.update({ collection: 'runs', id: run.id, data: { attempts: 3 } })
    expect(await claimRun(payload, run.id, { maxAttempts: 3 })).toBe(false)
    await failRun(payload, run.id, new Error('boom'), { costUsd: 0.05 })
    expect(await payload.findByID({ collection: 'runs', id: run.id })).toMatchObject({ status: 'failed', error: 'boom', costUsd: 0.05 })
  })
  test('askEditor posts the question, waits for the answer, clears it', async () => {
    const payload = stubPayload()
    const run = await startRun(payload, { kind: 'enrich@1', title: 'x' })
    let polls = 0
    const sleep = async () => {
      polls++
      if (polls === 2) await payload.update({ collection: 'runs', id: run.id, data: { answer: 'The second one' } })
    }
    const pending = askEditor(payload, run.id, { text: 'Which Jane?', options: ['A', 'B'] }, { timeoutMs: 10_000, pollMs: 1, sleep })
    const during = (await payload.findByID({ collection: 'runs', id: run.id }))!
    expect(during.status).toBe('waiting')
    expect(during.question).toEqual({ text: 'Which Jane?', options: ['A', 'B'] })
    expect(await pending).toBe('The second one')
    expect(await payload.findByID({ collection: 'runs', id: run.id })).toMatchObject({ status: 'running', question: null, answer: null })
  })
  test('askEditor times out into failed', async () => {
    const payload = stubPayload()
    const run = await startRun(payload, { kind: 'enrich@1', title: 'x' })
    await expect(askEditor(payload, run.id, { text: 'Q', options: [] }, { timeoutMs: 0, pollMs: 1, sleep: async () => {} })).rejects.toThrow('did not answer')
    expect((await payload.findByID({ collection: 'runs', id: run.id }))?.status).toBe('failed')
  })
})
