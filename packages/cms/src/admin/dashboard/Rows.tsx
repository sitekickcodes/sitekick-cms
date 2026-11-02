import { Empty } from './Card'
import { ago, type Row } from './data'
import styles from '../Dashboard.module.css'

/** Document rows: title, kind, a Draft mark, and how long since the edit. */
export function Rows({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <ul className={styles.rows}>
      {rows.map((r) => (
        <li key={r.key}>
          <a className={styles.row} href={r.href}>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{r.title}</span>
              <span className={styles.rowMeta}>{r.kind}</span>
            </span>
            <span className={styles.rowAside}>
              {r.draft ? <span className={styles.tag}>Draft</span> : null}
              {ago(r.at)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
