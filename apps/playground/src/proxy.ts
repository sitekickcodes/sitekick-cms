import { redirectsProxy } from '@sitekick/cms/redirects'
import type { NextFetchEvent, NextRequest } from 'next/server'

/**
 * Before any page renders: send visitors from old addresses to new ones (Admin › Redirects,
 * the redirects recipe). Pages only: not the admin, the API or files.
 */
// REDIRECTS_TTL_MS: how long this server keeps the table (default a minute; the admin suite uses less).
const redirects = redirectsProxy({ ttl: Number(process.env.REDIRECTS_TTL_MS) || undefined })

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return redirects(request, event)
}

export const config = {
  // Old .html and .php pages are exactly what a relaunch breaks, so only files are skipped.
  matcher: ['/((?!admin|api|_next|mcp|md/|llms\\.txt|openapi\\.json|\\.well-known|.*\\.(?:js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|txt|xml|json|webmanifest|mp4|pdf)$).*)'],
}
