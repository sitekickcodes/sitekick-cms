import type { ReactNode } from 'react'

import styles from '../Dashboard.module.css'

/** One hairline panel: a title, an optional line under it, an optional "more" link. */
export function Card({
  title,
  sub,
  more,
  span = 1,
  children,
}: {
  title: ReactNode
  sub?: string
  more?: { href: string; label: string }
  span?: 1 | 2
  children: ReactNode
}) {
  return (
    <div className={`${styles.card} ${span === 2 ? styles.wide : ''}`}>
      <div className={styles.cardTop}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {more ? (
          <a className={styles.more} href={more.href}>
            {more.label} →
          </a>
        ) : null}
      </div>
      {sub ? <p className={styles.sub}>{sub}</p> : null}
      {children}
    </div>
  )
}

/** The quiet line a card shows when it has nothing to list. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}
