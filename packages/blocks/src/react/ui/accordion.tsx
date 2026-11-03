'use client'

import { Accordion as Base } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../cn'

/**
 * Base UI accordion with the design applied: hairline rows, a real `<h3>`
 * + `<button aria-expanded>` per question, and a height transition that
 * `prefers-reduced-motion` turns off.
 */
export function Accordion({ className, ...props }: ComponentProps<typeof Base.Root>) {
  return <Base.Root className={cn('divide-y divide-sk-line border-y border-sk-line', className)} {...props} />
}

export function AccordionItem({ className, ...props }: ComponentProps<typeof Base.Item>) {
  return <Base.Item className={cn('group', className)} {...props} />
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof Base.Trigger>) {
  return (
    <Base.Header className="m-0">
      <Base.Trigger
        className={cn(
          'flex w-full cursor-pointer items-start justify-between gap-4 py-5 text-left text-lg font-medium tracking-tight text-sk-fg outline-none hover:text-sk-accent focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-sk-accent/35 motion-safe:transition-colors',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className="mt-1 size-5 shrink-0 text-sk-muted motion-safe:transition-transform group-data-[panel-open]:rotate-180"
        />
      </Base.Trigger>
    </Base.Header>
  )
}

export function AccordionPanel({ className, children, ...props }: ComponentProps<typeof Base.Panel> & { children: ReactNode }) {
  return (
    <Base.Panel
      className={cn(
        'h-(--accordion-panel-height) overflow-hidden motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out data-[ending-style]:h-0 data-[starting-style]:h-0',
        className,
      )}
      {...props}
    >
      <div className="pb-6 text-sk-muted">{children}</div>
    </Base.Panel>
  )
}
