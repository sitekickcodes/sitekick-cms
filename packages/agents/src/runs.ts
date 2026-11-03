import type { AgentPayload, Doc } from './payload'

/**
 * The `runs` collection is the editor's window on an agent: stage, the "Now:"
 * line, a step list, an open question. This module owns the status machine
 * and the lease; a durable loop (adapters/workflow.ts) drives it between
 * sleeps, the HTTP route drives it in one process for local development.
 */
export type RunStatus = 'queued' | 'running' | 'waiting' | 'done' | 'failed' | 'cancelled'
export type StepStatus = 'running' | 'done' | 'failed' | 'skipped'
export type RunStep = { label: string; status: StepStatus; detail?: string; at: string }
export type RunQuestion = { text: string; options: string[] }

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['waiting', 'done', 'failed', 'cancelled', 'queued'],
  waiting: ['running', 'failed', 'cancelled'],
  done: [],
  failed: ['queued'],
  cancelled: [],
}

export const canTransition = (from: RunStatus, to: RunStatus): boolean => TRANSITIONS[from]?.includes(to) ?? false

export class AgentsDisabledError extends Error {
  constructor() {
    super('Agents are disabled (SITEKICK_AGENTS_DISABLED is set).')
    this.name = 'AgentsDisabledError'
  }
}

/** Kill switch: any truthy value other than "0"/"false" stops new runs and claims. */
export const agentsDisabled = (env: Record<string, string | undefined> = process.env): boolean => {
  const value = env.SITEKICK_AGENTS_DISABLED?.trim().toLowerCase()
  return !!value && value !== '0' && value !== 'false'
}

export function assertAgentsEnabled(env?: Record<string, string | undefined>): void {
  if (agentsDisabled(env)) throw new AgentsDisabledError()
}

const RUNS = 'runs'
const CONTEXT = { sitekickAgent: 'runs' }

export type StartRunArgs = {
  kind: string
  title: string
  targetCollection?: string
  targetId?: string | number
  input?: unknown
  triggeredBy?: string | number
  model?: string
}

export async function startRun(payload: AgentPayload, args: StartRunArgs): Promise<Doc> {
  assertAgentsEnabled()
  return payload.create({
    collection: RUNS,
    data: {
      title: args.title,
      kind: args.kind,
      status: 'queued',
      ...(args.targetCollection ? { targetCollection: args.targetCollection } : {}),
      ...(args.targetId !== undefined ? { targetId: String(args.targetId) } : {}),
      ...(args.input !== undefined ? { input: args.input } : {}),
      ...(args.triggeredBy !== undefined ? { triggeredBy: args.triggeredBy } : {}),
      ...(args.model ? { model: args.model } : {}),
      attempts: 0,
      steps: [],
      costUsd: 0,
    },
    overrideAccess: true,
    context: CONTEXT,
  })
}

export const getRun = (payload: AgentPayload, id: string | number) =>
  payload.findByID({ collection: RUNS, id, depth: 0, overrideAccess: true, disableErrors: true })

/**
 * Take the run for `leaseMs`. Conditional on the lease having lapsed (or
 * never set) and the run still being claimable, as one where-based update,
 * which is the closest the Local API gets to UPDATE … WHERE; the durable loop
 * is a singleton per run (workflow hook token), so two claimants only meet
 * after a crash, where the lease decides. Returns false when someone else
 * holds it.
 */
export async function claimRun(payload: AgentPayload, id: string | number, { leaseMs = 30 * 60_000, maxAttempts = 3 }: { leaseMs?: number; maxAttempts?: number } = {}): Promise<boolean> {
  assertAgentsEnabled()
  const run = await getRun(payload, id)
  if (!run) return false
  const status = run.status as RunStatus
  const attempts = Number(run.attempts ?? 0)
  const lease = typeof run.leaseUntil === 'string' ? Date.parse(run.leaseUntil) : 0
  const now = Date.now()
  const claimable = (status === 'queued' || status === 'running' || status === 'waiting') && (!lease || lease < now)
  if (!claimable || attempts >= maxAttempts) return false
  const result = await payload.update({
    collection: RUNS,
    where: {
      and: [
        { id: { equals: id } },
        { status: { in: ['queued', 'running', 'waiting'] } },
        { or: [{ leaseUntil: { exists: false } }, { leaseUntil: { less_than: new Date(now).toISOString() } }] },
      ],
    },
    data: { status: 'running', attempts: attempts + 1, leaseUntil: new Date(now + leaseMs).toISOString(), error: null },
    overrideAccess: true,
    context: CONTEXT,
  })
  const docs = (result as { docs?: Doc[] } | null)?.docs ?? []
  return docs.length === 1
}

