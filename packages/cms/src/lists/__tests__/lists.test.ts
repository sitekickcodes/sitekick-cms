import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, Config } from 'payload'

import { BOARD_COMPONENTS, BOARD_PATH, listsPlugin } from '../index'

const posts: CollectionConfig = {
  slug: 'posts',
  versions: { drafts: true },
  fields: [{ name: 'title', type: 'text' }],
  admin: { components: { views: { list: { actions: ['./Draft#Button'] } } } },
}
const people: CollectionConfig = { slug: 'people', fields: [{ name: 'name', type: 'text' }] }
const internal: CollectionConfig = { slug: 'internal', versions: { drafts: true }, admin: { hidden: true }, fields: [] }
const own: CollectionConfig = { slug: 'own', enableQueryPresets: false, versions: { drafts: true }, admin: { components: { views: { board: { Component: './Mine#Board', path: '/board' } } } }, fields: [] }
const config = { collections: [posts, people, internal, own] } as Config
const run = (options: Parameters<typeof listsPlugin>[0]) => (listsPlugin(options)(config) as Config).collections!

describe('listsPlugin', () => {
  test('saved views on every sidebar collection that has not chosen', () => {
    const [p, pe, i, o] = run({})
    expect(p!.enableQueryPresets).toBe(true)
    expect(pe!.enableQueryPresets).toBe(true)
    expect(i!.enableQueryPresets).toBeUndefined()
    expect(o!.enableQueryPresets).toBe(false)
  })

  test('a board and its button on collections with drafts, after existing actions', () => {
    const [p, pe, i, o] = run({})
    expect(p!.admin?.components?.views?.board).toEqual({ Component: BOARD_COMPONENTS.view, path: BOARD_PATH, exact: true })
    expect(p!.admin?.components?.views?.list?.actions).toEqual(['./Draft#Button', { path: BOARD_COMPONENTS.link, clientProps: { collection: 'posts' } }])
    expect(pe!.admin?.components?.views?.board).toBeUndefined()
    expect(i!.admin?.components?.views).toBeUndefined()
    expect(o!.admin?.components?.views?.board).toEqual({ Component: './Mine#Board', path: '/board' })
    expect(o!.admin?.components?.views?.list).toBeUndefined()
  })

  test('both switch off', () => {
    const [p] = run({ savedViews: false, board: false })
    expect(p).toBe(posts)
  })
})
