import type { CollectionSlug, PayloadComponent } from 'payload'
import type { NavProps } from '@payloadcms/ui/rsc'
import { NavWrapper } from '@payloadcms/ui'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { getPreferences } from '@payloadcms/ui/rsc'
import { groupNavItems } from '@payloadcms/ui/shared'
import { EntityType, formatAdminURL } from 'payload/shared'

import { accountSlugs, joinAdmin, labelText, resolveArrangement } from '../nav/arrangement'
import type { NavServerOptions, PinnedDoc, VisibleEntity } from '../nav/types'
import { NavClient, NavHeader } from './NavClient'

/**
 * The admin sidebar (`admin.components.Nav`). Mirrors Payload 4's
 * `DefaultNav` (`@payloadcms/ui/rsc`) using only public exports: the
 * `NavWrapper` shell (open/close, mobile, the `header` slot above the
 * scroller), `groupNavItems` for what the person may see, and
 * `RenderServerComponent` for the config's before/after slots. Our markup
 * and CSS module inside it, no Payload class names.
 *
 * `navPlugin` passes the plugin options in as `sitekick` via the import
 * map's `serverProps`; `config.custom.sitekick` is the fallback.
 */

export type SitekickNavProps = NavProps & {
  sitekick?: NavServerOptions
}

const PINNED_KEY = 'pinned-documents'
const MAX_PINNED = 8

export async function Nav(props: SitekickNavProps) {
  const { documentSubViewType, i18n, locale, params, payload, permissions, searchParams, user, viewType, visibleEntities } = props
  if (!payload?.config || !visibleEntities || !permissions) return null
  const { admin, collections, globals, routes } = payload.config
  const adminRoute = routes.admin
  const options: NavServerOptions = props.sitekick ??
    (payload.config.custom?.sitekick as NavServerOptions | undefined) ?? { site: { name: 'Sitekick' } }
  const usersSlug = options.usersSlug ?? admin.user

  // Everything this person may see, as Payload's nav would list it (it
  // already leaves out `hidden` and `group: false`), in config order.
  const groups = groupNavItems(
    [
      ...collections.filter(({ slug }) => visibleEntities.collections.includes(slug)).map((entity) => ({ type: EntityType.collection as const, entity })),
      ...globals.filter(({ slug }) => visibleEntities.globals.includes(slug)).map((entity) => ({ type: EntityType.global as const, entity })),
    ],
    permissions,
    i18n,
  )
  const order = new Map<string, number>()
  collections.forEach((c, i) => order.set(`collections:${c.slug}`, i))
  globals.forEach((g, i) => order.set(`globals:${g.slug}`, collections.length + i))
  const visible: VisibleEntity[] = groups
    .flatMap((grp) =>
      grp.entities.map((e): VisibleEntity => {
        const kind = e.type === EntityType.collection ? 'collections' : 'globals'
        return { kind, slug: e.slug, label: labelText(e.label, i18n.language), group: grp.label }
      }),
    )
    .sort((a, b) => (order.get(`${a.kind}:${a.slug}`) ?? 0) - (order.get(`${b.kind}:${b.slug}`) ?? 0))

  const nav = resolveArrangement({
    arrangement: options.nav,
    visible,
    adminRoute,
    account: accountSlugs(collections, usersSlug),
  })

  const pinned = user ? await loadPinned(payload, user, usersSlug, adminRoute) : []

  const serverProps = { i18n, locale, params, payload, permissions, searchParams, user }
  const clientProps = { documentSubViewType, viewType }
  const render = (Component: PayloadComponent | PayloadComponent[] | undefined, key?: string) =>
    Component ? RenderServerComponent({ clientProps, Component, importMap: payload.importMap, key, serverProps }) : null

  return (
    <NavWrapper
      baseClass="nav"
      header={<NavHeader site={options.site} dashboardHref={adminRoute} />}
    >
      {render(admin.components?.beforeNav, 'beforeNav')}
      <NavClient
        areas={nav.areas}
        pinned={pinned}
        before={render(admin.components?.beforeNavLinks, 'beforeNavLinks')}
        after={render(admin.components?.afterNavLinks, 'afterNavLinks')}
        adminRoute={adminRoute}
        dashboardHref={adminRoute}
        accountHref={formatAdminURL({ adminRoute, path: admin.routes.account })}
        logoutHref={formatAdminURL({ adminRoute, path: admin.routes.logout })}
        adminMenu={nav.account}
        help={options.help !== false}
        accent={options.site.accent}
      />
      {render(admin.components?.afterNav, 'afterNav')}
    </NavWrapper>
  )
}

/**
 * The user's `pinned-documents` preference (Payload 4's own pin store, so
 * the dashboard's pin picker and this list agree), with each document's
 * title resolved here with the person's own access. A pin to something
 * gone or no longer readable just drops out.
 */
async function loadPinned(
  payload: SitekickNavProps['payload'],
  user: NonNullable<SitekickNavProps['user']>,
  usersSlug: string,
  adminRoute: string,
): Promise<PinnedDoc[]> {
  type Pref = { items?: { collectionSlug?: unknown; id?: unknown }[] }
  let items: { collectionSlug: string; id: number | string }[] = []
  try {
    const userSlug = typeof user.collection === 'string' ? user.collection : usersSlug
    const pref = await getPreferences<Pref>(PINNED_KEY, payload, user.id, userSlug)
    items = (pref?.value?.items ?? [])
      .filter((i): i is { collectionSlug: string; id: number | string } =>
        typeof i?.collectionSlug === 'string' && (typeof i.id === 'string' || typeof i.id === 'number'),
      )
      .slice(0, MAX_PINNED)
  } catch {
    return []
  }
  const out = await Promise.all(
    items.map(async (item): Promise<PinnedDoc | null> => {
      const slug = item.collectionSlug as CollectionSlug
      const col = payload.collections[slug]
      if (!col) return null
      try {
        const doc = (await payload.findByID({
          collection: slug,
          id: item.id,
          depth: 0,
          user,
          overrideAccess: false,
          disableErrors: true,
        })) as Record<string, unknown> | null
        if (!doc) return null
        const titleKey = col.config.admin?.useAsTitle || 'id'
        const raw = titleKey.split('.').reduce<unknown>((v: unknown, k: string) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), doc)
        const title = typeof raw === 'string' && raw.trim() ? raw : String(doc.id ?? item.id)
        return {
          collectionSlug: item.collectionSlug,
          id: item.id,
          title,
          href: joinAdmin(adminRoute, `/collections/${item.collectionSlug}/${item.id}`),
        }
      } catch {
        return null
      }
    }),
  )
  return out.filter((d): d is PinnedDoc => Boolean(d))
}
