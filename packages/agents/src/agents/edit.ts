import { tool } from 'ai'
import { z } from 'zod'

import { applySectionPlan, describeBlocks, rowToModel } from '../blocks'
import type { BlockConfig, BlockRow, KnownIds, SectionPlan } from '../blocks'
import type { AgentPayload, Doc } from '../payload'
import { agentContractFor, createProposal } from '../proposals'
import { syntheticReceipt } from '../receipts'
import { aiSdkRunner } from '../runner'
import type { AgentDefinition, RunContext, Runner } from '../runner'
import { claimRun, failRun, finishRun, startRun, updateRun } from '../runs'

/**
 * Edit with words (D9): "add a FAQ about parking below the hero, three
 * questions". The agent reads the page's sections and the block catalogue,
 * then proposes the sections in their new order: keep one as it is, edit
 * some of its fields, or add a new one. The plan is applied and validated
 * against the real block schemas; problems go back to the agent to fix.
 * The proposal is the whole blocks field, reviewed per section with a
 * preview of the proposed page.
 */
export type EditInput = {
  targetCollection: string
  targetId: string | number
  instruction: string
}

export type EditOptions = {
  runner?: Runner
  runId?: string | number
  triggeredBy?: string | number
  model?: string
  signal?: AbortSignal
  /** The blocks field to edit. Default: the collection's first writable blocks field. */
  field?: string
}

type BlocksField = Record<string, unknown> & { type: 'blocks'; name: string; blocks: BlockConfig[] }

/** The first top-level blocks field the contract lets agents write. */
export function blocksFieldOf(collection: { fields: Array<Record<string, unknown>> }, writable: string[], name?: string): BlocksField | null {
  const walk = (fields: Array<Record<string, unknown>>): BlocksField[] =>
    fields.flatMap((f) => {
      if (f.type === 'blocks' && typeof f.name === 'string') return [f as BlocksField]
      if (f.type === 'row' || f.type === 'collapsible') return walk((f.fields as Array<Record<string, unknown>>) ?? [])
      // Unnamed tabs only: a named tab nests the data under its name.
      if (f.type === 'tabs') return ((f.tabs as Array<{ name?: string; fields?: Array<Record<string, unknown>> }>) ?? []).filter((t) => !t.name).flatMap((t) => walk(t.fields ?? []))
      return []
    })
  return walk(collection.fields).find((f) => (name ? f.name === name : writable.includes(f.name))) ?? null
}

const step = z.union([
  z.object({ keep: z.number().int().describe('Index of a current section, kept exactly as it is') }),
  z.object({
    edit: z.number().int().describe('Index of a current section to change'),
    set: z.record(z.string(), z.unknown()).describe('Only the fields that change, with their new values; lists replace the whole list'),
  }),
  z.object({ add: z.record(z.string(), z.unknown()).describe('A new section: { blockType, ...fields }') }),
])

const proposeInput = z.object({
  sections: z.array(step).describe('Every section of the page in its new order. Leave a section out to remove it.'),
  summary: z.string().min(3).max(400).describe('One or two plain sentences for the editor: what changed and why'),
})

const INSTRUCTIONS = `You edit one page of a website by changing its sections, for a content editor who described the change in their own words.

You get the page's current sections (numbered from 0, with their content) and the catalogue of section types with their fields. Call propose_sections once with every section of the page in its new order:
- {"keep": n} for a section that stays as it is (this is the default; keep everything the editor did not ask to change),
- {"edit": n, "set": {...}} to change some fields of section n (only the fields that change),
- {"add": {"blockType": "...", ...fields}} for a new section.
Leave a section out only when the editor asked to remove it.

Writing: match the tone and length of the page's existing copy. Plain, specific, no filler or hype. Never invent facts (names, numbers, dates, prices, addresses, quotes); when the editor asks for content you cannot know, write it so it is obviously a placeholder in square brackets, e.g. "[Opening hours]". Rich text fields take Markdown. Links to pages on this site use ids from the page list; images use ids from search_media, or are left out.

If propose_sections reports problems, fix them and call it again.`

export type EditState = { plan: SectionPlan | null; summary: string; layout: BlockRow[] | null }

