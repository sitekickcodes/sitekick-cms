import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Hand-written mirrors of the block schemas. The app's generated
 * `payload-types.ts` is not available to this package, so renderers are typed
 * against these instead. Keep them in step with `src/blocks/*` when a field
 * changes; the unit tests check slugs, not shapes.
 */

export type DocID = number | string

/** The fields a renderer needs from a `media` upload doc. */
export type MediaDoc = {
  id: DocID
  url?: null | string
  width?: null | number
  height?: null | number
  alt?: null | string
  mimeType?: null | string
}

/** The fields a renderer needs from a `pages` doc to build an href. */
export type PageRef = {
  id: DocID
  slug?: null | string
  title?: null | string
}

/** Upload and relationship fields arrive as an id (depth 0) or the populated doc. */
export type Upload = DocID | MediaDoc | null | undefined

export type RichTextData = SerializedEditorState

/** One link: a page on this site, or a URL. */
export type Link = {
  id?: null | string
  label: string
  type?: 'page' | 'url' | null
  page?: DocID | PageRef | null
  href?: null | string
  newTab?: boolean | null
}

export type ButtonLink = Link & { style?: 'primary' | 'secondary' | null }

export type Surface = 'light' | 'soft' | 'dark' | 'accent'

export type CardIcon =
  | 'sparkles'
  | 'star'
  | 'heart'
  | 'check'
  | 'zap'
  | 'shield'
  | 'globe'
  | 'mail'
  | 'phone'
  | 'map-pin'
  | 'calendar'
  | 'users'
  | 'book-open'
  | 'lightbulb'
  | 'megaphone'
  | 'arrow-right'

type Base<Slug extends string> = {
  id?: null | string
  blockName?: null | string
  blockType: Slug
}

export type HeroBlock = Base<'hero'> & {
  eyebrow?: null | string
  heading: string
  subheading?: null | string
  buttons?: ButtonLink[] | null
  image?: Upload
  surface?: 'light' | 'accent' | 'dark' | null
  alignment?: 'center' | 'left' | null
}

export type RichTextBlock = Base<'richText'> & {
  content: RichTextData
  width?: 'narrow' | 'contained' | null
}

export type ImageTextBlock = Base<'imageText'> & {
  image?: Upload
  eyebrow?: null | string
  heading?: null | string
  content?: RichTextData | null
  link?: Link[] | null
  imagePosition?: 'right' | 'left' | null
  surface?: 'light' | 'soft' | null
}

export type StatItem = { id?: null | string; value: string; label: string }

export type StatsBlock = Base<'stats'> & {
  eyebrow?: null | string
  heading?: null | string
  items?: StatItem[] | null
  surface?: 'light' | 'soft' | 'dark' | null
}

export type QuoteBlock = Base<'quote'> & {
  quote: string
  attribution?: null | string
  role?: null | string
}

export type Card = {
  id?: null | string
  title: string
  image?: Upload
  icon?: CardIcon | null
  text?: null | string
  link?: Link[] | null
}

export type CardGridBlock = Base<'cardGrid'> & {
  eyebrow?: null | string
  heading?: null | string
  cards?: Card[] | null
  columns?: 'two' | 'three' | 'four' | null
  surface?: 'light' | 'soft' | null
}

export type FaqItem = { id?: null | string; question: string; answer: RichTextData }

export type FaqBlock = Base<'faq'> & {
  eyebrow?: null | string
  heading?: null | string
  items?: FaqItem[] | null
}

export type CtaBlock = Base<'cta'> & {
  heading: string
  body?: null | string
  buttons?: ButtonLink[] | null
  surface?: 'dark' | 'accent' | null
}

export type LayoutBlock =
  | HeroBlock
  | RichTextBlock
  | ImageTextBlock
  | StatsBlock
  | QuoteBlock
  | CardGridBlock
  | FaqBlock
  | CtaBlock

export type BlockSlug = LayoutBlock['blockType']

/** Every block slug, in picker order. The schema list and renderer map are checked against this. */
export const blockSlugs = ['hero', 'richText', 'imageText', 'stats', 'quote', 'cardGrid', 'faq', 'cta'] as const satisfies readonly BlockSlug[]
