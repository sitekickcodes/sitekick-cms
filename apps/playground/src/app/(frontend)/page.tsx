import { PageView } from '@/components/page-view'
import { cms, isDraft } from '@/lib/cms'
import { findPage } from '@/lib/pages'

/** The `home` page when an editor has made one; a plain starter otherwise. */
export default async function HomePage() {
  const home = await findPage('home')
  if (home) return <PageView page={home} />

  const payload = await cms()
  const draft = await isDraft()
  const { docs: posts } = await payload.find({ collection: 'posts', sort: '-publishedAt', limit: 5, draft })
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Sitekick CMS playground</h1>
        <p className="text-lg text-sk-muted">
          The demo client site used to build and test the plugin. Create a page with the slug <code>home</code> to replace this.
        </p>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Latest news</h2>
        {posts.length === 0 ? (
          <p className="text-sk-muted">No posts yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.id}>
                <a href={`/news/${p.slug}`} className="text-sk-accent underline-offset-4 hover:underline">
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
