import { describe, expect, test } from 'bun:test'

import {
  accountSlugs,
  countFilters,
  deriveArrangement,
  initialsOf,
  isActive,
  joinAdmin,
  labelText,
  parseEditPath,
  placeOf,
  pushRecent,
  resolveArrangement,
  resolveIcon,
} from '../arrangement'
import { iconForArea } from '../icons'
import type { RecentDoc, VisibleEntity } from '../types'

const c = (slug: string, label: string, group = 'Collections'): VisibleEntity => ({ kind: 'collections', slug, label, group })
const g = (slug: string, label: string, group = 'Globals'): VisibleEntity => ({ kind: 'globals', slug, label, group })

const visible: VisibleEntity[] = [
  c('pages', 'Pages', 'Website'),
  c('posts', 'Posts', 'News'),
  c('media', 'Media', 'Library'),
  c('people', 'People'),
  c('users', 'Users', 'Admin'),
  c('payload-mcp-api-keys', 'MCP API keys', 'Admin'),
  g('site-settings', 'Site settings', 'Website'),
]
const account = { users: 'users', apiKeys: ['payload-mcp-api-keys'] }
const adminRoute = '/admin'

describe('deriveArrangement', () => {
  test('one area per group, in config order, globals as labelled links', () => {
    const areas = deriveArrangement(visible)
    expect(areas.map((a) => a.label)).toEqual(['Website', 'News', 'Library', 'Collections', 'Admin'])
    expect(areas[0]!.links).toEqual(['pages', { to: 'site-settings', label: 'Site settings' }])
  })
})

describe('resolveArrangement', () => {
  test('derives from groups when nav is omitted and moves users/API keys to the account menu', () => {
    const nav = resolveArrangement({ visible, adminRoute, account })
    expect(nav.areas.map((a) => a.label)).toEqual(['Website', 'News', 'Library', 'Collections'])
    expect(nav.areas[0]!.links.map((l) => l.href)).toEqual(['/admin/collections/pages', '/admin/globals/site-settings'])
    expect(nav.account.map((l) => l.label)).toEqual(['Users', 'MCP API keys'])
  })

  test('honours an explicit arrangement, labels, queries and view links; unplaced goes under More', () => {
    const nav = resolveArrangement({
      visible,
      adminRoute,
      account,
      arrangement: [
        { label: 'Website', icon: 'globe', links: ['pages', { to: 'site-settings', label: 'Settings' }, { to: 'pages', label: 'Drafts', query: 'where[_status][equals]=draft' }] },
        { label: 'Tools', links: [{ to: 'view:/reports', label: 'Reports' }, 'users'] },
        { label: 'Empty', links: ['nothing-here'] },
      ],
    })
    expect(nav.areas.map((a) => a.label)).toEqual(['Website', 'Tools', 'More'])
    const website = nav.areas[0]!
    expect(website.icon).toBe('globe')
    expect(website.links.map((l) => [l.label, l.href])).toEqual([
      ['Pages', '/admin/collections/pages'],
      ['Settings', '/admin/globals/site-settings'],
      ['Drafts', '/admin/collections/pages?where[_status][equals]=draft'],
    ])
    // users never lands in the sidebar, even when an arrangement names it
    expect(nav.areas[1]!.links.map((l) => l.href)).toEqual(['/admin/reports'])
    expect(nav.areas[2]!.links.map((l) => l.label)).toEqual(['Posts', 'Media', 'People'])
    expect(nav.areas[2]!.icon).toBe('ellipsis')
  })

  test('a global and a collection sharing a slug can be told apart with a kind prefix', () => {
    const both = [c('settings', 'Settings docs'), g('settings', 'Settings')]
    const nav = resolveArrangement({
      visible: both,
      adminRoute,
      account: { users: 'users', apiKeys: [] },
      arrangement: [{ label: 'A', links: ['globals:settings'] }],
    })
    expect(nav.areas[0]!.links[0]!.href).toBe('/admin/globals/settings')
    expect(nav.areas[1]!.label).toBe('More')
    expect(nav.areas[1]!.links[0]!.href).toBe('/admin/collections/settings')
  })

  test('nothing visible means nothing drawn', () => {
    const nav = resolveArrangement({ visible: [], adminRoute, account: { users: 'users', apiKeys: [] } })
    expect(nav).toEqual({ areas: [], account: [] })
  })

  test('guesses an icon from the area label when none is given or known', () => {
    expect(resolveIcon(undefined, 'Media library')).toBe('image')
    expect(resolveIcon('no-such-icon', 'Team')).toBe('users')
    expect(resolveIcon('calendar', 'Anything')).toBe('calendar')
    expect(iconForArea('Zebras')).toBe('folder')
  })
})

