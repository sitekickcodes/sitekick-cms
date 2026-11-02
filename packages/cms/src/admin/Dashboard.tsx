import { Suspense } from 'react'
import { Gutter } from '@payloadcms/ui'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import type { AdminViewServerProps } from 'payload'

import { parseRange, rangeHref, type DashboardServerProps } from '../dashboard/types'
import { CollectionsCard } from './dashboard/cards/Collections'
import { DraftsCard } from './dashboard/cards/Drafts'
import { RecentEditsCard } from './dashboard/cards/RecentEdits'
import { creatableCollections, labelOf, type CardContext } from './dashboard/data'
import { Header } from './dashboard/Header'
import { Grid } from './dashboard/Section'
import { Skeleton } from './dashboard/Skeleton'
import { Welcome } from './dashboard/Welcome'
import styles from './Dashboard.module.css'

/**
 * The admin home (`admin.components.views.dashboard`): a header with the
 * greeting and Create menu, the welcome card, then cards, each streaming in
 * its own Suspense boundary so one slow query never holds up the page.
 * Options arrive through `Component.serverProps` from `dashboardPlugin`.
 */
export async function Dashboard(props: AdminViewServerProps & Partial<DashboardServerProps>) {
  const { i18n, initPageResult, locale, params, payload, permissions, searchParams, user, renderComponent } = props
  const site = props.site ?? { name: 'Sitekick' }
  const builtin = props.builtin ?? { drafts: true, recent: true, collections: true }
  const cards = props.cards ?? []
  const rangeConfig = props.range ?? false
  const req = initPageResult.req
  const adminRoute = payload.config.routes.admin
  const perms = permissions ?? initPageResult.permissions
  const range = parseRange(searchParams?.range, rangeConfig)
  const { beforeDashboard, afterDashboard } = payload.config.admin.components
  const serverProps = { i18n, locale, params, payload, permissions: perms, searchParams, user }
  const render = renderComponent ?? RenderServerComponent

  const context: CardContext = { req, permissions: perms, i18n, adminRoute }
  const creatable = creatableCollections(context)
  const order = props.create
  const create = (order ? order.flatMap((slug) => creatable.filter((c) => c.slug === slug)) : creatable).map((c) => ({
    label: labelOf(c.labels?.singular, i18n, c.slug),
    href: `${adminRoute}/collections/${c.slug}/create`,
  }))
  const ranges = rangeConfig
    ? rangeConfig.choices.map((days) => ({ days, href: rangeHref(adminRoute, days, rangeConfig), current: days === range }))
    : undefined

  return (
    <Gutter className="dashboard">
      <div className={styles.root}>
        <Header subline={site.name} siteURL={site.url} create={create} ranges={ranges} />
        {props.welcome !== false && user ? (
          <Suspense fallback={null}>
            <Welcome req={req} siteName={site.name} />
          </Suspense>
        ) : null}
        {beforeDashboard ? render({ Component: beforeDashboard, importMap: payload.importMap, serverProps }) : null}
        {user ? (
          <Grid>
            {builtin.drafts ? (
              <Suspense fallback={<Skeleton title="Drafts waiting" rows={6} />}>
                <DraftsCard {...context} />
              </Suspense>
            ) : null}
            {builtin.recent ? (
              <Suspense fallback={<Skeleton title="Recent edits" rows={6} />}>
                <RecentEditsCard {...context} />
              </Suspense>
            ) : null}
            {builtin.collections ? (
              <Suspense fallback={<Skeleton title="Collections at a glance" rows={5} />}>
                <CollectionsCard {...context} />
              </Suspense>
            ) : null}
            {cards.map((card) => (
              <Suspense key={card.key} fallback={<Skeleton title={card.title} rows={card.skeletonRows} span={card.span} />}>
                {render({
                  Component: card.Component,
                  importMap: payload.importMap,
                  key: card.key,
                  serverProps: { ...serverProps, req, range, adminRoute, site, span: card.span ?? 1 },
                })}
              </Suspense>
            ))}
          </Grid>
        ) : null}
        {afterDashboard ? render({ Component: afterDashboard, importMap: payload.importMap, serverProps }) : null}
      </div>
    </Gutter>
  )
}
