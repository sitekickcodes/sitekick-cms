import { cms, isDraft } from '@/lib/cms'

export const metadata = { title: 'News' }

export default async function NewsPage() {
  const payload = await cms()
  const draft = await isDraft()
  const { docs } = await payload.find({ collection: 'posts', sort: '-publishedAt', limit: 50, draft })
  return (
    <section className="prose">
      <h1>News</h1>
      {docs.length === 0 ? <p>Nothing published yet.</p> : (
        <ul>
          {docs.map((p) => (
            <li key={p.id}>
              <a href={`/news/${p.slug}`}>{p.title}</a>
              {p.excerpt ? <p>{p.excerpt}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
