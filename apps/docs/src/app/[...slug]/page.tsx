import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DocPage } from '../DocPage'
import { pageFor, PAGES } from '@/lib/docs'

export const dynamicParams = false

export function generateStaticParams() {
  return PAGES.filter((p) => p.slug).map((p) => ({ slug: p.slug.split('/') }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const page = pageFor((await params).slug.join('/'))
  return page ? { title: page.title, description: page.description } : {}
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const page = pageFor((await params).slug.join('/'))
  if (!page) notFound()
  return <DocPage page={page} />
}
