import { tool } from 'ai'
import { z } from 'zod'

import { flattenFields, pickField } from '../fields'
import { markdownToLexical } from '../lexical'
import type { AgentPayload } from '../payload'
import { createProposal } from '../proposals'
import { fetchWithReceipt, syntheticReceipt } from '../receipts'
import type { FetchOptions, FetchResult, Receipt } from '../receipts'
import { aiSdkRunner } from '../runner'
import type { AgentDefinition, RunContext, Runner } from '../runner'
import { claimRun, failRun, finishRun, startRun, updateRun } from '../runs'
import { lengthWithin, runVerifiers } from '../verifiers'
import type { Check, Patch } from '../verifiers'

/**
 * Draft: "write a post from these notes / this URL / this transcript". The
 * output is always a proposal with no target id: accepting it creates the
 * document. Sources become receipts (the fetched page; a synthetic receipt
 * for text the editor pasted) attached to every proposed field.
 */
export type DraftInput = {
  targetCollection: string
  notes?: string
  url?: string
  transcript?: string
  title?: string
}

export type DraftFieldMap = Partial<Record<'title' | 'excerpt' | 'body' | 'metaTitle' | 'metaDescription', string>>

export function resolveDraftFieldMap(fields: Array<Record<string, unknown>>, overrides: DraftFieldMap = {}): DraftFieldMap {
  const flat = flattenFields(fields)
  return {
    title: overrides.title ?? pickField(flat, /^(title|name|headline)$/i, ['text']),
    excerpt: overrides.excerpt ?? pickField(flat, /^(excerpt|summary|description|intro|lede)$/i, ['textarea', 'text']),
    body: overrides.body ?? pickField(flat, /^(content|body|richText|text|article)$/i, ['richText']),
    metaTitle: overrides.metaTitle ?? flat.find((f) => /^meta\.title$/i.test(f.path))?.path,
    metaDescription: overrides.metaDescription ?? flat.find((f) => /^meta\.description$/i.test(f.path))?.path,
  }
}

const output = z.object({
  title: z.string().min(3).max(120),
  excerpt: z.string().min(20).max(160),
  bodyMarkdown: z.string().min(100).describe('The article in Markdown: headings (##), paragraphs, lists, links to the source where a fact came from'),
  metaTitle: z.string().min(3).max(60),
  metaDescription: z.string().min(20).max(160),
  coverSearchPhrase: z.string().min(3).max(80).describe('A phrase an editor can search a stock library for'),
})
export type DraftOutput = z.infer<typeof output>

type Collected = { output: DraftOutput | null; pages: Map<string, { receipt: Receipt; text: string }> }

const INSTRUCTIONS = `You draft a post for a content editor from the sources provided: notes, a transcript, or a web page (its text is in your input; you may fetch_page other URLs the editor named). Write in clear, plain English, in the site's neutral voice, for a general reader. Use only facts from the sources; where the sources are silent, leave it out rather than invent. Link to the source URL where a fact came from. Structure: a short opening paragraph, then 2-5 sections with ## headings, lists where they help. The excerpt is one or two sentences, at most 160 characters. The meta title is at most 60 characters, the meta description at most 160. Call finish exactly once with the whole draft.`

export type DraftOptions = {
  runner?: Runner
  runId?: string | number
  fieldMap?: DraftFieldMap
  triggeredBy?: string | number
  model?: string
  fetch?: (url: string, opts?: FetchOptions) => Promise<FetchResult>
  signal?: AbortSignal
}

export function createDraftAgent(opts: DraftOptions, state: Collected, sources: string): AgentDefinition<DraftInput> {
  const fetchPage = opts.fetch ?? fetchWithReceipt
  return {
    id: 'draft@1',
    description: 'Writes a post (title, excerpt, body, SEO) from notes, a URL or a transcript.',
    instructions: INSTRUCTIONS,
    model: 'research',
    limits: { maxSteps: 8, maxCostUsd: 1 },
    prompt: (input) => `Target collection: ${input.targetCollection}\n${input.title ? `Working title: ${input.title}\n` : ''}\nSources:\n${sources}`,
    tools: () => ({
      fetch_page: tool({
        description: 'Fetch another public page the editor referred to, with a receipt.',
        inputSchema: z.object({ url: z.url() }),
        execute: async ({ url }) => {
          const page = await fetchPage(url, { signal: opts.signal } as FetchOptions)
          state.pages.set(page.receipt.url, { receipt: page.receipt, text: page.text })
          return { url: page.receipt.url, title: page.receipt.title, text: page.text.slice(0, 14_000) }
        },
      }),
      finish: tool({
        description: 'Deliver the finished draft.',
        inputSchema: output,
        execute: async (draft) => {
          state.output = draft
          return { ok: true }
        },
      }),
    }),
  }
}

export type DraftResult = { runId: string | number; proposalId: string | number | null; dropped: Record<string, string>; costUsd: number | null }

