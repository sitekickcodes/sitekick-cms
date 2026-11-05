import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Sidebar } from './Sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: { default: 'Sitekick CMS', template: '%s · Sitekick CMS' },
  description: 'A Payload 4 plugin, a block library and an agent kit for client sites that editors enjoy.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <header className="top">
          <Link href="/" className="brand">
            <span className="mark" aria-hidden="true" />
            Sitekick CMS <span className="beta">beta</span>
          </Link>
          <nav aria-label="External">
            <a href="https://github.com/sitekickcodes/sitekick-cms" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </header>
        <div className="shell">
          <Sidebar />
          {children}
        </div>
      </body>
    </html>
  )
}
