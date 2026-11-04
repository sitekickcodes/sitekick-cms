import { Fragment, type ComponentType } from 'react'

import type { BlockSlug, LayoutBlock } from '../types'
import { CardGrid } from './blocks/card-grid'
import { CallToAction } from './blocks/cta'
import { Faq } from './blocks/faq'
import { Hero } from './blocks/hero'
import { ImageText } from './blocks/image-text'
import { Quote } from './blocks/quote'
import { TextSection } from './blocks/rich-text'
import { Stats } from './blocks/stats'

type BlockOf<Slug extends BlockSlug> = Extract<LayoutBlock, { blockType: Slug }>

/** One renderer per slug, typed to its block. Apps override entries via `components`. */
export type BlockComponents = { [Slug in BlockSlug]: ComponentType<{ block: BlockOf<Slug> }> }

export const blockComponents: BlockComponents = {
  hero: Hero,
  richText: TextSection,
  imageText: ImageText,
  stats: Stats,
  quote: Quote,
  cardGrid: CardGrid,
  faq: Faq,
  cta: CallToAction,
}

/**
 * blockType → component. A switch rather than a lookup so the mapping is
 * total: a block without a case is a TS error on `blockType`, not a hole in
 * the page.
 */
function BlockComponent({ block, components }: { block: LayoutBlock; components?: Partial<BlockComponents> }) {
  const c = { ...blockComponents, ...components }
  switch (block.blockType) {
    case 'hero':
      return <c.hero block={block} />
    case 'richText':
      return <c.richText block={block} />
    case 'imageText':
      return <c.imageText block={block} />
    case 'stats':
      return <c.stats block={block} />
    case 'quote':
      return <c.quote block={block} />
    case 'cardGrid':
      return <c.cardGrid block={block} />
    case 'faq':
      return <c.faq block={block} />
    case 'cta':
      return <c.cta block={block} />
  }
}

export function RenderBlocks({
  blocks,
  components,
  anchors,
}: {
  blocks: LayoutBlock[] | null | undefined
  /** Swap a renderer per slug, e.g. a hero that uses `next/image`. */
  components?: Partial<BlockComponents>
  /** An empty `#section-<n>` anchor before each section (n from 1), so a preview can open at a given one. */
  anchors?: boolean
}) {
  if (!blocks?.length) return null
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={block.id ?? index}>
          {anchors ? <div id={`section-${index + 1}`} aria-hidden="true" style={{ scrollMarginTop: '3rem' }} /> : null}
          <BlockComponent block={block} components={components} />
        </Fragment>
      ))}
    </>
  )
}