export async function runDraft(payload: AgentPayload, input: DraftInput, opts: DraftOptions = {}): Promise<DraftResult> {
  if (!input.notes && !input.url && !input.transcript) throw new Error('Draft needs notes, a url or a transcript')
  const collection = payload.config.collections.find((c) => c.slug === input.targetCollection)
  if (!collection) throw new Error(`collection ${input.targetCollection} not found`)
  const fieldMap = resolveDraftFieldMap(collection.fields, opts.fieldMap)
  if (!fieldMap.title || !fieldMap.body) throw new Error(`${input.targetCollection} has no title/body fields to draft into`)

  const label = input.title ?? (input.url ? new URL(input.url).hostname : 'from notes')
  const run = opts.runId !== undefined ? { id: opts.runId } : await startRun(payload, { kind: 'draft@1', title: `Draft: ${label}`, targetCollection: input.targetCollection, input, triggeredBy: opts.triggeredBy, model: opts.model })
  if (!(await claimRun(payload, run.id))) throw new Error(`run ${run.id} is held by another worker or exhausted`)

  const ctx: RunContext = { payload, run: run.id, target: { collection: input.targetCollection }, log: (step) => updateRun(payload, run.id, { step }), model: opts.model, signal: opts.signal }
  const state: Collected = { output: null, pages: new Map() }
  let costUsd: number | null = null
  try {
    await updateRun(payload, run.id, { stage: 'Reading sources', now: input.url ? `Reading ${new URL(input.url).hostname}` : 'Reading the notes' })
    const receipts: Receipt[] = []
    const sources: string[] = []
    if (input.url) {
      const page = await (opts.fetch ?? fetchWithReceipt)(input.url, { signal: opts.signal } as FetchOptions)
      receipts.push(page.receipt)
      state.pages.set(page.receipt.url, { receipt: page.receipt, text: page.text })
      sources.push(`[Web page ${page.receipt.url}${page.receipt.title ? ` — ${page.receipt.title}` : ''}]\n${page.text.slice(0, 20_000)}`)
    }
    if (input.notes) {
      receipts.push(syntheticReceipt('notes', input.notes))
      sources.push(`[Editor's notes]\n${input.notes}`)
    }
    if (input.transcript) {
      receipts.push(syntheticReceipt('transcript', input.transcript))
      sources.push(`[Transcript]\n${input.transcript.slice(0, 40_000)}`)
    }

    await updateRun(payload, run.id, { stage: 'Writing', now: 'Writing the draft' })
    const result = await (opts.runner ?? aiSdkRunner()).run(createDraftAgent(opts, state, sources.join('\n\n')), input, ctx)
    costUsd = result.costUsd
    if (!state.output) throw new Error('The agent ended without delivering a draft')
    const draft = state.output

    // Receipts for a synthesis: the sources as a whole, not sentence-level quotes.
    const withReceipts = (value: unknown, note?: string) => ({ value, receipts, ...(note ? { note } : {}) })
    const patch: Patch = {
      [fieldMap.title]: withReceipts(draft.title),
      [fieldMap.body]: withReceipts(markdownToLexical(draft.bodyMarkdown), 'Converted from the agent\'s Markdown'),
      ...(fieldMap.excerpt ? { [fieldMap.excerpt]: withReceipts(draft.excerpt) } : {}),
      ...(fieldMap.metaTitle ? { [fieldMap.metaTitle]: withReceipts(draft.metaTitle) } : {}),
      ...(fieldMap.metaDescription ? { [fieldMap.metaDescription]: withReceipts(draft.metaDescription) } : {}),
    }
    const checks: Record<string, Check[]> = {
      [fieldMap.title]: [(f) => lengthWithin(f.value, { min: 3, max: 120 })],
      ...(fieldMap.excerpt ? { [fieldMap.excerpt]: [(f) => lengthWithin(f.value, { min: 20, max: 160 })] } : {}),
      ...(fieldMap.metaTitle ? { [fieldMap.metaTitle]: [(f) => lengthWithin(f.value, { max: 60 })] } : {}),
      ...(fieldMap.metaDescription ? { [fieldMap.metaDescription]: [(f) => lengthWithin(f.value, { max: 160 })] } : {}),
    }
    const verified = await runVerifiers(patch, checks)
    await updateRun(payload, run.id, { stage: 'Proposing', now: 'Writing the proposal', model: result.model })
    const proposal = await createProposal(payload, {
      targetCollection: input.targetCollection,
      kind: 'draft',
      title: `Draft: ${draft.title}`,
      patch: verified.patch,
      summary: `Suggested cover image search: "${draft.coverSearchPhrase}". Sources: ${receipts.map((r) => r.url).join(', ')}.`,
      runId: run.id,
      agent: 'draft@1',
    })
    const dropped = { ...Object.fromEntries(Object.entries(verified.dropped).map(([p, f]) => [p, f.note])), ...proposal.dropped }
    await finishRun(payload, run.id, { proposal: proposal.id, costUsd, summary: proposal.id ? `Drafted "${draft.title}"` : 'Nothing to propose' })
    return { runId: run.id, proposalId: proposal.id, dropped, costUsd }
  } catch (err) {
    await failRun(payload, run.id, err, { costUsd })
    throw err
  }
}
