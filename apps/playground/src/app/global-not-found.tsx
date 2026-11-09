import { recordMissing } from '@sitekick/cms'
import { PATH_HEADER } from '@sitekick/cms/redirects'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { NotFoundView } from '@/components/not-found-view'
import { cms } from '@/lib/cms'
import './(frontend)/globals.css'

export const metadata: Metadata = { title: 'Page not found' }

/**
 * An address no route matches (`/old/blog/2019/post`). The app has two root layouts (site and
 * admin), so this stands alone: Next renders it without either, and only for a miss, so it's
 * also where the address is noted for Admin › Missing pages. The proxy passes the address in
 * a header (src/proxy.ts); this page has no other way to know it.
 */
export default async function GlobalNotFound() {
  const h = await headers()
  const path = h.get(PATH_HEADER)
  if (path) await recordMissing(await cms(), { path, referrer: h.get('referer') })
  return (
    <html lang="en">
      <body className="flex min-h-svh flex-col bg-sk-bg text-sk-fg">
        <main className="flex-1">
          <NotFoundView />
        </main>
      </body>
    </html>
  )
}
