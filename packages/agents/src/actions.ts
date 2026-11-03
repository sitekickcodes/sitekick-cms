import { generateText } from 'ai'
import type { ModelMessage } from 'ai'

import { lexicalToText } from './lexical'
import { costFromResult, resolveModel } from './model'
import type { AgentPayload } from './payload'
import { syntheticReceipt } from './receipts'

/**
 * Field actions: instant, inline, accept-in-place. Alt text, SEO, rewrite,
 * shorten, translate. No proposal to review (the editor is looking at the
 * field), but each call still lands in `proposals` as an accepted row from
 * agent `field-action`, so the audit trail is one table.
 */
export type GenerateArgs = { model: string; system?: string; providerOptions: { gateway: { models: string[] } } } & ({ prompt: string; messages?: undefined } | { messages: ModelMessage[]; prompt?: undefined })

export type GenerateLike = (args: GenerateArgs) => Promise<{ text: string; providerMetadata?: Record<string, Record<string, unknown> | undefined>; steps?: ReadonlyArray<{ providerMetadata?: Record<string, Record<string, unknown> | undefined> }> }>

export type ActionResult<V = string> = { value: V; costUsd: number | null; proposalId: string | number | null }

type Common = {
  payload?: AgentPayload
  model?: string
  generate?: GenerateLike
  /** Where the value is going, for the audit row. Omitted = logged under collection 'text'. */
  target?: { collection: string; id?: string | number; field: string }
}

const defaultGenerate: GenerateLike = (args) => generateText(args)

async function call(opts: Common, args: { system: string } & ({ prompt: string } | { messages: ModelMessage[] })) {
  const resolved = resolveModel({ purpose: 'actions', override: opts.model })
  const base = { model: resolved.model, providerOptions: resolved.providerOptions, system: args.system }
  const result = await (opts.generate ?? defaultGenerate)('prompt' in args ? { ...base, prompt: args.prompt } : { ...base, messages: args.messages })
  return { text: result.text.trim(), costUsd: costFromResult(result) }
}

