'use client'

import type React from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Link,
  NavSidebarToggle,
  useAuth,
  useNav,
  usePathname,
  usePreferences,
  useRouter,
  useSearchParams,
  useStepNav,
} from '@payloadcms/ui'

import {
  countFilters,
  initialsOf,
  isActive,
  parseEditPath,
  placeOf,
  pushRecent,
} from '../nav/arrangement'
import { ICONS, type IconName } from '../nav/icons'
import type { PinnedDoc, RecentDoc, ResolvedArea, ResolvedLink } from '../nav/types'
import type { SiteIdentity } from '../types'
import styles from './Nav.module.css'

/**
 * The sidebar's inside (`Nav.tsx` renders the shell and resolves the
 * arrangement): Dashboard, pinned and recent documents, the areas, then
 * "Get help" and the account pinned to the foot. `NavHeader` is the brand
 * row, rendered in `NavWrapper`'s header slot above the scroller.
 */

/** The DOM event the help drawer listens for. */
export const HELP_OPEN_EVENT = 'sitekick:help:open'
const OPEN_AREAS_KEY = 'sitekick:nav:open'
const PALETTE_OPEN_EVENT = 'sitekick:palette:open'
const RECENT_KEY = 'sitekick:nav:recent'
const RECENT_MAX = 6
const PINNED_PREF = 'pinned-documents'

type Props = {
  areas: ResolvedArea[]
  pinned: PinnedDoc[]
  before: React.ReactNode
  after: React.ReactNode
  adminRoute: string
  dashboardHref: string
  accountHref: string
  logoutHref: string
  /** Users, API keys: admin links in the account menu. */
  adminMenu: ResolvedLink[]
  help: boolean
  accent?: string
}

export function NavClient({ areas, pinned, before, after, adminRoute, dashboardHref, accountHref, logoutHref, adminMenu, help, accent }: Props) {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() ?? ''
  const [open, toggle] = useOpenAreas(areas, pathname, search)
  const recent = useRecentDocs(adminRoute, pathname, pinned)
  usePageScrolledFlag(pathname)

  return (
    <div className={styles.nav} style={accent ? ({ '--sk-accent': accent } as React.CSSProperties) : undefined}>
      <BreadcrumbTrail areas={areas} pathname={pathname} search={search} />
      <FilterFlag pathname={pathname} search={search} />
      <ul className={styles.list}>
        <li>
          <button type="button" className={styles.row} onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))} aria-haspopup="dialog">
            <LucideIcon name="search" />
            <span className={styles.label}>Search</span>
            <kbd className={styles.kbd} aria-hidden>⌘K</kbd>
          </button>
        </li>
        <li>
          <RowLink href={dashboardHref} active={pathname === dashboardHref} pathname={pathname}>
            <LucideIcon name="layout-dashboard" />
            <span className={styles.label}>Dashboard</span>
          </RowLink>
        </li>
      </ul>
      {before}
      <DocsList title="Pinned" icon="pin" docs={pinned} pathname={pathname} pinnedIds={pinned} />
      <DocsList title="Recent" icon="clock" docs={recent} pathname={pathname} pinnedIds={pinned} />
      {areas.length ? (
        <section className={styles.block} aria-label="Content">
          <ul className={styles.list}>
            {areas.map((area) => (
              <Area key={area.key} area={area} open={Boolean(open[area.key])} onToggle={() => toggle(area.key)} pathname={pathname} search={search} />
            ))}
          </ul>
        </section>
      ) : null}
      {after}
      <Foot>
        {help ? (
          <div className={styles.help}>
            <button
              type="button"
              className={styles.row}
              onClick={() => window.dispatchEvent(new CustomEvent(HELP_OPEN_EVENT))}
              aria-haspopup="dialog"
            >
              <LucideIcon name="life-buoy" />
              <span className={styles.label}>Get help</span>
            </button>
          </div>
        ) : null}
        <Account accountHref={accountHref} logoutHref={logoutHref} adminMenu={adminMenu} />
      </Foot>
    </div>
  )
}

