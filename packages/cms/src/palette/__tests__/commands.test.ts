import { describe, expect, test } from 'bun:test'

import { buildCommands, docCommand, rank, score, searchURL, searchWhere, searchable, type PaletteCollection } from '../commands'

const posts: PaletteCollection = { slug: 'posts', labels: { singular: 'Post', plural: 'News' }, useAsTitle: 'title', listSearchableFields: ['title', 'excerpt'], canRead: true, canCreate: true }
const media: PaletteCollection = { slug: 'media', labels: { singular: 'Image', plural: 'Media' }, useAsTitle: 'filename', canRead: true, canCreate: true, isUpload: true }
const users: PaletteCollection = { slug: 'users', labels: { singular: 'User', plural: 'Users' }, useAsTitle: 'email', canRead: false, canCreate: false, isAuth: true }

const input = {
  adminRoute: '/admin',
  collections: [posts, media, users],
  globals: [{ slug: 'site-settings', label: 'Site settings', canRead: true }],
  views: [{ path: '/inbox', label: 'Inbox' }],
  accountPath: '/account',
  logoutPath: '/logout',
  help: true,
}

describe('buildCommands', () => {
  const cmds = buildCommands(input)
  test('hides what the person cannot read or create', () => {
    expect(cmds.find((c) => c.id === 'go:users')).toBeUndefined()
    expect(cmds.find((c) => c.id === 'create:users')).toBeUndefined()
  })
  test('uploads say upload, others say new', () => {
    expect(cmds.find((c) => c.id === 'create:media')?.label).toBe('Upload image')
    expect(cmds.find((c) => c.id === 'create:posts')?.label).toBe('New post')
  })
  test('views, globals, help and account are present with admin hrefs', () => {
    expect(cmds.find((c) => c.id === 'go:view:/inbox')?.href).toBe('/admin/inbox')
    expect(cmds.find((c) => c.id === 'go:global:site-settings')?.href).toBe('/admin/globals/site-settings')
    expect(cmds.find((c) => c.id === 'act:help')?.event).toBe('sitekick:help:open')
    expect(cmds.find((c) => c.id === 'act:logout')?.href).toBe('/admin/logout')
  })
})

describe('rank', () => {
  const cmds = buildCommands(input)
  test('empty query keeps order', () => {
    expect(rank(cmds, '').map((c) => c.id).slice(0, 2)).toEqual(['go:dashboard', 'go:view:/inbox'])
  })
  test('prefix beats keyword match', () => {
    const ids = rank(cmds, 'new post').map((c) => c.id)
    expect(ids[0]).toBe('create:posts')
  })
  test('every word must match', () => {
    expect(score({ id: 'x', label: 'Site settings', group: 'Go to' }, 'site zzz')).toBeNull()
    expect(score({ id: 'x', label: 'Site settings', group: 'Go to' }, 'settings site')).toBe(3)
  })
})

describe('document search', () => {
  test('only readable collections with a title are searched', () => {
    expect(searchable([posts, media, users]).map((c) => c.slug)).toEqual(['posts', 'media'])
  })
  test('where spans title and searchable fields once each', () => {
    expect(searchWhere(posts, 'park')).toEqual({ or: [{ title: { like: 'park' } }, { excerpt: { like: 'park' } }] })
    expect(searchWhere(media, 'park')).toEqual({ filename: { like: 'park' } })
  })
  test('url carries limit, depth and where', () => {
    const url = new URL(searchURL('/api', media, 'park'), 'http://x')
    expect(url.pathname).toBe('/api/media')
    expect(url.searchParams.get('depth')).toBe('0')
    expect(JSON.parse(url.searchParams.get('where') ?? '')).toEqual({ filename: { like: 'park' } })
  })
  test('doc row falls back to the id', () => {
    expect(docCommand('/admin', posts, { id: 7, title: '  ' }).label).toBe('#7')
    expect(docCommand('/admin', posts, { id: 7, title: 'Hello' }).href).toBe('/admin/collections/posts/7')
  })
})
