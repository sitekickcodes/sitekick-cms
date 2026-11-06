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
    case 'rich':
      return (
        <>
          {value.items.map((item, i) => {
            if (item.type === 'heading') return <p key={i} className={styles.richHeading} data-level={item.level}>{item.text}</p>
            if (item.type === 'quote') return <blockquote key={i} className={styles.richQuote}>{item.text}</blockquote>
            if (item.type === 'list') {
              const List = item.ordered ? 'ol' : 'ul'
              return (
                <List key={i}>
                  {item.items.map((text, j) => (
                    <li key={j}>{text}</li>
                  ))}
                </List>
              )
            }
            return <p key={i}>{item.text}</p>
          })}
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
    case 'image':
      return (
        <figure className={styles.webImage}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a remote image under review, not yet in the library */}
          <img src={value.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <figcaption>
            {value.credit ? <>Credit: {value.credit} · </> : null}
            Added to the media library when you accept.
          </figcaption>
        </figure>
      )
    case 'links':
      return (
        <ul className={styles.links}>
          {value.items.map((item, i) => (
            <li key={i}>
              <span className={styles.linkLabel}>{item.label}</span>
              <a href={item.href} target="_blank" rel="noreferrer noopener">
                {item.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </li>
          ))}
        </ul>
      )
    case 'json':
      return <pre className={styles.json}>{value.text}</pre>
  }
}