/** Audit row with review: 'none' semantics: already accepted, decisions all accepted. */
export async function logFieldAction(payload: AgentPayload | undefined, action: string, target: Common['target'], values: Record<string, unknown>, source: string): Promise<string | number | null> {
  if (!payload) return null
  const patch = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, receipts: [syntheticReceipt('editor', source)], note: `field action: ${action}` }]))
  const doc = await payload.create({
    collection: 'proposals',
    data: {
      title: `${action}: ${target?.collection ?? 'text'}${target?.id !== undefined ? ` #${target.id}` : ''}`,
      kind: 'field-action',
      status: 'accepted',
      targetCollection: target?.collection ?? 'text',
      ...(target?.id !== undefined ? { targetId: String(target.id) } : {}),
      patch,
      decisions: Object.fromEntries(Object.keys(values).map((k) => [k, 'accepted'])),
      agent: 'field-action',
      reviewedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    context: { sitekickAgent: 'field-action' },
  })
  return doc.id
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`)

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export async function altText({
  payload,
  mediaId,
  collection = 'media',
  origin,
  fetchImpl = fetch,
  ...opts
}: Common & {
  payload: AgentPayload
  mediaId: string | number
  collection?: string
  /** Where relative media URLs resolve: the request's origin. Falls back to `serverURL`. */
  origin?: string
  fetchImpl?: typeof fetch
}): Promise<ActionResult> {
  const media = await payload.findByID({ collection, id: mediaId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!media) throw new Error(`${collection}/${mediaId} not found`)
  const rel = String(media.url ?? '')
  if (!rel) throw new Error('media has no url')
  const mimeType = String(media.mimeType ?? '')
  if (mimeType && !mimeType.startsWith('image/')) throw new Error('Only images can be described.')
  const url = /^https?:/.test(rel) ? rel : new URL(rel, origin ?? payload.config.serverURL ?? 'http://localhost:3000').toString()
  // Send the bytes, not the URL: providers differ on URL support and a dev or
  // access-controlled URL is not reachable from the model anyway.
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`The image could not be read (HTTP ${res.status}).`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('The image is too large to describe (over 8 MB).')
  const mediaType = (res.headers.get('content-type') ?? mimeType ?? 'image/jpeg').split(';')[0]!.trim()
  const { text, costUsd } = await call(opts, {
    system: 'Write alt text for screen-reader users: what the image shows, plainly, at most 125 characters, no "image of", no trailing period.',
    messages: [{ role: 'user', content: [{ type: 'text', text: `Filename: ${String(media.filename ?? '')}` }, { type: 'image', image: bytes, mediaType }] }],
  })
  const value = clip(text.replace(/^["']|["']$/g, ''), 125)
  const proposalId = await logFieldAction(payload, 'altText', { collection, id: mediaId, field: 'alt' }, { alt: value }, url)
  return { value, costUsd, proposalId }
}

export type SeoValue = { title: string; description: string }

export async function seo({ payload, collection, id, ...opts }: Common & { payload: AgentPayload; collection: string; id: string | number }): Promise<ActionResult<SeoValue>> {
  const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!doc) throw new Error(`${collection}/${id} not found`)
  const body = ['content', 'body', 'richText'].map((k) => doc[k]).find((v) => v && typeof v === 'object')
  const text = [doc.title, doc.excerpt ?? doc.summary ?? doc.description, body ? lexicalToText(body) : ''].filter(Boolean).join('\n\n').slice(0, 12_000)
  const { text: out, costUsd } = await call(opts, {
    system: 'Write SEO metadata for the page text. Reply with exactly two lines: "Title: <at most 60 characters>" then "Description: <at most 160 characters, one or two plain sentences>". No quotes, no markdown.',
    prompt: text,
  })
  const title = clip(out.match(/^Title:\s*(.+)$/im)?.[1]?.trim() ?? String(doc.title ?? ''), 60)
  const description = clip(out.match(/^Description:\s*(.+)$/im)?.[1]?.trim() ?? '', 160)
  const proposalId = await logFieldAction(payload, 'seo', { collection, id, field: 'meta' }, { 'meta.title': title, 'meta.description': description }, text.slice(0, 2000))
  return { value: { title, description }, costUsd, proposalId }
}

export async function rewrite({ text, instruction, ...opts }: Common & { text: string; instruction: string }): Promise<ActionResult> {
  const { text: value, costUsd } = await call(opts, {
    system: `Rewrite the text as instructed. Keep the meaning and facts; change nothing the instruction does not ask for. Reply with the rewritten text only. Instruction: ${instruction}`,
    prompt: text,
  })
  const proposalId = await logFieldAction(opts.payload, 'rewrite', opts.target, { [opts.target?.field ?? 'text']: value }, text)
  return { value, costUsd, proposalId }
}

export async function shorten({ text, maxChars, ...opts }: Common & { text: string; maxChars?: number }): Promise<ActionResult> {
  const limit = maxChars ?? Math.max(80, Math.round(text.length * 0.6))
  const { text: value, costUsd } = await call(opts, {
    system: `Shorten the text to at most ${limit} characters. Keep every fact and name; cut words, not meaning. Reply with the shortened text only.`,
    prompt: text,
  })
  const proposalId = await logFieldAction(opts.payload, 'shorten', opts.target, { [opts.target?.field ?? 'text']: value }, text)
  return { value: clip(value, limit), costUsd, proposalId }
}

export async function translate({ text, to, ...opts }: Common & { text: string; to: string }): Promise<ActionResult> {
  const { text: value, costUsd } = await call(opts, {
    system: `Translate the text into ${to}. Keep names, links and formatting; natural register for a website. Reply with the translation only.`,
    prompt: text,
  })
  const proposalId = await logFieldAction(opts.payload, 'translate', opts.target, { [opts.target?.field ?? 'text']: value }, text)
  return { value, costUsd, proposalId }
}
