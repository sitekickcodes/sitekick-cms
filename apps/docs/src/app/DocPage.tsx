import Link from 'next/link'

import { hrefOf, neighbours, render, SECTIONS, type Page } from '@/lib/docs'

export async function DocPage({ page }: { page: Page }) {
  const { html, headings } = await render(page)
  const { prev, next } = neighbours(page.slug)
  const section = SECTIONS.find((s) => s.pages.includes(page))?.title
  return (
    <>
      <main id="content" className="main">
        <header className="pageHead">
          {section ? <p className="eyebrow">{section}</p> : null}
          <h1>{page.title}</h1>
          <p className="lede">{page.description}</p>
        </header>
        <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="pager" aria-label="Pages">
          {prev ? (
            <Link href={hrefOf(prev.slug)} rel="prev">
              <span>Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={hrefOf(next.slug)} rel="next" className="next">
              <span>Next</span>
              {next.title}
            </Link>
          ) : null}
        </nav>
      </main>
      {headings.length > 1 ? (
        <aside className="outline" aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      ) : (
        <span />
      )}
    </>
  )
}
