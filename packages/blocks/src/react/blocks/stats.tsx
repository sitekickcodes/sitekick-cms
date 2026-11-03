import { cn } from '../cn'
import type { StatsBlock } from '../../types'
import { Band, SectionHeading, isDark, surfaceOf } from '../shared'

/** A row of headline numbers, divided by hairlines from tablet up. */
export function Stats({ block }: { block: StatsBlock }) {
  const surface = surfaceOf(block.surface)
  const dark = isDark(surface)
  return (
    <Band block="stats" surface={surface} innerClassName="flex flex-col gap-12">
      <SectionHeading eyebrow={block.eyebrow} heading={block.heading} surface={surface} />
      <dl className="flex flex-col gap-8 sm:flex-row">
        {(block.items ?? []).map((item, index) => (
          <div
            key={item.id ?? index}
            className={cn('flex flex-1 flex-col gap-2', index > 0 && 'sm:border-l sm:pl-8', dark ? 'border-sk-dark-fg/20' : 'border-sk-line')}
          >
            <dd className="order-1 font-display text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{item.value}</dd>
            <dt className={cn('order-2 text-base', dark ? 'opacity-80' : 'text-sk-muted')}>{item.label}</dt>
          </div>
        ))}
      </dl>
    </Band>
  )
}
