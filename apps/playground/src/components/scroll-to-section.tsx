'use client'

import { useEffect } from 'react'

/**
 * Opens a proposal preview at the first changed section. Scrolls this
 * window only: a URL fragment inside the admin's preview frame would scroll
 * the review page around it too.
 */
export function ScrollToSection({ section }: { section: number }) {
  useEffect(() => {
    const el = document.getElementById(`section-${section}`)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 48 })
  }, [section])
  return null
}
