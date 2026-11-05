import { cms, isDraft } from '@/lib/cms'

export const metadata = { title: 'News' }

export default async function NewsPage() {
  const payload = await cms()
  const draft = await isDraft()
  // The Local API returns drafts too; outside a preview the site lists published posts only.
  const { docs } = await payload.find({ collection: 'posts', sort: '-publishedAt', limit: 50, draft, ...(draft ? {} : { where: { _status: { equals: 'published' } } }) })
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
