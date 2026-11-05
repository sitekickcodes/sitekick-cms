import type { AdminViewServerProps, CollectionSlug } from 'payload'
import { Gutter } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/ui/rsc'

import { hasRole } from '../../access'
import { reviewSlugs, type ReviewCollectionOptions } from '../../review'
import { budgetFromEnv, money, usageOf, type UsageRow, type UsageRun } from '../../review/usage'
import styles from './usage.module.css'

/** Runs read per visit: enough for a busy month and the one before. */
const LIMIT = 5000

/**
 * `/admin/usage`, admins only: what the agents cost. This month against last month and the
 * budget (SITEKICK_AI_BUDGET_USD), a bar per day for the last 30 days, and this month split
 * by agent, model and who started the run, with the most expensive runs linked.
 */
export async function UsageView(props: AdminViewServerProps & { slugs?: ReviewCollectionOptions }) {
  const { i18n, initPageResult, locale, params, payload, permissions, searchParams, user, viewActions } = props
  const req = initPageResult.req
  const adminRoute = payload.config.routes.admin
  if (!req.user) {
    props.server.redirect(`${adminRoute}/login?redirect=${encodeURIComponent(`${adminRoute}/usage`)}`)
    return null
  }
  const slugs = reviewSlugs(props.slugs)
  const admin = hasRole(req.user, 'admin')
  // Last month and the 30-day chart, whichever reaches further back.
  const now = new Date()
  const from = new Date(Math.min(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1), now.getTime() - 31 * 864e5))

  let runs: UsageRun[] = []
  if (admin && payload.collections[slugs.runsSlug as CollectionSlug]) {
    const { docs } = await payload.find({
      collection: slugs.runsSlug as CollectionSlug,
      where: { createdAt: { greater_than_equal: from.toISOString() } },
      select: { title: true, kind: true, model: true, status: true, costUsd: true, createdAt: true, triggeredBy: true },
      sort: '-createdAt',
      limit: LIMIT,
      depth: 0,
      pagination: false,
      req,
      overrideAccess: false,
    })
    runs = docs as unknown as UsageRun[]
  }
  const people = await namesOf(props, runs)
  const usage = usageOf(runs, { budgetUsd: budgetFromEnv(), people })
  const max = Math.max(...usage.days.map((d) => d.costUsd), 0)
  const runURL = (id: string | number) => `${adminRoute}/collections/${slugs.runsSlug}/${encodeURIComponent(String(id))}`
  const budgetUsed = usage.budgetUsd ? usage.month.costUsd / usage.budgetUsd : null

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions ?? initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      viewActions={viewActions}
      viewType="usage"
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className={styles.root}>
          <header className={styles.head}>
            <h1 className={styles.title}>AI usage</h1>
            <p className={styles.lede}>What the agents have cost, from each run’s recorded spend. Model calls go through Vercel AI Gateway and are billed there.</p>
          </header>

          {!admin ? (
            <p className={styles.empty}>Only admins can see AI usage.</p>
          ) : (
            <>
              <section className={styles.tiles} aria-label="Totals">
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>{usage.month.label}</span>
                  <span className={styles.tileValue}>{money(usage.month.costUsd)}</span>
                  <span className={styles.tileSub}>
                    {usage.month.runs} {usage.month.runs === 1 ? 'run' : 'runs'}
                    {usage.budgetUsd ? ` · ${Math.round((budgetUsed ?? 0) * 100)}% of ${money(usage.budgetUsd)}` : ''}
                  </span>
                  {usage.budgetUsd ? (
                    <span className={styles.meter} role="meter" aria-label="Share of the monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((budgetUsed ?? 0) * 100))}>
                      <span style={{ width: `${Math.min(100, (budgetUsed ?? 0) * 100)}%` }} data-over={(budgetUsed ?? 0) > 1 || undefined} />
                    </span>
                  ) : null}
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Projected for the month</span>
                  <span className={styles.tileValue}>{money(usage.month.projectedUsd)}</span>
                  <span className={styles.tileSub}>
                    {usage.budgetUsd ? (usage.month.projectedUsd > usage.budgetUsd ? `Over the ${money(usage.budgetUsd)} budget at this pace` : 'Within budget at this pace') : 'At this month’s pace'}
                  </span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>{usage.lastMonth.label}</span>
                  <span className={styles.tileValue}>{money(usage.lastMonth.costUsd)}</span>
                  <span className={styles.tileSub}>
                    {usage.lastMonth.runs} {usage.lastMonth.runs === 1 ? 'run' : 'runs'}
                  </span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Spent on failed runs</span>
                  <span className={styles.tileValue}>{money(usage.failedUsd)}</span>
                  <span className={styles.tileSub}>This month{usage.unmeasured ? ` · ${usage.unmeasured} without a recorded cost` : ''}</span>
                </div>
              </section>

              <section className={styles.section} aria-labelledby="usage-days">
                <h2 id="usage-days">Spend per day, last 30 days</h2>
                {max > 0 ? (
                  <div className={styles.chart}>
                    <span className={styles.axisTop}>{money(max)}</span>
                    <ol className={styles.bars}>
                      {usage.days.map((d) => {
                        const label = `${new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}: ${money(d.costUsd)}, ${d.runs} ${d.runs === 1 ? 'run' : 'runs'}`
                        return (
                          <li key={d.date} className={styles.bar} tabIndex={0} aria-label={label}>
                            <span className={styles.fill} style={{ height: `${d.costUsd > 0 ? Math.max(2, (d.costUsd / max) * 100) : 0}%` }} />
                            <span className={styles.tip} role="tooltip">
                              {label}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                    <div className={styles.axis}>
                      <span>{usage.days[0]?.date.slice(5)}</span>
                      <span>Today</span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.empty}>No spend recorded in the last 30 days.</p>
                )}
              </section>

              <div className={styles.split}>
                <Breakdown title="By agent" rows={usage.byAgent} />
                <Breakdown title="By model" rows={usage.byModel} />
                <Breakdown title="By person" rows={usage.byPerson} />
              </div>

              <section className={styles.section} aria-labelledby="usage-top">
                <h2 id="usage-top">Most expensive runs this month</h2>
                {usage.top.length ? (
                  <ol className={styles.top}>
                    {usage.top.map((r) => (
                      <li key={r.id}>
                        <a href={runURL(r.id)}>{r.title || `Run ${String(r.id)}`}</a>
                        <span className={styles.muted}>{r.model ?? ''}</span>
                        <span className={styles.amount}>{money(r.costUsd ?? 0)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.empty}>No runs with a cost this month.</p>
                )}
              </section>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

function Breakdown({ title, rows }: { title: string; rows: UsageRow[] }) {
  const max = Math.max(...rows.map((r) => r.costUsd), 0)
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {rows.length ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{title.replace(/^By /, '').replace(/^\w/, (c) => c.toUpperCase())}</th>
              <th scope="col">Runs</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  <span className={styles.rowLabel}>{r.label}</span>
                  <span className={styles.rowBar} style={{ width: `${max > 0 ? (r.costUsd / max) * 100 : 0}%` }} aria-hidden="true" />
                </th>
                <td>{r.runs}</td>
                <td>{money(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>No runs this month.</p>
      )}
    </section>
  )
}

/** Names for the people who started runs, read with the viewer's access. */
async function namesOf(props: AdminViewServerProps, runs: UsageRun[]): Promise<Record<string, string>> {
  const { payload, initPageResult } = props
  const ids = [...new Set(runs.map((r) => r.triggeredBy).map((v) => (typeof v === 'object' && v && 'value' in v ? (v as { value: unknown }).value : v)).filter((v): v is string | number => typeof v === 'string' || typeof v === 'number'))]
  if (!ids.length) return {}
  const slug = (payload.config.admin.user ?? 'users') as CollectionSlug
  try {
    const { docs } = await payload.find({ collection: slug, where: { id: { in: ids } }, depth: 0, limit: ids.length, pagination: false, req: initPageResult.req, overrideAccess: false })
    return Object.fromEntries(docs.map((d) => [String(d.id), String((d as { name?: string; email?: string }).name || (d as { email?: string }).email || d.id)]))
  } catch {
    return {}
  }
}
