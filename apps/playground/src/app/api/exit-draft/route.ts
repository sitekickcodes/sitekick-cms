import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  ;(await draftMode()).disable()
  const url = req.nextUrl.searchParams.get('url') ?? '/'
  redirect(url.startsWith('/') && !url.startsWith('//') ? url : '/')
}
