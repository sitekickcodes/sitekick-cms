import { describe, expect, test } from 'bun:test'

import { agentLabel, budgetFromEnv, money, personOf, usageOf, type UsageRun } from '../usage'

const now = new Date('2026-11-15T12:00:00Z')
const run = (over: Partial<UsageRun>): UsageRun => ({ id: Math.random(), createdAt: '2026-11-10T09:00:00Z', kind: 'draft@1', model: 'anthropic/claude-sonnet-5-5', status: 'done', costUsd: 0.1, triggeredBy: 1, ...over })

describe('usageOf', () => {
  const runs = [
    run({ id: 1, costUsd: 0.2 }),
    run({ id: 2, kind: 'enrich@1', costUsd: 0.5, triggeredBy: { relationTo: 'users', value: 2 } }),
    run({ id: 3, kind: 'edit@1', costUsd: 0.05, status: 'failed', model: 'anthropic/claude-haiku-5-5', triggeredBy: null }),
    run({ id: 4, costUsd: null, createdAt: '2026-11-14T23:00:00Z' }),
    run({ id: 5, costUsd: 1, createdAt: '2026-10-20T10:00:00Z' }),
    run({ id: 6, costUsd: 3, createdAt: '2026-09-20T10:00:00Z' }),
  ]
  const u = usageOf(runs, { now, budgetUsd: 1, people: { '1': 'John', '2': 'Ana' } })

  test('this month, last month and the projection', () => {
    expect(u.month).toMatchObject({ costUsd: 0.75, runs: 4, label: 'November 2026' })
    // 14.5 days gone of 30: 0.75 / 14.5 × 30.
    expect(u.month.projectedUsd).toBeCloseTo(1.5517, 3)
    expect(u.lastMonth).toMatchObject({ costUsd: 1, runs: 1, label: 'October 2026' })
    expect(u.budgetUsd).toBe(1)
    expect(u.failedUsd).toBe(0.05)
    expect(u.unmeasured).toBe(1)
  })

  test('30 days, every day present, oldest first', () => {
    expect(u.days).toHaveLength(30)
    expect(u.days[0]!.date).toBe('2026-10-17')
    expect(u.days.at(-1)!.date).toBe('2026-11-15')
    expect(u.days.find((d) => d.date === '2026-11-10')).toEqual({ date: '2026-11-10', costUsd: 0.75, runs: 3 })
    expect(u.days.find((d) => d.date === '2026-10-20')!.costUsd).toBe(1)
  })

  test('breakdowns, most expensive first, in editors’ words', () => {
    expect(u.byAgent.map((r) => [r.label, r.costUsd, r.runs])).toEqual([
      ['Find details', 0.5, 1],
      ['Draft from notes', 0.2, 2],
      ['Edit with words', 0.05, 1],
    ])
    expect(u.byModel.map((r) => r.key)).toEqual(['anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5'])
    expect(u.byPerson.map((r) => r.label)).toEqual(['Ana', 'John', 'Scheduled or automatic'])
    expect(u.top.map((r) => r.id)).toEqual([2, 1, 3])
  })
})

test('helpers', () => {
  expect(agentLabel('field-action@2')).toBe('Field action')
  expect(personOf({ id: 7 })).toBe('7')
  expect(personOf(undefined)).toBeNull()
  expect(budgetFromEnv({ SITEKICK_AI_BUDGET_USD: '25' })).toBe(25)
  expect(budgetFromEnv({ SITEKICK_AI_BUDGET_USD: 'lots' })).toBeNull()
  expect(money(0.004)).toBe('$0.004')
  expect(money(12.5)).toBe('$12.50')
})
