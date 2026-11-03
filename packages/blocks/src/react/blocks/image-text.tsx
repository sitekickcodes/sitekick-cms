import { cn } from '../cn'
import type { ImageTextBlock } from '../../types'
import { RichText } from '../rich-text'
import { Band, BlockButton, MediaImg, SectionHeading, asMedia, surfaceOf } from '../shared'

/** The two-column editorial row: photo one side, kicker + heading + prose the other. */
export function ImageText({ block }: { block: ImageTextBlock }) {
  const surface = surfaceOf(block.surface)
  const imageLeft = block.imagePosition === 'left'
  const link = block.link?.[0]
  const hasImage = Boolean(asMedia(block.image)?.url)
  return (
    <Band block="imageText" surface={surface}>
      <div className={cn('grid items-center gap-10', hasImage && 'lg:grid-cols-2 lg:gap-16')}>
        {hasImage ? (
          <div className={cn('relative aspect-[4/3] overflow-hidden rounded-2xl bg-sk-soft', !imageLeft && 'lg:order-2')}>
            <MediaImg
              media={block.image}
              sizes="(min-width: 1280px) 560px, (min-width: 1024px) 45vw, calc(100vw - 40px)"
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex max-w-xl flex-col gap-5">
          <SectionHeading eyebrow={block.eyebrow} heading={block.heading} surface={surface} />
          <RichText data={block.content} />
          {link ? (
            <div className="mt-2">
              <BlockButton link={{ ...link, style: 'secondary' }} surface={surface} />
            </div>
          ) : null}
        </div>
      </div>
    </Band>
  )
}
