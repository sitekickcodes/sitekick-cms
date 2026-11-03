import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../cn'

/**
 * The block button. Pill-shaped, four tones: two for light surfaces and two
 * for dark ones, so a secondary button never disappears into its band.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full border font-medium whitespace-nowrap select-none outline-none focus-visible:ring-[3px] focus-visible:ring-sk-accent/35 motion-safe:transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border-sk-fg bg-sk-fg text-sk-bg hover:border-sk-fg/85 hover:bg-sk-fg/85',
        secondary: 'border-sk-fg/25 bg-transparent text-sk-fg hover:border-sk-fg hover:bg-sk-fg/5',
        light: 'border-sk-bg bg-sk-bg text-sk-fg hover:border-sk-bg/85 hover:bg-sk-bg/85',
        'outline-light': 'border-sk-bg/40 bg-transparent text-sk-bg hover:border-sk-bg hover:bg-sk-bg/10',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

type Variants = VariantProps<typeof buttonVariants>

type AnchorProps = { href: string } & Omit<ComponentProps<'a'>, 'href'>
type NativeProps = { href?: undefined } & ComponentProps<'button'>

export type ButtonProps = Variants & { children: ReactNode; className?: string } & (AnchorProps | NativeProps)

/** Renders an `<a>` when `href` is set, otherwise a `<button>`. */
export function Button({ variant, size, className, children, ...rest }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (rest.href !== undefined) {
    const { href, ...anchor } = rest
    return (
      <a href={href} className={classes} {...anchor}>
        {children}
      </a>
    )
  }
  const { href: _unused, ...button } = rest
  return (
    <button type="button" className={classes} {...button}>
      {children}
    </button>
  )
}