describe('accountSlugs', () => {
  test('finds API-key collections by slug or auth.useAPIKey, never the users collection', () => {
    const out = accountSlugs(
      [{ slug: 'users', auth: { useAPIKey: true } }, { slug: 'payload-mcp-api-keys' }, { slug: 'bots', auth: { useAPIKey: true } }, { slug: 'pages' }],
      'users',
    )
    expect(out).toEqual({ users: 'users', apiKeys: ['payload-mcp-api-keys', 'bots'] })
  })
})

describe('helpers', () => {
  test('labelText', () => {
    expect(labelText('Pages')).toBe('Pages')
    expect(labelText({ en: 'Pages', de: 'Seiten' }, 'de')).toBe('Seiten')
    expect(labelText({ fr: 'Pages' }, 'de')).toBe('Pages')
    expect(labelText(() => 'x')).toBe('')
  })

  test('joinAdmin', () => {
    expect(joinAdmin('/admin', '/collections/pages')).toBe('/admin/collections/pages')
    expect(joinAdmin('/admin/', 'collections/pages')).toBe('/admin/collections/pages')
    expect(joinAdmin('', '/x')).toBe('/x')
  })

  test('isActive matches the page or anything under it, and filtered links only with their filter', () => {
    expect(isActive('/admin/collections/pages', '/admin/collections/pages')).toBe(true)
    expect(isActive('/admin/collections/pages/12', '/admin/collections/pages')).toBe(true)
    expect(isActive('/admin/collections/pages-two', '/admin/collections/pages')).toBe(false)
    const filtered = '/admin/collections/pages?where[site][equals]=law'
    expect(isActive('/admin/collections/pages', filtered, 'where%5Bsite%5D%5Bequals%5D=law&limit=10')).toBe(true)
    expect(isActive('/admin/collections/pages', filtered, '')).toBe(false)
  })

  test('countFilters counts where[...] keys only', () => {
    expect(countFilters('?where[a][equals]=1&where[or][0][b][in]=2&search=x&limit=10')).toBe(2)
    expect(countFilters('search=x')).toBe(0)
  })

  test('parseEditPath', () => {
    expect(parseEditPath('/admin', '/admin/collections/pages/42')).toEqual({ slug: 'pages', id: '42' })
    expect(parseEditPath('/admin', '/admin/collections/pages/create')).toBeNull()
    expect(parseEditPath('/admin', '/admin/collections/pages/board')).toBeNull()
    expect(parseEditPath('/admin', '/admin/collections/pages')).toBeNull()
    expect(parseEditPath('/admin', '/admin/collections/pages/42/versions')).toBeNull()
    expect(parseEditPath('/admin', '/admin/globals/site')).toBeNull()
  })

  test('pushRecent dedupes by href, newest first, capped', () => {
    const d = (id: string): RecentDoc => ({ href: `/admin/collections/pages/${id}`, title: id, collectionSlug: 'pages', id, at: 0 })
    let list: RecentDoc[] = []
    for (const id of ['1', '2', '3', '1']) list = pushRecent(list, d(id), 2)
    expect(list.map((x) => x.id)).toEqual(['1', '3'])
  })

  test('initialsOf', () => {
    expect(initialsOf('Ada Lovelace', 'ada@x.io')).toBe('AL')
    expect(initialsOf(undefined, 'john.yoder@x.io')).toBe('JY')
    expect(initialsOf('', 'bo@x.io')).toBe('BO')
  })

  test('placeOf picks the most specific link', () => {
    const nav = resolveArrangement({
      visible,
      adminRoute,
      account,
      arrangement: [{ label: 'Website', links: ['pages', { to: 'pages', label: 'Drafts', query: 'where[_status][equals]=draft' }] }],
    })
    expect(placeOf(nav.areas, '/admin/collections/pages/9', '')).toEqual({ area: 'Website', label: 'Pages' })
    expect(placeOf(nav.areas, '/admin/collections/pages', 'where[_status][equals]=draft')).toEqual({ area: 'Website', label: 'Drafts' })
    expect(placeOf(nav.areas, '/admin', '')).toBeNull()
  })
})
