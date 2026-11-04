import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

/**
 * Preview link target: /api/draft?secret=<PAYLOAD_SECRET>&url=/news/foo.
 * Other parameters go on to the page: `proposal=<id>` (from the review view)
 * renders that proposal over the draft for a signed-in editor, `section=<n>`
 * opens at that section.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const secret = searchParams.get('secret')
  const url = searchParams.get('url') ?? '/'
  if (!secret || secret !== process.env.PAYLOAD_SECRET) return new Response('Invalid token', { status: 401 })
  if (!url.startsWith('/') || url.startsWith('//')) return new Response('Invalid url', { status: 400 })
  ;(await draftMode()).enable()
  const rest = new URLSearchParams(searchParams)
  rest.delete('secret')
  rest.delete('url')
  redirect(rest.size ? `${url}${url.includes('?') ? '&' : '?'}${rest}` : url)
}
