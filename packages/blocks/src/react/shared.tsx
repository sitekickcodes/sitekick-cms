import type { ReactNode } from 'react'

import { cn } from './cn'
import type { ButtonLink, DocID, Link, MediaDoc, PageRef, Surface, Upload } from '../types'
import { Button } from './ui/button'

/**
 * Shared chrome for the block renderers: the band skeleton, surfaces, the
 * heading cluster, the CMS image and the link/button pair. Every block
 * composes these so the page reads as one system.
 */

/** Shared horizontal padding for every band; the inner column is max-w-6xl. */
export const PAD = 'px-5 sm:px-8 lg:px-12'

/** Surface select → token classes. No other colours exist in the blocks. */
export const SURFACE_CLASSES: Record<Surface, string> = {
  light: 'bg-sk-bg text-sk-fg',
  soft: 'bg-sk-soft text-sk-fg',
  dark: 'bg-sk-dark text-sk-dark-fg',
  accent: 'bg-sk-accent text-sk-accent-fg',
}

/** True for the two surfaces that need light-on-dark buttons and text. */
export const isDark = (surface: Surface): boolean => surface === 'dark' || surface === 'accent'

export const surfaceOf = (value: null | string | undefined): Surface =>
  value === 'soft' || value === 'dark' || value === 'accent' ? value : 'light'

/** The standard band: padding + surface, with a centred inner column. */
export function Band({
  block,
  surface = 'light',
  className,
  innerClassName,
  children,
}: {
  /** The block slug, exposed as `data-block` for styling and tests. */
  block: string
  surface?: Surface
  className?: string
  innerClassName?: string
  children: ReactNode
}) {
  return (
    <section data-block={block} className={cn(PAD, 'py-16 sm:py-20', SURFACE_CLASSES[surface], className)}>
      <div className={cn('mx-auto max-w-6xl', innerClassName)}>{children}</div>
    </section>
  )
}

/** Eyebrow + heading, the cluster every designed section opens with. */
export function SectionHeading({
  eyebrow,
  heading,
  surface = 'light',
  center = false,
  className,
}: {
  eyebrow?: null | string
  heading?: null | string
  surface?: Surface
  center?: boolean
  className?: string
}) {
  if (!eyebrow && !heading) return null
  return (
    <div className={cn('flex max-w-2xl flex-col gap-3', center && 'mx-auto items-center text-center', className)}>
      {eyebrow ? <Eyebrow surface={surface}>{eyebrow}</Eyebrow> : null}
      {heading ? <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{heading}</h2> : null}
    </div>
  )
}

export function Eyebrow({ surface = 'light', children }: { surface?: Surface; children: ReactNode }) {
  return (
    <p className={cn('text-xs font-semibold tracking-[0.14em] uppercase', isDark(surface) ? 'opacity-80' : 'text-sk-accent')}>
      {children}
    </p>
  )
}

/** Upload fields resolve to an id or a doc; only a populated doc is renderable. */
export const asMedia = (value: Upload): MediaDoc | null => (typeof value === 'object' && value !== null ? value : null)

/**
 * A CMS upload as a plain `<img>` with intrinsic size, so the browser
 * reserves space before it loads. No `next/image`: the package must not
 * depend on a framework. Apps can swap in their own via `RenderBlocks`
 * component overrides.
 */
export function MediaImg({
  media,
  className,
  sizes,
  preload = false,
}: {
  media: Upload
  className?: string
  sizes?: string
  preload?: boolean
}) {
  const doc = asMedia(media)
  if (!doc?.url) return null
  return (
    <img
      src={doc.url}
      alt={doc.alt ?? ''}
      width={doc.width ?? undefined}
      height={doc.height ?? undefined}
      sizes={sizes}
      loading={preload ? 'eager' : 'lazy'}
      fetchPriority={preload ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  )
}

const asPage = (value: DocID | PageRef | null | undefined): PageRef | null =>
  typeof value === 'object' && value !== null ? value : null

/** A page's path on the site. `home` is the root, as the playground frontend renders it. */
export const pagePath = (page: PageRef): string => (page.slug && page.slug !== 'home' ? `/${page.slug}` : '/')

/**
 * The href for a link field. An unpopulated page (depth 0) can't be resolved
 * and falls back to `#` rather than throwing in a render.
 */
export const hrefOf = (link: Link): string => {
  if (link.type === 'url') return link.href?.trim() || '#'
  const page = asPage(link.page)
  return page ? pagePath(page) : link.href?.trim() || '#'
}

/** The anchor attributes for a link; new-tab links get the safe rel. */
export const linkAttrs = (link: Link): { href: string; target?: '_blank'; rel?: string } => {
  const href = hrefOf(link)
  return link.newTab ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href }
}

const buttonVariant = (style: ButtonLink['style'], surface: Surface) => {
  const primary = style !== 'secondary'
  if (isDark(surface)) return primary ? ('light' as const) : ('outline-light' as const)
  return primary ? ('primary' as const) : ('secondary' as const)
}

/** One block button, toned for its surface. */
export function BlockButton({
  link,
  surface = 'light',
  size = 'default',
  className,
}: {
  link: ButtonLink
  surface?: Surface
  size?: 'default' | 'lg'
  className?: string
}) {
  return (
    <Button variant={buttonVariant(link.style, surface)} size={size} className={className} {...linkAttrs(link)}>
      {link.label}
    </Button>
  )
}

/** A wrapping row of block buttons; null when the list is empty. */
export function BlockButtons({
  links,
  surface = 'light',
  size = 'default',
  center = false,
}: {
  links?: ButtonLink[] | null
  surface?: Surface
  size?: 'default' | 'lg'
  center?: boolean
}) {
  if (!links?.length) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-3', center && 'justify-center')}>
      {links.map((link, index) => (
        <BlockButton key={link.id ?? index} link={link} surface={surface} size={size} />
      ))}
    </div>
  )
}
