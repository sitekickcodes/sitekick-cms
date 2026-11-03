import type { DefaultNodeTypes, SerializedLinkNode } from '@payloadcms/richtext-lexical'
import { LinkJSXConverter, RichText as LexicalRichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'

import { cn } from './cn'
import type { RichTextData } from '../types'

/**
 * Where an internal link goes. Pages live at `/<slug>` (home at `/`); any
 * other collection at `/<collection>/<slug>`. Apps with different routes pass
 * their own `internalDocToHref`.
 */
export const defaultInternalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const doc = linkNode.fields.doc
  if (!doc || typeof doc.value !== 'object') return '#'
  const slug = typeof doc.value.slug === 'string' ? doc.value.slug : ''
  if (doc.relationTo === 'pages') return slug && slug !== 'home' ? `/${slug}` : '/'
  return slug ? `/${doc.relationTo}/${slug}` : '#'
}

export type RichTextProps = {
  data: RichTextData | null | undefined
  className?: string
  internalDocToHref?: (args: { linkNode: SerializedLinkNode }) => string
}

/**
 * Payload's Lexical renderer with internal links resolved to site paths and
 * the `.sk-prose` rhythm applied (one typographic scale for every body,
 * defined once in styles.css).
 */
export function RichText({ data, className, internalDocToHref = defaultInternalDocToHref }: RichTextProps) {
  if (!data) return null
  const converters: JSXConvertersFunction<DefaultNodeTypes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkJSXConverter({ internalDocToHref }),
  })
  return <LexicalRichText<DefaultNodeTypes> data={data} converters={converters} className={cn('sk-prose', className)} />
}