/**
 * The brand row: the site's logo or a wordmark of its name, "Admin", and
 * Payload's collapse toggle. Rendered in `NavWrapper`'s `header` slot, so it
 * sits above the scroller (and is hidden when the admin is embedded).
 */
export function NavHeader({ site, dashboardHref }: { site: SiteIdentity; dashboardHref: string }) {
  const logo = site.logo || site.icon
  return (
    <div className={styles.brand}>
      <Link href={dashboardHref} prefetch={false} className={styles.brandLink} aria-label={`${site.name}: dashboard`}>
        {logo ? (
          <img className={styles.brandLogo} src={logo} alt="" />
        ) : (
          <span className={styles.brandMark} aria-hidden>
            {site.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className={styles.brandName}>{site.name}</span>
        <span className={styles.brandBadge}>Admin</span>
      </Link>
      <NavSidebarToggle baseClass="sk-nav" />
    </div>
  )
}

// ---- State hooks ----

/**
 * Which areas are open. All closed on the first paint of a session; after
 * that, remembered in sessionStorage so a reload keeps your folds. Moving to
 * a page opens the area that holds it (the rest stay as they were); the
 * sidebar collapsing closes them all.
 */
function useOpenAreas(areas: ResolvedArea[], pathname: string, search: string): [Record<string, boolean>, (key: string) => void] {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const holding = (here: string, q: string) => areas.find((a) => a.links.some((l) => isActive(here, l.href, q)))?.key ?? null
  const persist = (next: Record<string, boolean>) => {
    try {
      sessionStorage.setItem(OPEN_AREAS_KEY, JSON.stringify(Object.keys(next).filter((k) => next[k])))
    } catch {
      /* private mode, quota: a session without memory is fine */
    }
  }
  // Server and first client paint agree (nothing open); the session's folds
  // and the current page's area arrive right after mount.
  const [where, setWhere] = useState<string | null>(null)
  useEffect(() => {
    const at = `${pathname}?${search}`
    if (at === where) return
    setWhere(at)
    setOpen((prev) => {
      let base = prev
      if (where === null) {
        try {
          const saved = JSON.parse(sessionStorage.getItem(OPEN_AREAS_KEY) ?? '[]') as unknown
          base = Array.isArray(saved) ? Object.fromEntries(saved.filter((k): k is string => typeof k === 'string').map((k) => [k, true])) : {}
        } catch {
          base = {}
        }
      }
      const key = holding(pathname, search)
      const next = key ? { ...base, [key]: true } : base
      persist(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search])
  const { navOpen } = useNav()
  const [wasOpen, setWasOpen] = useState(navOpen)
  if (navOpen !== wasOpen) {
    setWasOpen(navOpen)
    if (!navOpen) {
      setOpen({})
      persist({})
    }
  }
  const toggle = (key: string) =>
    setOpen((o) => {
      const next = { ...o, [key]: !o[key] }
      persist(next)
      return next
    })
  return [open, toggle]
}

/**
 * The last few documents you edited: a ring buffer in localStorage of edit
 * URLs, titled from the breadcrumb once Payload sets it. Pinned documents
 * are left out of the list; they have their own.
 */
function useRecentDocs(adminRoute: string, pathname: string, pinned: PinnedDoc[]): RecentDoc[] {
  const { stepNav } = useStepNav()
  const [recent, setRecent] = useState<RecentDoc[]>([])
  useEffect(() => {
    setRecent(readRecent())
  }, [])
  const last = stepNav[stepNav.length - 1]?.label
  const title = typeof last === 'string' ? last : ''
  useEffect(() => {
    const edit = parseEditPath(adminRoute, pathname)
    if (!edit || !title) return
    const doc: RecentDoc = { href: pathname, title, collectionSlug: edit.slug, id: edit.id, at: Date.now() }
    const next = pushRecent(readRecent(), doc, RECENT_MAX)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setRecent(next)
  }, [adminRoute, pathname, title])
  const pinnedHrefs = new Set(pinned.map((p) => p.href))
  return recent.filter((r) => !pinnedHrefs.has(r.href))
}

function readRecent(): RecentDoc[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (d): d is RecentDoc => Boolean(d) && typeof d === 'object' && typeof (d as RecentDoc).href === 'string' && typeof (d as RecentDoc).title === 'string',
    )
  } catch {
    return []
  }
}

/** Marks `<html data-sk-scrolled>` once the page has scrolled, for the phone
 * header's hairline (theme CSS). Only the page's own scroll counts (Payload
 * scrolls <body>), not a field or the sidebar. */
function usePageScrolledFlag(pathname: string) {
  useEffect(() => {
    const root = document.documentElement
    const check = () => {
      const scrolled = Math.max(document.body.scrollTop, root.scrollTop) > 0
      if (scrolled) root.dataset.skScrolled = ''
      else delete root.dataset.skScrolled
    }
    const onScroll = (e: Event) => {
      if (e.target === document || e.target === document.body || e.target === root) check()
    }
    check()
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      delete root.dataset.skScrolled
    }
  }, [])
  // A new page can land at the top without a scroll event.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const root = document.documentElement
      if (Math.max(document.body.scrollTop, root.scrollTop) > 0) root.dataset.skScrolled = ''
      else delete root.dataset.skScrolled
    })
    return () => cancelAnimationFrame(id)
  }, [pathname])
}

