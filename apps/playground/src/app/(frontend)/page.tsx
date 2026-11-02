import { cms, isDraft } from '@/lib/cms'

export default async function HomePage() {
  const payload = await cms()
  const draft = await isDraft()
  const { docs: posts } = await payload.find({ collection: 'posts', sort: '-publishedAt', limit: 5, draft })
  return (
    <section className="prose">
      <h1>Sitekick CMS playground</h1>
      <p>The demo client site used to build and test the plugin. Everything here is editable in the admin.</p>
      <h2>Latest news</h2>
      {posts.length === 0 ? <p>No posts yet.</p> : (
        <ul>
          {posts.map((p) => (
            <li key={p.id}><a href={`/news/${p.slug}`}>{p.title}</a></li>
          ))}
        </ul>
      )}
    </section>
  )
}
