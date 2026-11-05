import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { generateText, Output } from 'ai'
import { z } from 'zod'

import { runDraft, type DraftInput } from '../agents/draft'
import { runEdit, type EditInput } from '../agents/edit'
import { runEnrich, type EnrichInput } from '../agents/enrich'
import { costFromResult, resolveModel } from '../model'
import type { CollectionLike, Doc } from '../payload'
import { getPath } from '../proposals'
import type { Runner } from '../runner'
import { stubPayload, type StubPayload } from '../testing/stub-payload'

export { stubPayload, type StubPayload } from '../testing/stub-payload'

/**
 * The evals harness: run the agents on fixed cases, once per model, and keep a ledger.
 *
 * Each case runs against its own in-memory Payload (the testing stub), seeded with the
 * case's documents and given the site's real collection configs, so models never share
 * state and nothing touches a database: the stub plays the part of a branch per model.
 * The agent runs for real (through AI Gateway, with the model under test), then its
 * proposal is graded two ways:
 *
 *   expect   exact checks on proposed values: a value, a RegExp, or a function returning
 *            true or the reason it failed. `forbid` lists fields that must not be proposed.
 *   judge    a rubric for an LLM judge (Claude Opus by default) that scores the proposal
 *            1 to 5 with a reason. 4 or more passes.
 *
 * A case passes when every check passes and the judge (if any) scores 4+. Results append
 * to a JSONL ledger with model, cost, time and the git commit, so a model or prompt change
 * can be compared with the last run.
 */
export type Expectation = unknown | RegExp | ((value: unknown) => true | string)

export type EvalCase = {
  id: string
  description?: string
  /** Collection configs the agent sees: the site's own, from its sanitized Payload config. */
  collections: CollectionLike[]
  /** Documents to seed, by collection. */
  seed?: Record<string, Doc[]>
  /** Start the agent. Use draftCase / enrichCase / editCase instead of writing this. */
  run: (payload: StubPayload, opts: { model: string; runner?: Runner }) => Promise<{ runId: string | number; proposalId: string | number | null }>
  expect?: Record<string, Expectation>
  forbid?: string[]
  judge?: string
}

type CaseBase = Omit<EvalCase, 'run'>

export const draftCase = (c: CaseBase & { input: DraftInput }): EvalCase => ({ ...c, run: (payload, opts) => runDraft(payload, c.input, opts) })
export const enrichCase = (c: CaseBase & { input: EnrichInput }): EvalCase => ({ ...c, run: (payload, opts) => runEnrich(payload, c.input, opts) })
export const editCase = (c: CaseBase & { input: EditInput }): EvalCase => ({ ...c, run: (payload, opts) => runEdit(payload, c.input, opts) })

export type CheckResult = { path: string; pass: boolean; reason?: string }
export type JudgeVerdict = { score: number; reason: string; costUsd: number | null }

export type EvalResult = {
  at: string
  case: string
  model: string
  pass: boolean
  checks: CheckResult[]
  judge?: JudgeVerdict
  /** Agent spend plus the judge's. */
  costUsd: number | null
  ms: number
  error?: string
  commit?: string
}

/** Grade a proposal's patch against `expect` and `forbid`. Pure. */
export function checkPatch(patch: Record<string, { value: unknown }>, expectations: Record<string, Expectation> = {}, forbid: string[] = []): CheckResult[] {
  const results: CheckResult[] = []
  for (const [path, expected] of Object.entries(expectations)) {
    const field = patch[path] ?? nested(patch, path)
    if (!field) {
      results.push({ path, pass: false, reason: 'not proposed' })
      continue
    }
    const value = field.value
    if (expected instanceof RegExp) {
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      results.push(expected.test(text) ? { path, pass: true } : { path, pass: false, reason: `${JSON.stringify(text).slice(0, 120)} does not match ${expected}` })
    } else if (typeof expected === 'function') {
      const verdict = (expected as (v: unknown) => true | string)(value)
      results.push(verdict === true ? { path, pass: true } : { path, pass: false, reason: verdict })
    } else {
      const ok = JSON.stringify(value) === JSON.stringify(expected)
      results.push(ok ? { path, pass: true } : { path, pass: false, reason: `got ${JSON.stringify(value).slice(0, 120)}` })
    }
  }
  for (const path of forbid) {
    results.push(patch[path] || nested(patch, path) ? { path, pass: false, reason: 'proposed, but must not be' } : { path, pass: true })
  }
  return results
}

/** `meta.title` may be proposed as `meta: { value: { title } }`. */
function nested(patch: Record<string, { value: unknown }>, path: string): { value: unknown } | undefined {
  const [head, ...rest] = path.split('.')
  const parent = head ? patch[head] : undefined
  if (!parent || !rest.length) return undefined
  const value = getPath(parent.value as Record<string, unknown>, rest.join('.'))
  return value === undefined ? undefined : { value }
}

export type JudgeFn = (args: { rubric: string; proposal: Doc; model: string }) => Promise<JudgeVerdict>

