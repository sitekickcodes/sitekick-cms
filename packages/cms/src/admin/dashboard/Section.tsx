import type { ReactNode } from 'react'

import styles from '../Dashboard.module.css'

/** A titled area of cards. */
export function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <header className={styles.sectionHead}>
        <h2 id={id}>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </header>
      {children}
    </section>
  )
}

/** Cards side by side on wide screens, stacked on narrow ones. */
export function Grid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>
}
