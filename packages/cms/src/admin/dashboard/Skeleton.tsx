import styles from '../Dashboard.module.css'

/** One placeholder shape, pulsing only when motion is allowed. */
export function Bone({ w = '100%', h = 12 }: { w?: number | string; h?: number }) {
  return <span className={styles.bone} style={{ width: w, height: h }} />
}

/**
 * A card's frame while it loads: the real shell with its title, so nothing
 * jumps when the data arrives. Screen readers hear one line.
 */
export function Skeleton({ title, rows = 5, span = 1 }: { title: string; rows?: number; span?: 1 | 2 }) {
  return (
    <div className={`${styles.card} ${span === 2 ? styles.wide : ''}`} aria-busy="true">
      <span className={styles.srOnly}>Loading {title.toLowerCase()}…</span>
      <div aria-hidden>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{title}</h3>
        </div>
        <div className={styles.skelRows}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={styles.skelRow}>
              <Bone w={`${78 - ((i * 17) % 40)}%`} />
              <Bone w={28} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