export type RunUpdate = {
  stage?: string
  now?: string
  /** Appended; a step with the same label as the last `running` one updates it in place. */
  step?: RunStep | Omit<RunStep, 'at'>
  status?: RunStatus
  costUsd?: number
  session?: string
  model?: string
  proposal?: string | number
  question?: RunQuestion | null
  leaseUntil?: string | null
}

export async function updateRun(payload: AgentPayload, id: string | number, update: RunUpdate): Promise<void> {
  const { step, ...rest } = update
  const data: Record<string, unknown> = { ...rest }
  if (step) {
    const run = await getRun(payload, id)
    const steps = (Array.isArray(run?.steps) ? run.steps : []) as RunStep[]
    const entry: RunStep = { at: new Date().toISOString(), ...step }
    const last = steps[steps.length - 1]
    if (last && last.status === 'running' && last.label === entry.label) steps[steps.length - 1] = { ...last, ...entry }
    else steps.push(entry)
    data.steps = steps
    if (!rest.now) data.now = entry.detail ? `${entry.label}: ${entry.detail}` : entry.label
  }
  await payload.update({ collection: RUNS, id, data, overrideAccess: true, context: CONTEXT })
}

export async function addCost(payload: AgentPayload, id: string | number, costUsd: number | null): Promise<void> {
  if (!costUsd) return
  const run = await getRun(payload, id)
  await updateRun(payload, id, { costUsd: Number(run?.costUsd ?? 0) + costUsd })
}

export class AskEditorTimeout extends Error {
  constructor(public readonly runId: string | number) {
    super('The editor did not answer in time.')
    this.name = 'AskEditorTimeout'
  }
}

/**
 * Post a question and wait for the editor's answer by polling `answer`. This
 * is the in-process form, fine for a route handler or a dev server. Durable
 * waiting (no compute while the editor thinks, surviving a redeploy) belongs
 * to the workflow adapter, which sleeps on a hook and resumes the run; the
 * `question`/`answer` columns are the same either way.
 */
export async function askEditor(
  payload: AgentPayload,
  id: string | number,
  question: RunQuestion,
  { timeoutMs = 10 * 60_000, pollMs = 2_000, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<string> {
  await updateRun(payload, id, { question, status: 'waiting', now: `Waiting for an answer: ${question.text}`, leaseUntil: null })
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const run = await getRun(payload, id)
    const answer = typeof run?.answer === 'string' ? run.answer.trim() : ''
    if (answer) {
      await payload.update({ collection: RUNS, id, data: { question: null, answer: null, status: 'running', now: 'Answer received' }, overrideAccess: true, context: CONTEXT })
      return answer
    }
    if (run?.status === 'cancelled') throw new Error('The run was cancelled while waiting for an answer.')
    if (Date.now() >= deadline) {
      await updateRun(payload, id, { status: 'failed', question: null, now: 'No answer in time' })
      throw new AskEditorTimeout(id)
    }
    await sleep(pollMs)
  }
}

export async function finishRun(payload: AgentPayload, id: string | number, { proposal, costUsd, summary }: { proposal?: string | number | null; costUsd?: number | null; summary?: string } = {}): Promise<void> {
  const run = await getRun(payload, id)
  await payload.update({
    collection: RUNS,
    id,
    data: {
      status: 'done',
      stage: 'Done',
      now: summary ? summary.slice(0, 200) : 'Done',
      leaseUntil: null,
      question: null,
      ...(proposal ? { proposal } : {}),
      costUsd: Number(run?.costUsd ?? 0) + (costUsd ?? 0),
    },
    overrideAccess: true,
    context: CONTEXT,
  })
}

export async function failRun(payload: AgentPayload, id: string | number, error: unknown, { costUsd }: { costUsd?: number | null } = {}): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const run = await getRun(payload, id)
  await payload.update({
    collection: RUNS,
    id,
    data: { status: 'failed', now: `Failed: ${message.slice(0, 180)}`, error: message.slice(0, 2000), leaseUntil: null, question: null, costUsd: Number(run?.costUsd ?? 0) + (costUsd ?? 0) },
    overrideAccess: true,
    context: CONTEXT,
  })
}

export async function cancelRun(payload: AgentPayload, id: string | number, by?: string): Promise<void> {
  await payload.update({
    collection: RUNS,
    id,
    data: { status: 'cancelled', now: by ? `Stopped by ${by}` : 'Stopped', leaseUntil: null, question: null },
    overrideAccess: true,
    context: CONTEXT,
  })
}
