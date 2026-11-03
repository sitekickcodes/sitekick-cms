import type { ComponentProps } from 'react'

import { cn } from '../cn'

/** A white panel on a hairline, the surface every card in the grid shares. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-sk-line bg-sk-card text-sk-fg', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-1 flex-col gap-2 p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
}
