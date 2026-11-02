import type { Metadata } from 'next'
import React from 'react'

import { cms } from '@/lib/cms'
import './styles.css'

export async function generateMetadata(): Promise<Metadata> {
  const payload = await cms()
  const settings = await payload.findGlobal({ slug: 'site-settings' })
  return { title: { default: settings.siteName, template: `%s · ${settings.siteName}` }, description: settings.tagline ?? undefined }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const payload = await cms()
  const settings = await payload.findGlobal({ slug: 'site-settings' })
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">{settings.siteName}</a>
          <nav>
            <a href="/news">News</a>
            <a href="/admin">Admin</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>{settings.siteName}{settings.tagline ? ` · ${settings.tagline}` : ''}</p>
        </footer>
      </body>
    </html>
  )
}
