import type { CollectionSlug } from 'payload'
import type { Payload } from 'payload'

import type { ResolvedContract } from '../agent/contract'
import type { PublicSite } from './catalog'

/** Markdown representations of public entries, plus Accept negotiation helpers for the app. */

/** Explicit text/markdown opt-in: honours q=0 and an HTML preference. */
export const prefersMarkdown = (accept: string | null): boolean => {
  const ranges = (accept ?? '')
    .toLowerCase()
    .split(',')
    .map((part) => {
      const [type = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const quality = q ? Number(q.slice(2)) : 1
      return { type: type.trim(), q: Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0 }
    })
  const md = Math.max(0, ...ranges.filter((r) => r.type === 'text/markdown').map((r) => r.q))
  const html = Math.max(0, ...ranges.filter((r) => r.type === 'text/html').map((r) => r.q))
  return md > 0 && md >= html
}

export const markdownResponse = (body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      // A negotiated representation must not be shared by CDN caches that ignore Accept.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })

type LexicalNode = {
  type?: string
  text?: string
  format?: number | string
  tag?: string
  listType?: string
  url?: string
  fields?: { url?: string }
  children?: LexicalNode[]
}
export type LexicalState = { root?: LexicalNode }

const BOLD = 1
const ITALIC = 2
const CODE = 16

const inline = (nodes: LexicalNode[] = []): string =>
  nodes
    .map((node) => {
      if (node.type === 'linebreak') return '\n'
      if (node.type === 'text') {
        let text = node.text ?? ''
        const format = typeof node.format === 'number' ? node.format : 0
        if (format & CODE) text = `\`${text}\``
        if (format & BOLD) text = `**${text}**`
        if (format & ITALIC) text = `_${text}_`
        return text
      }
      if (node.type === 'link' || node.type === 'autolink') {
        const href = node.fields?.url ?? node.url ?? ''
        return href ? `[${inline(node.children)}](${href})` : inline(node.children)
      }
      return inline(node.children)
    })
    .join('')

const block = (node: LexicalNode): string => {
  switch (node.type) {
    case 'heading': {
      const level = Number((node.tag ?? 'h2').replace(/\D/g, '')) || 2
      return `${'#'.repeat(Math.min(6, level))} ${inline(node.children)}`
    }
    case 'list': {
      const ordered = node.listType === 'number'
      return (node.children ?? []).map((item, i) => `${ordered ? `${i + 1}.` : '-'} ${inline(item.children)}`).join('\n')
    }
    case 'quote':
      return inline(node.children)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'horizontalrule':
      return '---'
    case 'paragraph':
      return inline(node.children)
    default:
      return node.children ? (node.children.map(block).filter(Boolean).join('\n\n')) : inline([node])
  }
}

/** Dependency-free Lexical → Markdown for the common nodes; unknown nodes contribute their text. */
export const lexicalToMarkdown = (state: unknown): string => {
  const root = (state as LexicalState | null | undefined)?.root
  if (!root?.children) return ''
  return root.children.map(block).filter((s) => s.trim()).join('\n\n')
}

type EditorConfig = { editorConfig?: unknown }

/**
 * `@payloadcms/richtext-lexical`'s converter when the field's editor config is
 * at hand (it needs the feature list to render blocks and uploads), else the
 * built-in fallback.
 */
export const richTextToMarkdown = async (state: unknown, editor?: EditorConfig): Promise<string> => {
  if (editor?.editorConfig) {
    try {
      const lexical = await import('@payloadcms/richtext-lexical')
      return lexical.convertLexicalToMarkdown({
        data: state as Parameters<typeof lexical.convertLexicalToMarkdown>[0]['data'],
        editorConfig: editor.editorConfig as Parameters<typeof lexical.convertLexicalToMarkdown>[0]['editorConfig'],
      })
    } catch {
      // Fall through: the plain converter never throws.
    }
  }
  return lexicalToMarkdown(state)
}

const SKIP = new Set(['slug', 'meta', '_status', 'id', 'createdAt', 'updatedAt', 'publishedAt'])
const SCALARS = new Set(['text', 'textarea', 'number', 'checkbox', 'email', 'date', 'select', 'radio', 'code'])

const humanise = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export type DocToMarkdownOptions = {
  site?: PublicSite
  /** Editor config per rich text field, for the full converter. */
  editors?: Record<string, EditorConfig>
}

/** Title, excerpt, source URL, then each contract field: scalars as a list, rich text as sections. */
export const docToMarkdown = async (doc: Record<string, unknown>, contract: ResolvedContract, options: DocToMarkdownOptions = {}): Promise<string> => {
  const titleField = contract.titleField ?? 'title'
  const title = typeof doc[titleField] === 'string' ? (doc[titleField] as string) : contract.label
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  const excerptField = contract.fields.find((f) => f.type === 'textarea')?.name
  const meta = (typeof doc.meta === 'object' && doc.meta !== null ? doc.meta : {}) as { description?: unknown }
  const excerpt = (excerptField && typeof doc[excerptField] === 'string' && (doc[excerptField] as string)) || (typeof meta.description === 'string' ? meta.description : '')
  const parts: string[] = [`# ${title}`]
  if (excerpt) parts.push(`> ${excerpt}`)
  const facts: string[] = []
  if (options.site && slug) facts.push(`- Source: ${options.site.url}${contract.pathPrefix.replace(/\/$/, '')}/${encodeURIComponent(slug)}`)
  if (typeof doc.publishedAt === 'string') facts.push(`- Published: ${doc.publishedAt.slice(0, 10)}`)
  if (typeof doc.updatedAt === 'string') facts.push(`- Updated: ${doc.updatedAt.slice(0, 10)}`)
  const scalars: string[] = []
  const sections: string[] = []
  for (const field of contract.fields) {
    if (SKIP.has(field.name) || field.name === titleField || field.name === excerptField) continue
    const value = doc[field.name]
    if (value === undefined || value === null || value === '') continue
    if (field.type === 'richText') {
      const body = await richTextToMarkdown(value, options.editors?.[field.name])
      if (body) sections.push(`## ${humanise(field.name)}\n\n${body}`)
    } else if (SCALARS.has(field.type) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      scalars.push(`- ${humanise(field.name)}: ${String(value)}`)
    }
  }
  if (facts.length || scalars.length) parts.push([...facts, ...scalars].join('\n'))
  parts.push(...sections)
  return `${parts.join('\n\n')}\n`
}

/** Editor configs of a collection's rich text fields, read from the initialised Payload. */
export const richTextEditors = (payload: Payload, slug: string): Record<string, EditorConfig> => {
  const fields = payload.collections[slug as CollectionSlug]?.config.fields ?? []
  const editors: Record<string, EditorConfig> = {}
  for (const field of fields) {
    if (field.type === 'richText' && 'name' in field) {
      const editor = field.editor as EditorConfig | undefined
      if (editor?.editorConfig) editors[field.name] = editor
    }
  }
  return editors
}
