import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { CollectionLike } from '@sitekick/agents'
import { formatSummary, runEvals, summarize } from '@sitekick/agents/evals'

import configPromise from '../src/payload.config'
import { evalCases } from '../evals/cases'

/**
 * Run the eval cases against live models through AI Gateway and append to evals/ledger.jsonl.
 * Nothing touches the database: each case runs on an in-memory Payload with this site's
 * collection configs.
 *
 *   bun run evals                                   default research model
 *   bun run evals --models anthropic/claude-sonnet-5-5,openai/gpt-6
 *   bun run evals --case draft/closure-notice
 *
 * Needs AI Gateway access: `vercel env pull .env.local` (OIDC) or AI_GATEWAY_API_KEY.
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const config = await configPromise
const cases = evalCases(config.collections as unknown as CollectionLike[]).filter((c) => !arg('case') || c.id === arg('case'))
if (!cases.length) throw new Error(`No case ${arg('case')}`)
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return undefined
  }
})()

const results = await runEvals({
  cases,
  models: arg('models')?.split(',').map((m) => m.trim()).filter(Boolean),
  ledger: fileURLToPath(new URL('../evals/ledger.jsonl', import.meta.url)),
  commit,
  onResult: (r) => {
    const mark = r.pass ? '✓' : '✗'
    const why = [...r.checks.filter((c) => !c.pass).map((c) => `${c.path}: ${c.reason}`), r.judge ? `judge ${r.judge.score}/5: ${r.judge.reason}` : '', r.error ?? ''].filter(Boolean)
    console.log(`${mark} ${r.case}  ${r.model}  $${(r.costUsd ?? 0).toFixed(4)}  ${(r.ms / 1000).toFixed(1)}s`)
    for (const line of why) console.log(`    ${line}`)
  },
})
console.log(`\n${formatSummary(summarize(results))}`)
process.exit(results.every((r) => r.pass) ? 0 : 1)
