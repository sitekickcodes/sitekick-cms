import { cn } from '../cn'
import type { HeroBlock } from '../../types'
import { BlockButtons, Eyebrow, MediaImg, PAD, SURFACE_CLASSES, isDark, surfaceOf } from '../shared'

/** The top-of-page band. Rendered as `<header>` with the page's `<h1>`. */
export function Hero({ block }: { block: HeroBlock }) {
  const surface = surfaceOf(block.surface)
  const center = (block.alignment ?? 'center') === 'center'
  return (
    <header data-block="hero" className={cn(PAD, 'pt-16 pb-16 sm:pt-24 sm:pb-20', SURFACE_CLASSES[surface])}>
      <div className={cn('mx-auto flex max-w-6xl flex-col gap-6', center ? 'items-center text-center' : 'items-start')}>
        {block.eyebrow ? <Eyebrow surface={surface}>{block.eyebrow}</Eyebrow> : null}
        <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight whitespace-pre-line text-balance sm:text-5xl lg:text-6xl">
          {block.heading}
        </h1>
        {block.subheading ? (
          <p className={cn('max-w-2xl text-lg leading-relaxed sm:text-xl', isDark(surface) ? 'opacity-85' : 'text-sk-muted')}>
            {block.subheading}
          </p>
        ) : null}
        <BlockButtons links={block.buttons} surface={surface} size="lg" center={center} />
        <MediaImg
          media={block.image}
          preload
          sizes="(min-width: 1280px) 1152px, calc(100vw - 40px)"
          className="mt-6 w-full rounded-3xl object-cover"
        />
      </div>
    </header>
  )
}
