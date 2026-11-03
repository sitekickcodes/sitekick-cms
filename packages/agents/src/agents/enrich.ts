import { tool } from 'ai'
import type { Tool } from 'ai'
import { z } from 'zod'

import { flattenFields, pickField } from '../fields'
import type { AgentPayload, Doc } from '../payload'
import { createProposal } from '../proposals'
import { excerptFor, fetchWithReceipt } from '../receipts'
import type { FetchOptions, FetchResult, Receipt } from '../receipts'
import { aiSdkRunner } from '../runner'
import type { AgentDefinition, RunContext, Runner } from '../runner'
import { claimRun, failRun, finishRun, startRun, updateRun } from '../runs'
import { claimsSupported, excerptPresent, lengthWithin, runVerifiers, urlAlive } from '../verifiers'
import type { Check, Judge, Patch, VerifyResult } from '../verifiers'
import { webSearchTool } from '../search'

/**
 * Enrich: "research this entity and fill in the profile". Works on any
 * collection with a name: people, partners, venues, sponsors. Finds the
 * official site, social profiles, a neutral bio and a photo or logo with
 * credit, each with a receipt, and ends in one proposal.
 */
export type EnrichInput = { targetCollection: string; targetId: string | number }
export type EnrichSlot = 'website' | 'bio' | 'image' | 'social'
export type FieldMap = Partial<Record<EnrichSlot, string>>

const SLOT_PATTERNS: Record<EnrichSlot, RegExp> = {
  website: /^(website|url|site|homepage|link|websiteUrl)$/i,
  bio: /^(bio|biography|description|summary|about)$/i,
  image: /^(photo|headshot|logo|image|avatar|portrait|picture)$/i,
  social: /^(social|socials|socialLinks|profiles)$/i,
}

export function resolveFieldMap(fields: Array<Record<string, unknown>>, overrides: FieldMap = {}): FieldMap {
  const flat = flattenFields(fields)
  return {
    website: overrides.website ?? pickField(flat, SLOT_PATTERNS.website, ['text']),
    bio: overrides.bio ?? pickField(flat, SLOT_PATTERNS.bio, ['textarea', 'text', 'richText']),
    image: overrides.image ?? pickField(flat, SLOT_PATTERNS.image, ['upload']),
    social: overrides.social ?? pickField(flat, SLOT_PATTERNS.social, ['array']),
  }
}

const nameOf = (doc: Doc | null) =>
  String(doc?.name ?? doc?.title ?? doc?.fullName ?? [doc?.firstName, doc?.lastName].filter(Boolean).join(' ') ?? '').trim() || `#${doc?.id ?? '?'}`

const MAX_PAGE_CHARS = 14_000

const passagesAround = (text: string, find: string) => {
  const hits: string[] = []
  const lower = text.toLowerCase()
  let at = lower.indexOf(find.toLowerCase())
  while (at !== -1 && hits.length < 6) {
    hits.push(text.slice(Math.max(0, at - 400), at + find.length + 400))
    at = lower.indexOf(find.toLowerCase(), at + find.length)
  }
  return hits.join('\n…\n')
}

export type EnrichOptions = {
  runner?: Runner
  /** Reuse an existing run (the workflow adapter creates it first). */
  runId?: string | number
  fieldMap?: FieldMap
  triggeredBy?: string | number
  model?: string
  /** Injection points: the judge for the bio, liveness for the website, fetch and search for pages. */
  judge?: Judge
  urlAlive?: (url: string) => Promise<VerifyResult>
  fetch?: (url: string, opts?: FetchOptions) => Promise<FetchResult>
  search?: Tool
  signal?: AbortSignal
}

type Collected = {
  pages: Map<string, { receipt: Receipt; text: string }>
  patch: Patch
  summary: string
  outcome: 'done' | 'incomplete'
}

const INSTRUCTIONS = `You research one entity for a content editor and fill in its profile from public sources. You never invent: every value you propose must come from a page you fetched, and you must quote the passage that says it.

Work in this order:
1. web_search for the entity's official website (use the name and any context the record gives). Fetch the most likely candidate with fetch_page and confirm it is theirs.
2. From the official site (and its about/contact/team pages) collect: the website URL, social profile URLs the site itself links to, and facts for a neutral 2-3 sentence bio in the third person (who they are, what they do, where). Prefer the entity's own site; a reputable third party is acceptable when it states the fact plainly.
3. If the profile allows a photo or logo, choose a direct image URL from the official site (an [image: ...] entry in the page text) and give the page it came from as the credit.
4. Call propose once per slot you can support. Only slots listed as allowed in the input. If a value is already filled and you have nothing better, skip it.
5. Call finish with 'done' if the website and bio were found, else 'incomplete', and a two-sentence summary naming what could not be confirmed.

Rules: no guessing, no inferring a bio from the name alone, no stale or archived pages for the website slot, quote exactly (copy the words). Stop after at most 25 tool calls.`