// ---- Pieces ----

/** Get help and the account, pinned to the sidebar's foot: the list scrolls
 * behind them. While more of it is hidden below, a fade above the foot says
 * so (`data-more`). The scroller is the nearest scrolling ancestor
 * (Payload's), found by style, not class name. */
function Foot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    let scroller = ref.current?.parentElement ?? null
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (!scroller) return
    const el = scroller
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])
  return (
    <div ref={ref} className={styles.foot} data-more={more || undefined}>
      {children}
    </div>
  )
}

/** Payload's router transitions, prefetching only on hover/focus intent.
 * The current page stays a plain row. */
function RowLink({
  href,
  active,
  pathname,
  children,
  className = styles.row,
}: {
  href: string
  active: boolean
  pathname: string
  children: React.ReactNode
  className?: string
}) {
  const [intent, setIntent] = useState(false)
  if (pathname === href)
    return (
      <span className={className} aria-current="page">
        {children}
      </span>
    )
  return (
    <Link
      className={className}
      href={href}
      prefetch={intent}
      onMouseEnter={() => setIntent(true)}
      onMouseLeave={() => setIntent(false)}
      onFocus={() => setIntent(true)}
      onBlur={() => setIntent(false)}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}

/** A Lucide icon from `nav/icons.ts`, drawn inline (not the brand `Icon` in admin/Icon.tsx). */
function LucideIcon({ name, className = styles.icon }: { name: IconName; className?: string }) {
  const shapes = ICONS[name]
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {shapes.map((s, i) =>
        s[0] === 'path' ? (
          <path key={i} d={s[1]} />
        ) : s[0] === 'circle' ? (
          <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />
        ) : (
          <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />
        ),
      )}
    </svg>
  )
}

