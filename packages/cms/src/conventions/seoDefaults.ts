/**
 * Search and sharing defaults, filled from the content. Shared by the SEO
 * convention's hooks and the admin's live form components, so it has no
 * server dependencies: plain functions over plain objects.
 */
type Doc = Record<string, unknown>
export type SEOValues = { title: string; description: string; image?: unknown }
export type SEOSite = { name: string; description?: string }

export const seoObject = (value: unknown): Doc => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Doc) : {})

/** Only visible text: HTML stripped, Lexical walked for its text nodes; no upload metadata, embeds or URLs. */
export function seoText(value: unknown): string {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
  function lexicalText(node: unknown): string {
    const n = seoObject(node)
    if (n.root) return lexicalText(n.root)
    if (n.type === 'text') return typeof n.text === 'string' ? n.text : ''
    if (n.type === 'linebreak') return ' '
    if (Array.isArray(n.children)) {
      return n.children.map(lexicalText).join(['paragraph', 'heading', 'link', 'autolink'].includes(String(n.type)) ? '' : ' ')
    }
    return ''
  }
  return lexicalText(value).replace(/\s+/g, ' ').trim()
}

/** Cut at a word boundary, with an ellipsis. */
export function seoSnippet(value: string, max = 150): string {
  const text = seoText(value)
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const boundary = cut.lastIndexOf(' ')
  return `${cut.slice(0, boundary > max * 0.6 ? boundary : cut.length).trimEnd()}…`
}

const firstText = (...values: unknown[]): string => values.map(seoText).find(Boolean) ?? ''

/** Read only the usual public prose slots, never arbitrary document properties. */
export function contentDescription(value: unknown): string {
  const doc = seoObject(value)
  const layout = Array.isArray(doc.layout) ? doc.layout.map(seoObject) : []
  const hero = layout.find((block) => block.blockType === 'hero')
  return firstText(
    doc.excerpt,
    doc.summary,
    doc.tagline,
    doc.intro,
    doc.description,
    doc.subtitle,
    hero?.subheading,
    doc.body,
    doc.content,
    ...layout.filter((block) => ['richText', 'imageText', 'content'].includes(String(block.blockType))).map((block) => block.content ?? block.body),
  )
}

/** The image slots a document is likely to have, in order of preference. */
export function contentImage(value: unknown): unknown {
  const doc = seoObject(value)
  const layout = Array.isArray(doc.layout) ? doc.layout.map(seoObject) : []
  const hero = layout.find((block) => block.blockType === 'hero')
  return doc.coverImage || doc.heroImage || doc.featuredImage || doc.image || doc.photo || hero?.image || undefined
}

/**
 * Title "<Page title> · <Site>" (trimmed to 60), description from the first
 * prose slot (trimmed to 150), image from the first image slot. The site's
 * own name and description stand in for a document with neither.
 */
export function seoDefaults(value: unknown, site: SEOSite): SEOValues {
  const doc = seoObject(value)
  const title = firstText(doc.title, doc.name) || site.name
  const description = contentDescription(doc) || site.description || (title !== site.name ? `${title} · ${site.name}` : site.name)
  return {
    title: title === site.name ? title : `${seoSnippet(title, 60 - ` · ${site.name}`.length)} · ${site.name}`,
    description: seoSnippet(description),
    image: contentImage(doc),
  }
}

const imageID = (image: unknown) => seoObject(image).id ?? image
const isBlank = (value: unknown) => value == null || (typeof value === 'string' && !value.trim())

function mergeContent(original: Doc, data: Doc): Doc {
  const merged = { ...original, ...data }
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && original[key]) {
      const incoming = seoObject(value)
      const previous = seoObject(original[key])
      // Relationship replacements must not inherit the old asset's URL or text.
      if (!incoming.id || incoming.id === previous.id) merged[key] = mergeContent(previous, incoming)
    }
  }
  return merged
}

/**
 * The meta group to save: blanks filled from the content, and a value that
 * still equals what the content used to produce follows the content; typed
 * overrides are kept. Works on partial API updates too.
 */
export function fillSEO(data: Doc, site: SEOSite, original?: Doc): Doc {
  const doc = mergeContent(original ?? {}, data)
  const defaults = seoDefaults(doc, site)
  const before = seoDefaults(original, site)
  const meta = { ...seoObject(original?.meta), ...seoObject(data.meta) }
  for (const key of ['title', 'description', 'image'] as const) {
    const current = key === 'image' ? imageID(meta[key]) : meta[key]
    const previous = key === 'image' ? imageID(before[key]) : before[key]
    if (isBlank(current) || (original && current === previous)) meta[key] = defaults[key] ?? null
  }
  return meta
}
