import { recordMissing } from '@sitekick/cms'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { cms } from './cms'

/**
 * `notFound()` that also notes the address for Admin › Missing pages (redirects recipe), so
 * an editor can send the next visitor somewhere useful. Call it where a route finds nothing.
 * (Not from not-found.tsx: Next renders that boundary alongside every page, found or not.)
 */
export async function pageNotFound(path: string): Promise<never> {
  const h = await headers()
  await recordMissing(await cms(), { path, referrer: h.get('referer') })
  notFound()
}
