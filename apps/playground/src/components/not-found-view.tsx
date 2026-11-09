import Link from 'next/link'

/** The 404 page's body, for a route's not-found page and for addresses no route matches. */
export function NotFoundView() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-5 py-24 sm:px-8">
      <p className="text-sm font-medium text-sk-muted">404</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">We couldn’t find that page.</h1>
      <p className="text-lg text-sk-muted text-pretty">It may have moved, or the link may be out of date. We’ve made a note so we can fix it.</p>
      <Link href="/" className="font-medium text-sk-accent underline-offset-4 hover:underline">
        Go to the home page
      </Link>
    </section>
  )
}
