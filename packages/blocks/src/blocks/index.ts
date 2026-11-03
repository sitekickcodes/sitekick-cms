import type { Block, Field } from 'payload'

import type { EditorOptions } from '../lexical'
import { cardGrid } from './cardGrid'
import { cta } from './cta'
import { faq } from './faq'
import { hero } from './hero'
import { imageText } from './imageText'
import { quote } from './quote'
import { richText } from './richText'
import { stats } from './stats'

export { cardGrid, cardIcons } from './cardGrid'
export { cta } from './cta'
export { faq } from './faq'
export { hero } from './hero'
export { imageText } from './imageText'
export { quote } from './quote'
export { richText } from './richText'
export { stats } from './stats'

export type BlocksOptions = EditorOptions

/**
 * The block library, in picker order. Designed sections mirror the coded
 * pages' idioms; Basics inherit the page typography and offer no theming.
 * Slugs are options so a client with different collection names can reuse it.
 */
export const createBlocks = (options: BlocksOptions = {}): Block[] => [
  hero(options),
  richText(options),
  imageText(options),
  stats(),
  quote(),
  cardGrid(options),
  faq(options),
  cta(options),
]

export type LayoutFieldOptions = BlocksOptions & {
  /** Override the block list, e.g. `createBlocks()` plus a client block. */
  blocks?: Block[]
  description?: string
}

/**
 * The `layout` blocks field for a page. One guardrail beyond each block's own
 * validation: at most one hero, reorderable but never duplicated mid-page.
 */
export const layoutField = ({ blocks, description, ...options }: LayoutFieldOptions = {}): Field => ({
  name: 'layout',
  type: 'blocks',
  label: 'Sections',
  labels: { singular: 'Section', plural: 'Sections' },
  blocks: blocks ?? createBlocks(options),
  admin: {
    initCollapsed: true,
    description: description ?? 'The page, top to bottom. Drag to reorder.',
  },
  validate: (value: unknown) => validateLayout(value),
})

/** Exported for tests: a page can only have one hero. */
export const validateLayout = (value: unknown): string | true => {
  const rows = Array.isArray(value) ? (value as { blockType?: string }[]) : []
  const heroes = rows.filter((row) => row?.blockType === 'hero').length
  return heroes > 1 ? 'A page can only have one Hero.' : true
}
