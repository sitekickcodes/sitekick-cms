import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

/** Preview link target: /api/draft?secret=<PAYLOAD_SECRET>&url=/news/foo */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const secret = searchParams.get('secret')
  const url = searchParams.get('url') ?? '/'
  if (!secret || secret !== process.env.PAYLOAD_SECRET) return new Response('Invalid token', { status: 401 })
  if (!url.startsWith('/') || url.startsWith('//')) return new Response('Invalid url', { status: 400 })
  ;(await draftMode()).enable()
  redirect(url)
}
