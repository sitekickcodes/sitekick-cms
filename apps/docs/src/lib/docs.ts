import { readFileSync } from 'node:fs'
import path from 'node:path'

import { Marked, type Tokens } from 'marked'
import { createHighlighter, type Highlighter } from 'shiki'

import { PAGES, hrefOf, type Page } from './nav'

export { hrefOf, neighbours, pageFor, PAGES, SECTIONS, type Page } from './nav'

const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../..')
/** The file behind a page's `source`. */
const fileOf = (source: string) => (source.startsWith('repo/') ? path.join(/*turbopackIgnore: true*/ root, source.slice(5)) : path.join(/*turbopackIgnore: true*/ process.cwd(), source))

export type Heading = { id: string; text: string }
export type Rendered = { html: string; headings: Heading[] }

let highlighter: Promise<Highlighter> | null = null
const LANGS = ['ts', 'tsx', 'js', 'json', 'css', 'bash', 'sh', 'md', 'text']

/** A page's Markdown as HTML, with highlighted code and its section headings for the outline. */
export async function render(page: Page): Promise<Rendered> {
  const hl = await (highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS }))
  let markdown = readFileSync(fileOf(page.source), 'utf8')
  // A README starts with its own `# name`; the page header shows the title already.
  markdown = markdown.replace(/^# .*\n+/, '')
  const headings: Heading[] = []
  const used = new Map<string, number>()
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens)
        const plain = text.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, '')
        const base = plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
        const n = used.get(base) ?? 0
        used.set(base, n + 1)
        const id = n ? `${base}-${n}` : base
        if (depth === 2) headings.push({ id, text: plain })
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${text}</h${depth}>\n`
      },
      code({ text, lang }: Tokens.Code) {
        const language = lang && LANGS.includes(lang) ? lang : 'text'
        return hl.codeToHtml(text, { lang: language, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false })
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens)
        const external = /^https?:\/\//.test(href)
        return `<a href="${linkTarget(href, fileOf(page.source))}"${title ? ` title="${title}"` : ''}${external ? ' rel="noreferrer"' : ''}>${text}</a>`
      },
    },
  })
  // Wide reference tables scroll on their own instead of widening the page.
  const html = (await marked.parse(markdown)).replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, '</table></div>')
  return { html, headings }
}

const REPO = 'https://github.com/sitekickcodes/sitekick-cms/blob/main'

/**
 * A relative link in a page's Markdown, resolved from the file it was written in: another
 * docs page becomes its URL here; any other file in the repo links to it on GitHub.
 */
function linkTarget(href: string, source: string): string {
  if (/^(https?:|mailto:|#|\/)/.test(href)) return href
  const [file = '', hash = ''] = href.split('#')
  const target = path.resolve(path.dirname(source), file)
  const page = PAGES.find((p) => fileOf(p.source) === target)
  if (page) return `${hrefOf(page.slug)}${hash ? `#${hash}` : ''}`
  if (target.startsWith(root)) return `${REPO}/${path.relative(root, target)}${hash ? `#${hash}` : ''}`
  return href
}
