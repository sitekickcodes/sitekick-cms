import { RichText } from '@payloadcms/richtext-lexical/react'
import { notFound } from 'next/navigation'

import { cms, isDraft } from '@/lib/cms'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await cms()
  const draft = await isDraft()
  const { docs } = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, draft })
  const post = docs[0]
  if (!post) notFound()
  return (
    <article className="prose">
      <h1>{post.title}</h1>
      {post.excerpt ? <p className="lede">{post.excerpt}</p> : null}
      <RichText data={post.body} />
    </article>
  )
}
