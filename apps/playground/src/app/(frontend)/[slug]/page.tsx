import { RichText } from '@payloadcms/richtext-lexical/react'
import { notFound } from 'next/navigation'

import { cms, isDraft } from '@/lib/cms'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await cms()
  const draft = await isDraft()
  const { docs } = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1, draft })
  const page = docs[0]
  if (!page) notFound()
  return (
    <article className="prose">
      <h1>{page.title}</h1>
      {page.intro ? <p className="lede">{page.intro}</p> : null}
      {page.body ? <RichText data={page.body} /> : null}
    </article>
  )
}
