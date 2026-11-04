import { notFound } from 'next/navigation'

import { PageView } from '@/components/page-view'
import { findPage } from '@/lib/pages'

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ proposal?: string; section?: string }> }) {
  const { slug } = await params
  const { proposal, section } = await searchParams
  const page = await findPage(slug, { proposal })
  if (!page) notFound()
  return <PageView page={page} section={Number(section) || undefined} />
}
