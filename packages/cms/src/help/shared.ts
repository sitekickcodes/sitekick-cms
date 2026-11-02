import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/** The default `help-articles` collection slug. */
export const HELP_SLUG = 'help-articles'

/** Topics an article can file under. Clients override via `helpPlugin` options. */
export const DEFAULT_HELP_TOPICS = ['Getting started', 'Content', 'Media', 'Account'] as const

/** The query parameters a shared link carries: `/admin?help=<slug>&helpPreview=<id>`. */
export const HELP_PARAM = 'help'
export const HELP_PREVIEW_PARAM = 'helpPreview'

/** Preference key for the dashboard welcome card; stable, account-scoped. */
export const HELP_WELCOME_PREFERENCE = 'sitekick-dashboard-welcome-dismissed'

/**
 * Reader data: published content only. The article `id` is its slug, so
 * CMS document IDs stay server-side and links survive re-imports.
 */
export type HelpArticle = {
  id: string
  title: string
  topic: string
  summary: string
  body: SerializedEditorState
  related: string[]
  aliases: string[]
}

/** The plain text of a Lexical tree, for search. */
export function helpText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: unknown; children?: unknown[]; root?: unknown }
  return [
    typeof node.text === 'string' ? node.text : '',
    ...(node.children ?? []).map(helpText),
    node.root ? helpText(node.root) : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Finds an article by slug or one of its previous slugs. */
export function findArticle(articles: HelpArticle[], id: string | undefined): HelpArticle | undefined {
  return articles.find((article) => article.id === id || article.aliases.includes(id ?? ''))
}

/** Every-word match over title, summary, topic and body; title hits rank first. */
export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matches = articles.filter((article) => {
    const text = [article.title, article.summary, article.topic, helpText(article.body)].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const score = (article: HelpArticle) =>
    words.reduce(
      (total, word) =>
        total + (article.title.toLowerCase().includes(word) ? 8 : 0) + (article.summary.toLowerCase().includes(word) ? 3 : 0),
      0,
    )
  return words.length ? matches.sort((a, b) => score(b) - score(a)) : matches
}
