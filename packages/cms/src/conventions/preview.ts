import type { CollectionConfig, LivePreviewConfig, Plugin } from 'payload'

import type { SiteIdentity, SitekickCMSOptions } from '../types'

/**
 * The edit view's "Preview" button and the Live Preview panel: a link out to
 * the record's page on the site ("why don't we have the little link buttons
 * that link out to the actual site/pages?").
 *
 * Draft-mode route convention: the site serves `/api/draft?secret=&url=`,
 * which checks the secret, turns Next.js draft mode on for that browser and
 * redirects to `url`, so unpublished changes show. The secret is read from
 * `SITEKICK_PREVIEW_SECRET` (or `PREVIEW_SECRET`). Without one, the button
 * links straight to the live page.
 *
 * Paths are resolved against `site.url`; without it they stay relative to
 * the admin's origin (fine when the site and the admin share one).
 */
type PreviewFn = NonNullable<NonNullable<CollectionConfig['admin']>['preview']>
type LivePreviewUrl = NonNullable<LivePreviewConfig['url']>
type Doc = Record<string, unknown>
type PathOf = (doc: Doc) => string | null | Promise<string | null>

export const DRAFT_ROUTE = '/api/draft'

const previewSecret = () => process.env.SITEKICK_PREVIEW_SECRET ?? process.env.PREVIEW_SECRET ?? ''

/** The URL the Preview button opens for a public path: through draft mode when a secret is set, else the page itself. */
export function previewUrlFor(path: string, site?: Pick<SiteIdentity, 'url'>): string {
  const base = site?.url?.replace(/\/+$/, '') ?? ''
  const secret = previewSecret()
  if (!secret) return `${base}${path}`
  return `${base}${DRAFT_ROUTE}?secret=${encodeURIComponent(secret)}&url=${encodeURIComponent(path)}`
}

/** A Preview button from the doc's public path; no button while there is no path yet. */
export const sitePreview =
  (pathOf: PathOf, site?: Pick<SiteIdentity, 'url'>): PreviewFn =>
  async (doc) => {
    const path = await pathOf(doc as Doc)
    return path ? previewUrlFor(path, site) : null
  }

/** `${prefix}/${doc.slug}`, or no button while there's no slug yet. */
export const slugPreview = (prefix: string, site?: Pick<SiteIdentity, 'url'>): PreviewFn =>
  sitePreview((doc) => (typeof doc.slug === 'string' && doc.slug ? `${prefix.replace(/\/+$/, '')}/${doc.slug}` : null), site)

/** The Live Preview panel beside the form: the same page; it refreshes on every save. */
export const slugLivePreview =
  (prefix: string, site?: Pick<SiteIdentity, 'url'>): LivePreviewUrl =>
  async ({ data }) => {
    const slug = typeof data?.slug === 'string' ? data.slug : ''
    return slug ? previewUrlFor(`${prefix.replace(/\/+$/, '')}/${slug}`, site) : ''
  }

/**
 * Preview buttons for every collection that declares where it lives
 * (`custom.sitekick.seo.pathPrefix`) and has a slug, unless it already has
 * `admin.preview`. Live preview follows when the collection has drafts.
 */
export const previewConvention =
  (options: SitekickCMSOptions): Plugin =>
  (config) => {
    for (const collection of config.collections ?? []) {
      const seo = collection.custom?.sitekick?.seo as false | { pathPrefix?: string } | undefined
      const prefix = seo && typeof seo === 'object' ? seo.pathPrefix : undefined
      if (!prefix) continue
      const admin = (collection.admin ??= {})
      if (!admin.preview) admin.preview = slugPreview(prefix, options.site)
      const drafts = Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts)
      if (drafts && !admin.livePreview?.url) admin.livePreview = { ...admin.livePreview, url: slugLivePreview(prefix, options.site) }
    }
    return config
  }
