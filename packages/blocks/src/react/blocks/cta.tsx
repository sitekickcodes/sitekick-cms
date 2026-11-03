import { cn } from '../cn'
import type { CtaBlock } from '../../types'
import { Band, BlockButtons } from '../shared'

/** The closing band: heading, a line of copy, one or two buttons. */
export function CallToAction({ block }: { block: CtaBlock }) {
  const surface = block.surface === 'accent' ? 'accent' : 'dark'
  return (
    <Band block="cta" surface={surface} innerClassName="flex flex-col items-center gap-6 text-center">
      <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">{block.heading}</h2>
      {block.body ? <p className={cn('max-w-2xl text-lg leading-relaxed opacity-85')}>{block.body}</p> : null}
      <BlockButtons links={(block.buttons ?? []).slice(0, 2)} surface={surface} size="lg" center />
    </Band>
  )
}
