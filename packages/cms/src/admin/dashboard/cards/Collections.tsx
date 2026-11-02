import { Card, Empty } from '../Card'
import { labelOf, readableCollections, type CardContext } from '../data'
import styles from '../../Dashboard.module.css'

/** Every collection this user may read, with how many documents it holds. */
export async function CollectionsCard(context: CardContext) {
  const { req, i18n, adminRoute } = context
  const collections = readableCollections(context)
  const counts = await Promise.all(
    collections.map((c) =>
      req.payload
        .count({ collection: c.slug, overrideAccess: false, req })
        .then((r) => r.totalDocs)
        .catch(() => null),
    ),
  )
  const items = collections.map((c, i) => ({
    slug: c.slug,
    label: labelOf(c.labels?.plural, i18n, c.slug),
    count: counts[i],
    href: `${adminRoute}/collections/${c.slug}`,
  }))
  return (
    <Card title="Collections at a glance" sub="What the site holds.">
      {items.length ? (
        <ul className={styles.counts}>
          {items.map((item) => (
            <li key={item.slug}>
              <a href={item.href}>
                <span className={styles.countLabel}>{item.label}</span>
                <span className={styles.countValue}>{item.count == null ? '—' : item.count.toLocaleString()}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No collections to show.</Empty>
      )}
    </Card>
  )
}
