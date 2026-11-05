import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { cms } from '@/lib/cms'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const payload = await cms()
  const settings = await payload.findGlobal({ slug: 'site-settings' })
  return { title: { default: settings.siteName, template: `%s · ${settings.siteName}` }, description: settings.tagline ?? undefined }
}

const nav = [
  { href: '/', label: 'Home' },
  { href: '/news', label: 'News' },
  { href: '/events', label: 'Events' },
  { href: '/admin', label: 'Admin' },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const payload = await cms()
  const settings = await payload.findGlobal({ slug: 'site-settings' })
  return (
    <html lang="en">
      <body className="flex min-h-svh flex-col bg-sk-bg text-sk-fg">
        <header className="border-b border-sk-line">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 lg:px-12">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight">
              {settings.siteName}
            </Link>
            <nav aria-label="Main" className="flex items-center gap-6 text-sm font-medium text-sk-muted">
              {nav.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-sk-fg motion-safe:transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-sk-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-10 text-sm text-sk-muted sm:px-8 lg:px-12">
            <p className="font-medium text-sk-fg">{settings.siteName}</p>
            {settings.tagline ? <p>{settings.tagline}</p> : null}
          </div>
        </footer>
      </body>
    </html>
  )
}