/** Score a proposal 1–5 against a rubric with the judge model (D5: Claude Opus). */
export const llmJudge: JudgeFn = async ({ rubric, proposal, model }) => {
  const result = await generateText({
    model,
    system:
      'You grade an AI agent’s proposed change to a website CMS. Read the rubric, then the proposal (the fields it would set, with their sources). Score 1 to 5: 5 meets every point of the rubric, 4 has a small flaw, 3 has a real problem, 2 is mostly wrong, 1 is unusable or invents facts. Be strict about invented facts. Give a one or two sentence reason that names the flaw.',
    prompt: `Rubric:\n${rubric}\n\nProposal:\n${JSON.stringify({ title: proposal.title, summary: proposal.summary, patch: proposal.patch }, null, 2).slice(0, 60_000)}`,
    output: Output.object({ schema: z.object({ score: z.number().int().min(1).max(5), reason: z.string() }) }),
    providerOptions: resolveModel({ purpose: 'judge', override: model }).providerOptions,
  })
  return { ...result.output, costUsd: costFromResult(result) }
}

export type RunEvalsOptions = {
  cases: EvalCase[]
  /** Models to compare. Default: the research default. */
  models?: string[]
  judgeModel?: string
  judge?: JudgeFn
  runner?: Runner
  /** JSONL file results are appended to. */
  ledger?: string
  commit?: string
  /** Called as each result lands, for progress output. */
  onResult?: (result: EvalResult) => void
}

/** Every case on every model, one after another (models are compared on the same cases). */
export async function runEvals(options: RunEvalsOptions): Promise<EvalResult[]> {
  const models = options.models?.length ? options.models : [resolveModel({ purpose: 'research' }).model]
  const judgeModel = options.judgeModel ?? resolveModel({ purpose: 'judge' }).model
  const judge = options.judge ?? llmJudge
  const results: EvalResult[] = []
  for (const model of models) {
    for (const c of options.cases) {
      const result = await runCase(c, { model, judge, judgeModel, runner: options.runner, commit: options.commit })
      results.push(result)
      if (options.ledger) {
        mkdirSync(dirname(options.ledger), { recursive: true })
        appendFileSync(options.ledger, JSON.stringify(result) + '\n')
      }
      options.onResult?.(result)
    }
  }
  return results
}

async function runCase(c: EvalCase, { model, judge, judgeModel, runner, commit }: { model: string; judge: JudgeFn; judgeModel: string; runner?: Runner; commit?: string }): Promise<EvalResult> {
  const started = Date.now()
  const base = { at: new Date().toISOString(), case: c.id, model, ...(commit ? { commit } : {}) }
  const payload = stubPayload({ collections: c.collections })
  for (const [collection, docs] of Object.entries(c.seed ?? {})) for (const doc of docs) payload.store.set(collection, [...(payload.store.get(collection) ?? []), structuredClone(doc)])
  try {
    const { runId, proposalId } = await c.run(payload, { model, runner })
    const run = await payload.findByID({ collection: 'runs', id: runId })
    const agentCost = typeof run?.costUsd === 'number' ? run.costUsd : null
    const proposal = proposalId !== null ? await payload.findByID({ collection: 'proposals', id: proposalId }) : null
    if (!proposal) return { ...base, pass: false, checks: [], costUsd: agentCost, ms: Date.now() - started, error: String(run?.error ?? 'no proposal') }
    const checks = checkPatch((proposal.patch ?? {}) as Record<string, { value: unknown }>, c.expect, c.forbid)
    const verdict = c.judge ? await judge({ rubric: c.judge, proposal, model: judgeModel }) : undefined
    const costs = [agentCost, verdict?.costUsd ?? null].filter((n): n is number => typeof n === 'number')
    return {
      ...base,
      pass: checks.every((r) => r.pass) && (!verdict || verdict.score >= 4),
      checks,
      ...(verdict ? { judge: verdict } : {}),
      costUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
      ms: Date.now() - started,
    }
  } catch (err) {
    return { ...base, pass: false, checks: [], costUsd: null, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) }
  }
}

export type ModelSummary = { model: string; cases: number; passed: number; meanScore: number | null; costUsd: number; meanSeconds: number }

/** Per model: how many passed, the mean judge score, total spend and mean time. */
export function summarize(results: EvalResult[]): ModelSummary[] {
  const byModel = new Map<string, EvalResult[]>()
  for (const r of results) byModel.set(r.model, [...(byModel.get(r.model) ?? []), r])
  return [...byModel].map(([model, rs]) => {
    const scores = rs.map((r) => r.judge?.score).filter((s): s is number => typeof s === 'number')
    return {
      model,
      cases: rs.length,
      passed: rs.filter((r) => r.pass).length,
      meanScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
      costUsd: Math.round(rs.reduce((a, r) => a + (r.costUsd ?? 0), 0) * 10_000) / 10_000,
      meanSeconds: Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length / 100) / 10,
    }
  })
}

/** The summary as a plain table for a terminal. */
export function formatSummary(rows: ModelSummary[]): string {
  const head = ['model', 'passed', 'judge', 'cost', 'time']
  const body = rows.map((r) => [r.model, `${r.passed}/${r.cases}`, r.meanScore === null ? '–' : r.meanScore.toFixed(2), `$${r.costUsd.toFixed(4)}`, `${r.meanSeconds}s`])
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ')
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n')
}
