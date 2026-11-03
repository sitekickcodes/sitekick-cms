import { sleep } from 'workflow'

import { runDraft } from '../agents/draft'
import type { DraftInput } from '../agents/draft'
import { runEnrich } from '../agents/enrich'
import type { EnrichInput } from '../agents/enrich'
import type { AgentPayload } from '../payload'
import { getRun } from '../runs'

/**
 * Durable orchestration with Vercel Workflow, modelled on the loop that
 * replaced Yimby's sweep cron: advance the run, sleep until the next thing
 * that could be due (a lease expiry, a retry), repeat until it is done,
 * failed or cancelled. Guarded behind the optional `workflow` peer: import
 * this file only from an app that has `workflow` installed and the Workflow
 * build plugin configured.
 *
 * Steps cannot receive functions, so the app registers how to load Payload
 * once at module scope (`registerPayloadLoader`) before starting a workflow.
 */
export type AgentJob = { runId: string | number } & ({ agent: 'enrich'; input: EnrichInput } | { agent: 'draft'; input: DraftInput })

type Next = { kind: 'stop'; reason: string } | { kind: 'wait'; until: string }

let loader: (() => Promise<AgentPayload>) | null = null

export function registerPayloadLoader(load: () => Promise<AgentPayload>): void {
  loader = load
}

const RETRY_PAUSE_MS = 60_000
const LEASE_GRACE_MS = 30_000

export async function runAgentWorkflow(job: AgentJob): Promise<{ runId: string | number; stopped: string }> {
  'use workflow'
  // Bounded: a few attempts plus a question or two fits well inside.
  for (let turn = 0; turn < 20; turn++) {
    const next = await advanceAgentRun(job)
    if (next.kind === 'stop') return { runId: job.runId, stopped: next.reason }
    await sleep(new Date(next.until))
  }
  return { runId: job.runId, stopped: 'turn limit' }
}

/**
 * One step: look at the run; start or resume it when it is due. The agent
 * itself runs inside the step, so a crash mid-research leaves a lapsed lease
 * that the next turn picks up (`claimRun` inside runEnrich/runDraft).
 */
async function advanceAgentRun(job: AgentJob): Promise<Next> {
  'use step'
  if (!loader) throw new Error('registerPayloadLoader() was not called')
  const payload = await loader()
  const run = await getRun(payload, job.runId)
  if (!run) return { kind: 'stop', reason: 'run not found' }
  const status = String(run.status)
  if (status === 'done' || status === 'failed' || status === 'cancelled') return { kind: 'stop', reason: status }
  const lease = typeof run.leaseUntil === 'string' ? Date.parse(run.leaseUntil) : 0
  if (status === 'waiting') {
    // askEditor's in-process poll handles the answer; this loop only keeps the workflow alive.
    return { kind: 'wait', until: new Date(Date.now() + RETRY_PAUSE_MS).toISOString() }
  }
  if (lease > Date.now()) return { kind: 'wait', until: new Date(lease + LEASE_GRACE_MS).toISOString() }
  try {
    const common = { runId: job.runId }
    if (job.agent === 'enrich') await runEnrich(payload, job.input, common)
    else await runDraft(payload, job.input, common)
    return { kind: 'stop', reason: 'done' }
  } catch (err) {
    const after = await getRun(payload, job.runId)
    // claimRun refused (attempts exhausted) or the agent failed for good: failRun already recorded it.
    if (String(after?.status) === 'failed') return { kind: 'stop', reason: err instanceof Error ? err.message : String(err) }
    return { kind: 'wait', until: new Date(Date.now() + RETRY_PAUSE_MS).toISOString() }
  }
}