export function createEnrichAgent(opts: EnrichOptions, state: Collected, allowed: EnrichSlot[]): AgentDefinition<EnrichInput & { name: string; current: Record<string, unknown> }> {
  const fetchPage = opts.fetch ?? fetchWithReceipt
  return {
    id: 'enrich@1',
    description: 'Finds the official website, socials, a neutral bio and an image with credit for one record.',
    instructions: INSTRUCTIONS,
    model: 'research',
    limits: { maxSteps: 30, maxCostUsd: 1.5 },
    prompt: (input) =>
      `Entity: ${input.name}\nCollection: ${input.targetCollection}\nAllowed slots: ${allowed.join(', ')}\nCurrent values: ${JSON.stringify(input.current)}`,
    tools: () => ({
      web_search: opts.search ?? webSearchTool(),
      fetch_page: tool({
        description: 'Fetch a public page and read its text, with a receipt. Pass `find` to get only the passages around a word or phrase.',
        inputSchema: z.object({ url: z.url(), find: z.string().max(80).optional() }),
        execute: async ({ url, find }) => {
          const page = await fetchPage(url, { signal: opts.signal } as FetchOptions)
          state.pages.set(url, { receipt: page.receipt, text: page.text })
          state.pages.set(page.receipt.url, { receipt: page.receipt, text: page.text })
          const body = find ? passagesAround(page.text, find) : page.text.slice(0, MAX_PAGE_CHARS)
          return {
            url: page.receipt.url,
            title: page.receipt.title,
            ...(page.archived ? { note: `Live page failed (${page.archived.liveError}); this is the Internet Archive copy. Do not use it for the website slot.` } : {}),
            text: body,
          }
        },
      }),
      propose: tool({
        description:
          'Propose a value for one slot, with the page it came from and the exact words on that page that support it. For website, the quote may be the URL itself or the site title. For social, pass every profile you found at once.',
        inputSchema: z.object({
          slot: z.enum(['website', 'bio', 'image', 'social']),
          value: z.union([
            z.string().min(1),
            z.object({ url: z.url(), credit: z.string().min(2).max(200) }),
            z.array(z.object({ platform: z.string().min(1).max(40), url: z.url() })).min(1),
          ]),
          sourceUrl: z.url(),
          quote: z.string().min(3).max(600).describe('Verbatim words from the fetched page that support the value'),
          note: z.string().max(200).optional(),
        }),
        execute: async ({ slot, value, sourceUrl, quote, note }) => {
          if (!allowed.includes(slot)) return { error: `slot ${slot} is not allowed for this record` }
          const page = state.pages.get(sourceUrl)
          if (!page) return { error: 'fetch the source page first; receipts only come from pages you read' }
          const excerpt =
            excerptFor(page.text, quote) ??
            // The website slot is self-evident on the site itself: accept its title or URL as the excerpt.
            (slot === 'website' && typeof value === 'string' && sourceUrl.startsWith(value.replace(/\/$/, '')) ? (page.receipt.title ?? page.text.slice(0, 200)) : null)
          if (!excerpt) return { error: 'the quote does not appear on that page; copy the exact words' }
          const path = `${slot}` // mapped to the real field path after the run
          state.patch[path] = {
            value: slot === 'image' && typeof value === 'object' && !Array.isArray(value) ? { sourceUrl: value.url, credit: value.credit } : value,
            receipts: [{ ...page.receipt, excerpt }],
            ...(note ? { note } : {}),
          }
          return { ok: true, slot }
        },
      }),
      finish: tool({
        description: 'End the research with a result and a short summary for the editor.',
        inputSchema: z.object({ result: z.enum(['done', 'incomplete']), summary: z.string().min(10).max(800) }),
        execute: async ({ result, summary }) => {
          state.outcome = result
          state.summary = summary
          return { ok: true }
        },
      }),
    }),
  }
}

export type EnrichResult = {
  runId: string | number
  proposalId: string | number | null
  proposed: string[]
  dropped: Record<string, string>
  costUsd: number | null
}