export function createEditAgent(
  opts: EditOptions,
  state: EditState,
  page: { doc: Doc; field: BlocksField; current: BlockRow[]; known: KnownIds; pages: Doc[] },
  payload: AgentPayload,
): AgentDefinition<EditInput> {
  const sections = page.current.map((row, i) => `[${i}] ${JSON.stringify(rowToModel(page.field.blocks, row))}`).join('\n')
  const pageList = page.pages.map((p) => `- id ${String(p.id)}: ${String(p.title ?? p.slug ?? p.id)}${typeof p.slug === 'string' ? ` (/${p.slug === 'home' ? '' : p.slug})` : ''}`).join('\n')
  const mediaSlugs = [...new Set(page.field.blocks.flatMap((b) => uploadsOf(b.fields)))]
  return {
    id: 'edit@1',
    description: 'Changes a page\'s sections from an instruction in plain words.',
    instructions: INSTRUCTIONS,
    model: 'research',
    limits: { maxSteps: 8, maxCostUsd: 1 },
    finishTools: ['propose_sections'],
    prompt: (input) =>
      [
        `The editor asks: ${input.instruction}`,
        `Page: ${String(page.doc.title ?? page.doc.id)}${typeof page.doc.intro === 'string' && page.doc.intro ? `\nIntro: ${page.doc.intro}` : ''}`,
        `Current sections (${page.field.name}):\n${sections || '(none yet)'}`,
        `Section types:\n${describeBlocks(page.field.blocks)}`,
        pageList ? `Pages on this site:\n${pageList}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    tools: () => ({
      ...(mediaSlugs.length
        ? {
            search_media: tool({
              description: 'Find images in the media library by words in their alt text or file name.',
              inputSchema: z.object({ query: z.string().min(1).max(80) }),
              execute: async ({ query }) => {
                const found = []
                for (const slug of mediaSlugs) {
                  const { docs } = await payload.find({
                    collection: slug,
                    where: { or: [{ alt: { like: query } }, { filename: { like: query } }] },
                    limit: 8,
                    depth: 0,
                    overrideAccess: true,
                  })
                  for (const d of docs) {
                    ;(page.known[slug] ??= new Set()).add(String(d.id))
                    found.push({ id: d.id, collection: slug, alt: d.alt ?? null, filename: d.filename ?? null })
                  }
                }
                return found.length ? found : { none: `No images match "${query}". Leave the image out.` }
              },
            }),
          }
        : {}),
      propose_sections: tool({
        description: 'Propose the page\'s sections in their new order. Returns problems to fix, or ok.',
        inputSchema: proposeInput,
        execute: async ({ sections, summary }) => {
          const applied = await applySectionPlan({ plan: sections as SectionPlan, current: page.current, blocksField: page.field, known: page.known, payload })
          if (applied.problems.length) return { ok: false, retry: true, problems: applied.problems.slice(0, 20) }
          state.plan = sections as SectionPlan
          state.summary = summary
          state.layout = applied.changed ? applied.layout : null
          return { ok: true }
        },
      }),
    }),
  }
}

function uploadsOf(fields: Array<Record<string, unknown>>): string[] {
  return fields.flatMap((f) =>
    f.type === 'upload' && typeof f.relationTo === 'string'
      ? [f.relationTo]
      : Array.isArray(f.fields)
        ? uploadsOf(f.fields as Array<Record<string, unknown>>)
        : f.type === 'tabs' && Array.isArray(f.tabs)
          ? (f.tabs as Array<{ fields?: Array<Record<string, unknown>> }>).flatMap((t) => uploadsOf(t.fields ?? []))
          : [],
  )
}

/** Ids already on the page, which the agent may keep pointing at. */
function collectIds(fields: Array<Record<string, unknown>>, data: unknown, known: KnownIds): void {
  if (!data || typeof data !== 'object') return
  for (const f of fields) {
    const value = (data as Record<string, unknown>)[String(f.name)]
    if ((f.type === 'upload' || f.type === 'relationship') && typeof f.relationTo === 'string') {
      for (const v of Array.isArray(value) ? value : [value]) {
        const id = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
        if (typeof id === 'string' || typeof id === 'number') (known[f.relationTo] ??= new Set()).add(String(id))
      }
    } else if (f.type === 'array' && Array.isArray(value)) for (const row of value) collectIds((f.fields as Array<Record<string, unknown>>) ?? [], row, known)
    else if (Array.isArray(f.fields)) collectIds(f.fields as Array<Record<string, unknown>>, f.name ? value : data, known)
    else if (f.type === 'tabs' && Array.isArray(f.tabs)) for (const t of f.tabs as Array<{ name?: string; fields?: Array<Record<string, unknown>> }>) collectIds(t.fields ?? [], t.name ? (data as Record<string, unknown>)[t.name] : data, known)
  }
}

export type EditResult = { runId: string | number; proposalId: string | number | null; dropped: Record<string, string>; costUsd: number | null }

export async function runEdit(payload: AgentPayload, input: EditInput, opts: EditOptions = {}): Promise<EditResult> {
  const instruction = input.instruction.trim()
  if (!instruction) throw new Error('Tell the agent what to change')
  const collection = payload.config.collections.find((c) => c.slug === input.targetCollection)
  if (!collection) throw new Error(`collection ${input.targetCollection} not found`)
  const contract = agentContractFor(payload, input.targetCollection)
  const field = blocksFieldOf(collection, contract?.writable ?? [], opts.field)
  if (!field) throw new Error(`${input.targetCollection} has no sections field agents may write`)
  const drafts = Boolean((collection as { versions?: { drafts?: unknown } }).versions?.drafts)

  const run =
    opts.runId !== undefined
      ? { id: opts.runId }
      : await startRun(payload, { kind: 'edit@1', title: `Edit: ${instruction.slice(0, 60)}`, targetCollection: input.targetCollection, targetId: input.targetId, input, triggeredBy: opts.triggeredBy, model: opts.model })
  if (!(await claimRun(payload, run.id))) throw new Error(`run ${run.id} is held by another worker or exhausted`)

  const ctx: RunContext = { payload, run: run.id, target: { collection: input.targetCollection, id: input.targetId }, log: (s) => updateRun(payload, run.id, { step: s }), model: opts.model, signal: opts.signal }
  const state: EditState = { plan: null, summary: '', layout: null }
  let costUsd: number | null = null
  try {
    await updateRun(payload, run.id, { stage: 'Reading the page', now: 'Reading the page' })
    // The latest draft: the editor's unpublished work is what they are looking at.
    const doc = await payload.findByID({ collection: input.targetCollection, id: input.targetId, depth: 0, draft: drafts, overrideAccess: true, disableErrors: true })
    if (!doc) throw new Error(`${input.targetCollection}/${input.targetId} not found`)
    const current = (Array.isArray(doc[field.name]) ? doc[field.name] : []) as BlockRow[]

    const known: KnownIds = {}
    for (const b of field.blocks) for (const row of current.filter((r) => r.blockType === b.slug)) collectIds(b.fields, row, known)
    // Link targets: the site's pages, so "link the button to Contact" resolves.
    const linkSlugs = [...new Set(field.blocks.flatMap((b) => relationsOf(b.fields)))]
    const pages: Doc[] = []
    for (const slug of linkSlugs) {
      const { docs } = await payload.find({ collection: slug, limit: 100, depth: 0, overrideAccess: true })
      for (const d of docs) (known[slug] ??= new Set()).add(String(d.id))
      pages.push(...docs)
    }

    await updateRun(payload, run.id, { stage: 'Editing', now: 'Working out the change' })
    const result = await (opts.runner ?? aiSdkRunner()).run(createEditAgent(opts, state, { doc, field, current, known, pages }, payload), { ...input, instruction }, ctx)
    costUsd = result.costUsd
    if (!state.plan) throw new Error('The agent ended without a valid set of sections')
    if (!state.layout) {
      await finishRun(payload, run.id, { costUsd, summary: state.summary || 'Nothing to change' })
      return { runId: run.id, proposalId: null, dropped: {}, costUsd }
    }

    await updateRun(payload, run.id, { stage: 'Proposing', now: 'Writing the proposal', model: result.model })
    const proposal = await createProposal(payload, {
      targetCollection: input.targetCollection,
      targetId: input.targetId,
      kind: 'edit',
      title: `Edit: ${instruction.length > 70 ? `${instruction.slice(0, 69)}…` : instruction}`,
      patch: { [field.name]: { value: state.layout, receipts: [syntheticReceipt('editor', instruction)], note: state.summary } },
      summary: state.summary,
      runId: run.id,
      agent: 'edit@1',
      target: doc,
    })
    const dropped = proposal.dropped
    await finishRun(payload, run.id, { proposal: proposal.id, costUsd, summary: proposal.id ? state.summary : 'Nothing to propose' })
    return { runId: run.id, proposalId: proposal.id, dropped, costUsd }
  } catch (err) {
    await failRun(payload, run.id, err, { costUsd })
    throw err
  }
}

function relationsOf(fields: Array<Record<string, unknown>>): string[] {
  return fields.flatMap((f) =>
    f.type === 'relationship' && typeof f.relationTo === 'string'
      ? [f.relationTo]
      : Array.isArray(f.fields)
        ? relationsOf(f.fields as Array<Record<string, unknown>>)
        : [],
  )
}
