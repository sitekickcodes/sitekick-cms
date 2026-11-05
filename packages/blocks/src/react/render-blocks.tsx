import { Fragment, type ComponentType } from 'react'

import { blockSlugs, type BlockSlug, type LayoutBlock } from '../types'
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

/** A section the site adds itself (a site module's block): any `blockType` outside the library. */
export type CustomBlock = { blockType: string; id?: string | null; blockName?: string | null }

/** Renderers for a site's own sections, by `blockType`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each renderer types its own block
export type CustomBlockComponents = Record<string, ComponentType<{ block: any }>>

const builtin = new Set<string>(blockSlugs)

export function RenderBlocks({
  blocks,
  components,
  custom,
  anchors,
}: {
  blocks: ReadonlyArray<LayoutBlock | CustomBlock> | null | undefined
  /** Swap a renderer per slug, e.g. a hero that uses `next/image`. */
  components?: Partial<BlockComponents>
  /** Renderers for the site's own sections, e.g. `{ upcomingEvents: UpcomingEvents }`. */
  custom?: CustomBlockComponents
  /** An empty `#section-<n>` anchor before each section (n from 1), so a preview can open at a given one. */
  anchors?: boolean
}) {
  if (!blocks?.length) return null
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={block.id ?? index}>
          {anchors ? <div id={`section-${index + 1}`} aria-hidden="true" style={{ scrollMarginTop: '3rem' }} /> : null}
          {builtin.has(block.blockType) ? <BlockComponent block={block as LayoutBlock} components={components} /> : <Custom block={block} custom={custom} />}
        </Fragment>
      ))}
    </>
  )
}

function Custom({ block, custom }: { block: CustomBlock | LayoutBlock; custom?: CustomBlockComponents }) {
  const Component = custom?.[block.blockType]
  if (Component) return <Component block={block} />
  // A section with no renderer shows nothing on the live site, and says why while developing.
  if (process.env.NODE_ENV !== 'production') {
    return (
      <div role="note" style={{ margin: '1rem auto', maxWidth: '48rem', padding: '0.75rem 1rem', border: '1px dashed currentColor', borderRadius: 8, fontSize: 14, opacity: 0.7 }}>
        No renderer for the “{block.blockType}” section. Pass it to RenderBlocks: {'custom={{ '}
        {block.blockType}
        {': … }}'}.
      </div>
    )
  }
  return null
}