function Area({ area, open, onToggle, pathname, search }: { area: ResolvedArea; open: boolean; onToggle: () => void; pathname: string; search: string }) {
  const id = useId()
  const holdsCurrent = area.links.some((l) => isActive(pathname, l.href, search))
  // An area with one link is that link: "News > News" reads as noise.
  if (area.links.length === 1) {
    const only = area.links[0]
    return (
      <li>
        <RowLink href={only.href} active={isActive(pathname, only.href, search)} pathname={pathname} className={styles.row}>
          <LucideIcon name={area.icon as IconName} />
          <span className={styles.label}>{area.label}</span>
          {only.badge ? <span className={styles.badge}>{only.badge}</span> : null}
        </RowLink>
      </li>
    )
  }
  return (
    <li>
      <button type="button" className={styles.row} aria-expanded={open} aria-controls={id} onClick={onToggle} data-holds={(holdsCurrent && !open) || undefined}>
        <LucideIcon name={area.icon as IconName} />
        <span className={styles.label}>{area.label}</span>
        <LucideIcon name="chevron-down" className={styles.chev} />
      </button>
      {/* Opens and closes by easing its height (a 0fr → 1fr grid row); inert
          while closed, so its links leave the tab order and the a11y tree. */}
      <div id={id} className={styles.kidsWrap} data-open={open} inert={!open}>
        <ul className={styles.kids}>
          {area.links.map((l) => (
            <li key={l.href}>
              <RowLink href={l.href} active={isActive(pathname, l.href, search)} pathname={pathname} className={styles.kid}>
                <span className={styles.label}>{l.label}</span>
                {l.badge ? <span className={styles.badge}>{l.badge}</span> : null}
              </RowLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

/** Pinned or recent documents: a quiet titled list with a pin toggle on each row. */
function DocsList({
  title,
  icon,
  docs,
  pathname,
  pinnedIds,
}: {
  title: string
  icon: IconName
  docs: (PinnedDoc | RecentDoc)[]
  pathname: string
  pinnedIds: PinnedDoc[]
}) {
  if (!docs.length) return null
  const isPinned = (d: PinnedDoc | RecentDoc) => pinnedIds.some((p) => p.collectionSlug === d.collectionSlug && String(p.id) === String(d.id))
  return (
    <section className={styles.block} aria-label={title}>
      <p className={styles.blockLabel} aria-hidden>
        <LucideIcon name={icon} className={styles.blockIcon} />
        {title}
      </p>
      <ul className={styles.list}>
        {docs.map((d) => (
          <li key={d.href} className={styles.docRow}>
            <RowLink href={d.href} active={isActive(pathname, d.href)} pathname={pathname} className={styles.kid}>
              <span className={styles.label}>{d.title}</span>
            </RowLink>
            <PinButton doc={d} pinned={isPinned(d)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Pin or unpin via Payload 4's `pinned-documents` preference, then refresh
 * so the server-rendered Pinned list (titles and all) catches up. */
function PinButton({ doc, pinned }: { doc: { collectionSlug: string; id: number | string; title: string }; pinned: boolean }) {
  const { getPreference, setPreference } = usePreferences()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  type Pref = { items?: { collectionSlug: string; id: number | string }[] }
  const onClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const current = (await getPreference<Pref | null>(PINNED_PREF))?.items ?? []
      const same = (i: { collectionSlug: string; id: number | string }) => i.collectionSlug === doc.collectionSlug && String(i.id) === String(doc.id)
      const rest = current.filter((i) => !same(i))
      const items = pinned ? rest : [{ collectionSlug: doc.collectionSlug, id: doc.id }, ...rest]
      await setPreference<Pref>(PINNED_PREF, { items }, false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className={styles.pin} onClick={onClick} aria-pressed={pinned} aria-label={pinned ? `Unpin ${doc.title}` : `Pin ${doc.title}`} disabled={busy}>
      <LucideIcon name={pinned ? 'pin-off' : 'pin'} className={styles.pinIcon} />
    </button>
  )
}

/**
 * The breadcrumb leads with where the page sits in this sidebar: its area,
 * then the sidebar's name for it (Payload's first crumb is the collection,
 * so it is renamed and keeps its link), then Payload's own crumbs (the
 * record you're on). Pages the sidebar doesn't list keep Payload's.
 */
function BreadcrumbTrail({ areas, pathname, search }: { areas: ResolvedArea[]; pathname: string; search: string }) {
  const { stepNav, setStepNav } = useStepNav()
  const place = useMemo(() => placeOf(areas, pathname, search), [areas, pathname, search])
  useEffect(() => {
    if (!place || !stepNav.length) return
    const [first, ...rest] = stepNav
    if (!first) return
    // An area named after its one link gets no separate crumb.
    const lead = place.area !== place.label ? [{ label: place.area }] : []
    const done = lead.length ? first.label === place.area : first.label === place.label
    if (done) return
    setStepNav([...lead, { ...first, label: place.label }, ...rest])
  }, [place, stepNav, setStepNav])
  return null
}

/**
 * How many filter conditions a list's URL carries, on `<html
 * data-sk-list-filters>` and on Payload's filter toggle as
 * `data-sk-filter-count` (the badge is drawn from it). Arriving at a
 * filtered list also opens the filter panel, once per page and filter set:
 * close it and it stays closed.
 */
function FilterFlag({ pathname, search }: { pathname: string; search: string }) {
  const opened = useRef<string | null>(null)
  useEffect(() => {
    const count = countFilters(search)
    const root = document.documentElement
    const mark = () => {
      const toggle = document.getElementById('toggle-list-filters')
      if (count) {
        root.dataset.skListFilters = String(count)
        toggle?.setAttribute('data-sk-filter-count', String(count))
      } else {
        delete root.dataset.skListFilters
        toggle?.removeAttribute('data-sk-filter-count')
      }
      return toggle
    }
    mark()
    if (!count) return
    const params = new URLSearchParams(search)
    const key = `${pathname}?${[...params.entries()].filter(([k]) => k.startsWith('where[')).map(([k, v]) => `${k}=${v}`).join('&')}`
    // The button is in the page before it responds (server-rendered, then
    // hydrated), so press until the panel says it's open, for up to 3 s.
    let tries = 0
    const timer = setInterval(() => {
      const toggle = mark()
      if (opened.current === key) return clearInterval(timer)
      if (toggle?.getAttribute('aria-expanded') === 'true') {
        opened.current = key
        return clearInterval(timer)
      }
      if (++tries > 12) return clearInterval(timer)
      toggle?.click()
    }, 250)
    return () => clearInterval(timer)
  }, [pathname, search])
  return null
}

const ADMIN_ICONS: Record<string, IconName> = { users: 'users' }

/** The account at the foot: initials (no photo), the address, and a small
 * menu: your profile, Users and API keys, Log out. */
function Account({ accountHref, logoutHref, adminMenu }: { accountHref: string; logoutHref: string; adminMenu: ResolvedLink[] }) {
  const { user } = useAuth()
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const out = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', out)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])
  const u = (user ?? {}) as Record<string, unknown>
  const email = typeof u.email === 'string' ? u.email : ''
  if (!email) return null
  const name = (typeof u.name === 'string' ? u.name.trim() : '') || (email.split('@')[0] ?? '')
  const initials = initialsOf(typeof u.name === 'string' ? u.name : undefined, email)
  const close = () => setMenu(false)
  return (
    <div className={styles.account} ref={ref}>
      <button type="button" className={styles.accountButton} aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)}>
        <span className={styles.initials} aria-hidden>
          {initials}
        </span>
        <span className={styles.accountWho}>
          <span className={styles.accountName}>{name}</span>
          <span className={styles.accountEmail}>{email}</span>
        </span>
        <LucideIcon name="chevrons-up-down" className={styles.accountMore} />
      </button>
      {menu ? (
        <div className={styles.menu} role="menu">
          <Link role="menuitem" href={accountHref} prefetch={false} onClick={close}>
            <LucideIcon name="user-round" className={styles.menuIcon} /> Your profile
          </Link>
          {adminMenu.length ? (
            <>
              <hr />
              {adminMenu.map((l) => (
                <Link key={l.href} role="menuitem" href={l.href} prefetch={false} onClick={close}>
                  <LucideIcon name={ADMIN_ICONS[l.key.split(':')[1] ?? ''] ?? 'key-round'} className={styles.menuIcon} /> {l.label}
                </Link>
              ))}
            </>
          ) : null}
          <hr />
          <Link role="menuitem" href={logoutHref} prefetch={false}>
            <LucideIcon name="log-out" className={styles.menuIcon} /> Log out
          </Link>
        </div>
      ) : null}
    </div>
  )
}
