/**
 * A small Markdown to Lexical (Payload richtext) converter for agent output:
 * headings, paragraphs, bold, italic, inline code, links, bullet and numbered
 * lists, block quotes. Anything else is kept as paragraph text, never dropped.
 * Node shapes follow @payloadcms/richtext-lexical's serialised format so a
 * proposal's body can be accepted straight into a richText field.
 */
export type LexicalText = { type: 'text'; text: string; format: number; detail: 0; mode: 'normal'; style: ''; version: 1 }
export type LexicalLink = {
  type: 'link'
  fields: { url: string; newTab: boolean; linkType: 'custom' }
  children: LexicalInline[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 3
}
export type LexicalInline = LexicalText | LexicalLink
type Block = { direction: 'ltr'; format: ''; indent: 0; version: 1 }
export type LexicalParagraph = Block & { type: 'paragraph'; children: LexicalInline[]; textFormat: 0; textStyle: '' }
export type LexicalHeading = Block & { type: 'heading'; tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; children: LexicalInline[] }
export type LexicalQuote = Block & { type: 'quote'; children: LexicalInline[] }
export type LexicalListItem = Block & { type: 'listitem'; value: number; children: LexicalInline[] }
export type LexicalList = Block & { type: 'list'; listType: 'bullet' | 'number'; start: 1; tag: 'ul' | 'ol'; children: LexicalListItem[] }
export type LexicalBlock = LexicalParagraph | LexicalHeading | LexicalQuote | LexicalList
export type LexicalRoot = { root: Block & { type: 'root'; children: LexicalBlock[] } }

export const FORMAT = { bold: 1, italic: 2, code: 16 } as const

const block = { direction: 'ltr', format: '', indent: 0, version: 1 } as const

const text = (value: string, format = 0): LexicalText => ({ type: 'text', text: value, format, detail: 0, mode: 'normal', style: '', version: 1 })

/**
 * Inline parsing by a single regex pass over the markers we support. Nested
 * emphasis inside links works because the link body is parsed recursively;
 * emphasis around a link is not (rare in agent output, and the text survives).
 */
const INLINE = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_)/g

export function parseInline(src: string, inherited = 0): LexicalInline[] {
  const out: LexicalInline[] = []
  let last = 0
  for (const m of src.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text(src.slice(last, at), inherited))
    const [, , both, bold, bold2, code, linkText, href, italic, italic2] = m
    if (both !== undefined) out.push(...parseInline(both, inherited | FORMAT.bold | FORMAT.italic))
    else if (bold !== undefined || bold2 !== undefined) out.push(...parseInline((bold ?? bold2) as string, inherited | FORMAT.bold))
    else if (code !== undefined) out.push(text(code, inherited | FORMAT.code))
    else if (linkText !== undefined && href !== undefined) {
      out.push({ type: 'link', fields: { url: href, newTab: false, linkType: 'custom' }, children: parseInline(linkText, inherited), direction: 'ltr', format: '', indent: 0, version: 3 })
    } else if (italic !== undefined || italic2 !== undefined) out.push(...parseInline((italic ?? italic2) as string, inherited | FORMAT.italic))
    last = at + m[0].length
  }
  if (last < src.length) out.push(text(src.slice(last), inherited))
  return out.length ? out : [text('', inherited)]
}

const paragraph = (children: LexicalInline[]): LexicalParagraph => ({ ...block, type: 'paragraph', children, textFormat: 0, textStyle: '' })

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^(-{3,}|\*{3,}|_{3,})\s*$/

export function markdownToLexical(markdown: string): LexicalRoot {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const children: LexicalBlock[] = []
  let i = 0
  const flushParagraph = (buffer: string[]) => {
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim()
    if (joined) children.push(paragraph(parseInline(joined)))
  }
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (!line.trim() || RULE.test(line)) {
      i++
      continue
    }
    const heading = line.match(HEADING)
    if (heading) {
      const level = Math.min(6, (heading[1] ?? '#').length) as 1 | 2 | 3 | 4 | 5 | 6
      children.push({ ...block, type: 'heading', tag: `h${level}`, children: parseInline((heading[2] ?? '').trim()) })
      i++
      continue
    }
    if (QUOTE.test(line)) {
      const buffer: string[] = []
      while (i < lines.length && QUOTE.test(lines[i] ?? '')) {
        buffer.push((lines[i] ?? '').match(QUOTE)?.[1] ?? '')
        i++
      }
      children.push({ ...block, type: 'quote', children: parseInline(buffer.join(' ').trim()) })
      continue
    }
    const listKind = BULLET.test(line) ? 'bullet' : NUMBERED.test(line) ? 'number' : null
    if (listKind) {
      const pattern = listKind === 'bullet' ? BULLET : NUMBERED
      const items: LexicalListItem[] = []
      while (i < lines.length && pattern.test(lines[i] ?? '')) {
        const body = (lines[i] ?? '').match(pattern)?.[1] ?? ''
        items.push({ ...block, type: 'listitem', value: items.length + 1, children: parseInline(body.trim()) })
        i++
      }
      children.push({ ...block, type: 'list', listType: listKind, start: 1, tag: listKind === 'bullet' ? 'ul' : 'ol', children: items })
      continue
    }
    const buffer: string[] = []
    while (i < lines.length) {
      const current = lines[i] ?? ''
      if (!current.trim() || HEADING.test(current) || QUOTE.test(current) || BULLET.test(current) || NUMBERED.test(current) || RULE.test(current)) break
      buffer.push(current)
      i++
    }
    flushParagraph(buffer)
  }
  return { root: { ...block, type: 'root', children } }
}

/** Plain text of a Lexical tree, for SEO and judge prompts. */
export function lexicalToText(value: unknown): string {
  const walk = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (n.type === 'text') return n.text ?? ''
    const inner = (n.children ?? []).map(walk).join('')
    return n.type && n.type !== 'root' && n.type !== 'link' ? `${inner}\n` : inner
  }
  const root = (value as { root?: unknown } | null)?.root
  return walk(root).replace(/\n{2,}/g, '\n').trim()
}