export async function runEnrich(payload: AgentPayload, input: EnrichInput, opts: EnrichOptions = {}): Promise<EnrichResult> {
  const target = await payload.findByID({ collection: input.targetCollection, id: input.targetId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!target) throw new Error(`${input.targetCollection}/${input.targetId} not found`)
  const name = nameOf(target)
  const collection = payload.config.collections.find((c) => c.slug === input.targetCollection)
  const fieldMap = resolveFieldMap(collection?.fields ?? [], opts.fieldMap)
  const allowed = (Object.keys(fieldMap) as EnrichSlot[]).filter((slot) => fieldMap[slot])

  const run = opts.runId !== undefined ? { id: opts.runId } : await startRun(payload, { kind: 'enrich@1', title: `Enrich: ${name}`, targetCollection: input.targetCollection, targetId: input.targetId, input, triggeredBy: opts.triggeredBy, model: opts.model })
  if (!(await claimRun(payload, run.id))) throw new Error(`run ${run.id} is held by another worker or exhausted`)

  const ctx: RunContext = {
    payload,
    run: run.id,
    target: { collection: input.targetCollection, id: input.targetId },
    log: (step) => updateRun(payload, run.id, { step }),
    model: opts.model,
    signal: opts.signal,
  }
  const state: Collected = { pages: new Map(), patch: {}, summary: '', outcome: 'incomplete' }
  const runner = opts.runner ?? aiSdkRunner()
  let costUsd: number | null = null
  try {
    await updateRun(payload, run.id, { stage: 'Researching', now: `Looking for ${name}'s official website` })
    const current: Record<string, unknown> = {}
    for (const slot of allowed) current[slot] = target[fieldMap[slot] as string] ?? null
    const result = await runner.run(createEnrichAgent(opts, state, allowed), { ...input, name, current }, ctx)
    costUsd = result.costUsd
    await updateRun(payload, run.id, { stage: 'Verifying', now: 'Checking every value against its source', model: result.model })

    // Slot keys become the client's real field paths before verification and the contract check.
    const patch: Patch = {}
    for (const [slot, field] of Object.entries(state.patch)) {
      const path = fieldMap[slot as EnrichSlot]
      if (path) patch[path] = field
    }
    const textFor = (r: Receipt) => state.pages.get(r.url)?.text ?? ''
    const everyReceiptPresent: Check = (field) => {
      for (const r of field.receipts ?? []) {
        const verdict = excerptPresent(r, textFor(r))
        if (!verdict.ok) return verdict
      }
      return { ok: true }
    }
    const checks: Record<string, Check[]> = { '*': [everyReceiptPresent] }
    if (fieldMap.bio) {
      checks[fieldMap.bio] = [
        (f) => lengthWithin(f.value, { min: 40, max: 700 }),
        async (f) => {
          const verdict = await claimsSupported({ bio: String(f.value), receipts: f.receipts ?? [], judge: opts.judge })
          if (verdict.costUsd) costUsd = (costUsd ?? 0) + verdict.costUsd
          return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason }
        },
      ]
    }
    if (fieldMap.website) checks[fieldMap.website] = [(f) => (opts.urlAlive ?? urlAlive)(String(f.value))]
    const verified = await runVerifiers(patch, checks)

    const droppedByVerifier = Object.fromEntries(Object.entries(verified.dropped).map(([path, f]) => [path, f.note.replace(/^Dropped: /, '')]))
    const summary = [state.summary, result.finished ? null : 'The agent hit its step or cost limit before finishing.'].filter(Boolean).join(' ')
    const proposal = await createProposal(payload, {
      targetCollection: input.targetCollection,
      targetId: input.targetId,
      target,
      kind: 'enrich',
      title: `Enrich: ${name}`,
      patch: verified.patch,
      summary: [summary, Object.keys(droppedByVerifier).length ? `Failed verification: ${Object.entries(droppedByVerifier).map(([p, r]) => `${p}: ${r}`).join('; ')}.` : null].filter(Boolean).join('\n\n'),
      runId: run.id,
      agent: 'enrich@1',
    })
    const dropped = { ...droppedByVerifier, ...proposal.dropped }
    await finishRun(payload, run.id, { proposal: proposal.id, costUsd, summary: proposal.id ? `Proposed ${Object.keys(proposal.proposed).length} field(s)` : 'Nothing to propose' })
    return { runId: run.id, proposalId: proposal.id, proposed: Object.keys(proposal.proposed), dropped, costUsd }
  } catch (err) {
    await failRun(payload, run.id, err, { costUsd })
    throw err
  }
}
