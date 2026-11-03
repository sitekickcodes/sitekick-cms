import { notFound } from 'next/navigation'

import { PageView } from '@/components/page-view'
import { findPage } from '@/lib/pages'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await findPage(slug)
  if (!page) notFound()
  return <PageView page={page} />
}
