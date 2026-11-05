'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { hrefOf, SECTIONS } from '@/lib/nav'

/** The page list: a column on wide screens, a "Menu" disclosure on phones. */
export function Sidebar() {
  const pathname = usePathname()
  const menu = useRef<HTMLDetailsElement>(null)
  // Close the phone menu after following a link.
  useEffect(() => {
    if (menu.current) menu.current.open = false
  }, [pathname])
  const list = (
    <nav aria-label="Docs">
      {SECTIONS.map((section) => (
        <div key={section.title} className="navSection">
          <h2>{section.title}</h2>
          <ul>
            {section.pages.map((page) => {
              const href = hrefOf(page.slug)
              return (
                <li key={page.slug}>
                  <Link href={href} aria-current={pathname === href ? 'page' : undefined}>
                    {page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
  return (
    <>
      <aside className="sidebar">{list}</aside>
      <details className="menu" ref={menu}>
        <summary>Menu</summary>
        {list}
      </details>
    </>
  )
}
