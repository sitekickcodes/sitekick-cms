import type { QuoteBlock } from '../../types'
import { Band } from '../shared'

/** One pull quote, centred, with an oversized opening mark as the only ornament. */
export function Quote({ block }: { block: QuoteBlock }) {
  const who = [block.attribution, block.role].filter(Boolean)
  return (
    <Band block="quote" innerClassName="max-w-3xl">
      <figure className="flex flex-col items-center gap-6 text-center">
        <span aria-hidden className="font-display text-6xl leading-none text-sk-accent select-none">
          &ldquo;
        </span>
        <blockquote className="font-display text-2xl leading-snug tracking-tight text-balance sm:text-3xl">{block.quote}</blockquote>
        {who.length ? (
          <figcaption className="text-sm text-sk-muted">
            {block.attribution ? <span className="font-medium text-sk-fg">{block.attribution}</span> : null}
            {block.attribution && block.role ? <span aria-hidden> · </span> : null}
            {block.role}
          </figcaption>
        ) : null}
      </figure>
    </Band>
  )
}
