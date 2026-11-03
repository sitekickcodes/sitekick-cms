import { describe, expect, test } from 'bun:test'

import { contractCatalog, contractFromConfig, readContract } from '../contract'
import { Inbox, People, Posts, SiteSettings, sampleConfig } from './fixture'

describe('readContract', () => {
  test('applies the declared contract and marks drafts', () => {
    const c = readContract(Posts, 'collection')
    expect(c).toMatchObject({
      slug: 'posts',
      kind: 'collection',
      label: 'News',
      description: 'A news post shown on /news. Drafts-enabled.',
      writable: ['title', 'excerpt', 'body'],
      fillEmptyOnly: ['excerpt'],
      review: 'required',
      notes: 'Never publish.',
      private: false,
      drafts: true,
      titleField: 'title',
      pathPrefix: '/news',
    })
  })
  test('defaults: admin description, read-only, review required, /<slug> prefix', () => {
    const c = readContract(People)
    expect(c).toMatchObject({ kind: 'collection', description: 'People', writable: [], review: 'required', private: false, drafts: false, pathPrefix: '/people' })
    expect(c.notes).toBeUndefined()
  })
  test('falls back to admin.description before the label', () => {
    const c = readContract({ ...Posts, custom: {} })
    expect(c.description).toBe('Shown on /news. Drafts-enabled.')
  })
  test('lists top-level fields through rows, excluding hidden ones', () => {
    const names = readContract(Posts).fields.map((f) => f.name)
    expect(names).toEqual(['title', 'slug', 'excerpt', 'body', 'meta'])
    expect(readContract(Posts).fields[0]).toEqual({ name: 'title', type: 'text', required: true })
  })
  test('honours private', () => {
    expect(readContract(Inbox).private).toBe(true)
  })
  test('infers globals from label and keeps their contract', () => {
    expect(readContract(SiteSettings)).toMatchObject({ kind: 'global', label: 'Site settings', writable: ['tagline'], review: 'none' })
  })
})

describe('contractCatalog', () => {
  test('covers every collection and global', () => {
    const catalog = contractCatalog(sampleConfig())
    expect(catalog.map((c) => `${c.kind}:${c.slug}`)).toEqual([
      'collection:posts', 'collection:people', 'collection:inbox', 'collection:users', 'global:site-settings',
    ])
  })
  test('contractFromConfig prefers the stored catalog', () => {
    const stored = [{ slug: 'x' }]
    expect(contractFromConfig({ ...sampleConfig(), custom: { sitekick: { contract: stored } } })).toBe(stored as never)
    expect(contractFromConfig(sampleConfig())).toHaveLength(5)
  })
})
