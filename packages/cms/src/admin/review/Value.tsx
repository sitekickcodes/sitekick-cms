import type { Rendered } from '../../review/render'
import styles from './review.module.css'

/**
 * One rendered value inside a diff pane. No hooks, so the server view and
 * the client view share it.
 */
export function Value({ value }: { value: Rendered }) {
  switch (value.kind) {
    case 'empty':
      return <p className={styles.empty}>Blank</p>
    case 'text':
      return <p>{value.text}</p>
    case 'paragraphs':
      return (
        <>
          {value.items.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </>
      )
    case 'list':
      return (
        <ul>
          {value.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    case 'ref':
      return (
        <span className={styles.ref}>
          {value.src ? <img className={styles.thumb} src={value.src} alt="" /> : null}
          <span>{value.label}</span>
        </span>
      )
    case 'json':
      return <pre className={styles.json}>{value.text}</pre>
  }
}
