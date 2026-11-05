import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="content" className="main">
      <header className="pageHead">
        <h1>Not found</h1>
        <p className="lede">There’s no page at this address.</p>
      </header>
      <p>
        <Link href="/">Back to the introduction</Link>
      </p>
    </main>
  )
}
