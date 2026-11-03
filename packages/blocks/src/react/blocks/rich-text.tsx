import { cn } from '../cn'
import type { RichTextBlock } from '../../types'
import { RichText } from '../rich-text'
import { Band } from '../shared'

/** The plain text section: reading width by default, or the full column. */
export function TextSection({ block }: { block: RichTextBlock }) {
  const narrow = (block.width ?? 'narrow') === 'narrow'
  return (
    <Band block="richText" className="py-12 sm:py-16">
      <RichText data={block.content} className={cn(narrow ? 'max-w-2xl' : 'max-w-4xl')} />
    </Band>
  )
}
