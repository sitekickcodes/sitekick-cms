import { Output, generateText } from 'ai'
import { z } from 'zod'

import { costFromResult, resolveModel } from './model'
import type { Receipt } from './receipts'
import { excerptFor } from './receipts'

/**
 * Checks that run before a proposal is written. Deterministic ones are free
 * and run on every field; the model judge runs on prose. A failing check
 * drops the field and records why, so the editor sees "bio dropped: sentence
 * 2 unsupported" instead of a confident wrong value.
 */
export type VerifyResult = { ok: true } | { ok: false; reason: string }

export type ProposedField = {
  value: unknown
  current?: unknown
  receipts?: Receipt[]
  note?: string
}

export type Patch = Record<string, ProposedField>

export type Check = (field: ProposedField, path: string) => VerifyResult | Promise<VerifyResult>

export async function urlAlive(url: string, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<VerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 10_000)
  try {
    let res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal })
    // Plenty of hosts refuse HEAD; a GET settles it.
    if (res.status === 405 || res.status === 403 || res.status === 404) res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal })
    await res.body?.cancel().catch(() => {})
    return res.status < 400 ? { ok: true } : { ok: false, reason: `${new URL(url).hostname} returned HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, reason: `${new URL(url).hostname} unreachable: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** The receipt's excerpt must actually appear in the text that was fetched. */
export function excerptPresent(receipt: Receipt, text: string): VerifyResult {
  const excerpt = receipt.excerpt.replace(/^…|…$/g, '').trim()
  if (!excerpt) return { ok: false, reason: 'empty excerpt' }
  return excerptFor(text, excerpt, 0) !== null ? { ok: true } : { ok: false, reason: `excerpt not found in ${receipt.url}` }
}

export function lengthWithin(value: unknown, { min = 0, max }: { min?: number; max: number }): VerifyResult {
  const length = typeof value === 'string' ? value.trim().length : -1
  if (length < 0) return { ok: false, reason: 'not a string' }
  if (length < min) return { ok: false, reason: `${length} chars, under ${min}` }
  if (length > max) return { ok: false, reason: `${length} chars, over ${max}` }
  return { ok: true }
}

const judgement = z.object({
  claims: z.array(
    z.object({
      sentence: z.string(),
      supported: z.boolean(),
      receipt: z.number().int().nullable().describe('Index of the receipt whose excerpt supports the sentence, or null'),
    }),
  ),
})
export type Judgement = z.infer<typeof judgement>

export type Judge = (args: { bio: string; receipts: Receipt[] }) => Promise<{ judgement: Judgement; costUsd: number | null }>

/** The default judge: a structured call to the judge model through the Gateway. */
export const modelJudge =
  (modelOverride?: string): Judge =>
  async ({ bio, receipts }) => {
    const resolved = resolveModel({ purpose: 'judge', override: modelOverride })
    const result = await generateText({
      model: resolved.model,
      providerOptions: resolved.providerOptions,
      output: Output.object({ schema: judgement }),
      system:
        'You check a short biography sentence by sentence against quoted source passages. A sentence is supported only if a passage states it (not merely suggests it). Do not use outside knowledge.',
      prompt: `Biography:\n${bio}\n\nPassages:\n${receipts.map((r, i) => `[${i}] (${r.url}) ${r.excerpt}`).join('\n\n')}`,
    })
    return { judgement: result.output, costUsd: costFromResult(result) }
  }

/**
 * Claim-by-claim check of prose against its receipts. Any unsupported
 * sentence fails the whole field: a bio with one invented sentence is still a
 * bio the editor cannot trust.
 */
export async function claimsSupported({
  bio,
  receipts,
  judge = modelJudge(),
}: {
  bio: string
  receipts: Receipt[]
  judge?: Judge
}): Promise<VerifyResult & { costUsd?: number | null; judgement?: Judgement }> {
  if (!receipts.length) return { ok: false, reason: 'no receipts' }
  const { judgement: verdict, costUsd } = await judge({ bio, receipts })
  const bad = verdict.claims.filter((c) => !c.supported)
  if (bad.length) {
    return { ok: false, reason: `unsupported: ${bad.map((c) => `"${c.sentence.slice(0, 80)}"`).join('; ')}`, costUsd, judgement: verdict }
  }
  return { ok: true, costUsd, judgement: verdict }
}

/**
 * Keep only the sentences the judge marked supported, in their original order
 * and wording. Returns null when the judge's sentences do not match the bio
 * verbatim (it paraphrased, so nothing can be trimmed safely) or when fewer
 * than `minChars` survive.
 */
export function trimToSupported(bio: string, verdict: Judgement, { minChars = 40 } = {}): { value: string; removed: string[] } | null {
  const kept: string[] = []
  const removed: string[] = []
  for (const claim of verdict.claims) {
    const sentence = claim.sentence.trim()
    if (!sentence || !bio.includes(sentence)) return null
    ;(claim.supported ? kept : removed).push(sentence)
  }
  const value = kept.join(' ')
  return value.length >= minChars ? { value, removed } : null
}

export type VerifiedPatch = {
  patch: Patch
  /** Fields removed, with the failing reason recorded in `note` for the summary. */
  dropped: Record<string, ProposedField & { note: string }>
}

/**
 * Run each field's checks; keep the passing fields, move the failing ones to
 * `dropped` with the reason in `note`. `checks['*']` runs on every field.
 */
export async function runVerifiers(patch: Patch, checks: Record<string, Check[]>): Promise<VerifiedPatch> {
  const kept: Patch = {}
  const dropped: VerifiedPatch['dropped'] = {}
  for (const [path, field] of Object.entries(patch)) {
    const list = [...(checks['*'] ?? []), ...(checks[path] ?? [])]
    let failure: string | null = null
    for (const check of list) {
      const result = await check(field, path)
      if (!result.ok) {
        failure = result.reason
        break
      }
    }
    if (failure) dropped[path] = { ...field, note: `Dropped: ${failure}` }
    else kept[path] = field
  }
  return { patch: kept, dropped }
}
