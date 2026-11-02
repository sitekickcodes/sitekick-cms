import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, Field } from 'payload'

import { autoSlug, nextFreeSlug, slugify } from '../../hooks/autoSlug'
import { withAutoSlug } from '../slugs'

const fakeReq = (taken: string[]) =>
  ({ payload: { find: async () => ({ docs: taken.map((slug) => ({ slug })) }) } }) as unknown as Parameters<ReturnType<typeof autoSlug>>[0]['req']

const run = (data: Record<string, unknown>, taken: string[] = [], originalDoc?: Record<string, unknown>) =>
  autoSlug({ from: 'title' })({
    data,
    originalDoc,
    req: fakeReq(taken),
    collection: { slug: 'posts' },
    operation: 'create',
    context: {},
  } as unknown as Parameters<ReturnType<typeof autoSlug>>[0])

describe('slugify / nextFreeSlug', () => {
  test('makes a URL-safe slug', () => {
    expect(slugify('  Reform the Rules! Déjà vu ')).toBe('reform-the-rules-deja-vu')
  })
  test('numbers copies -2, -3', () => {
    expect(nextFreeSlug('about', [])).toBe('about')
    expect(nextFreeSlug('about', ['about'])).toBe('about-2')
    expect(nextFreeSlug('about', ['about', 'about-2', 'about-us'])).toBe('about-3')
  })
})

describe('autoSlug', () => {
  test('fills a blank slug from the title and dedupes', async () => {
    expect(await run({ title: 'Hello World' })).toMatchObject({ slug: 'hello-world' })
    expect(await run({ title: 'Hello World' }, ['hello-world'])).toMatchObject({ slug: 'hello-world-2' })
  })
  test('tidies a typed slug and keeps an existing one over the title', async () => {
    expect(await run({ title: 'New title', slug: 'Old Slug' })).toMatchObject({ slug: 'old-slug' })
    expect(await run({ title: 'New title' }, [], { slug: 'kept', id: 1 })).toMatchObject({ slug: 'kept' })
  })
  test('leaves a fresh draft without title alone', async () => {
    expect(await run({ body: 'x' })).toEqual({ body: 'x' })
  })
})

describe('withAutoSlug walker', () => {
  const posts: CollectionConfig = {
    slug: 'posts',
    fields: [
      { name: 'title', type: 'text' },
      { type: 'row', fields: [{ name: 'slug', type: 'text' }] },
    ],
  }
  test('adds hooks and a description to a slug+title collection', () => {
    const out = withAutoSlug(posts)
    expect(out.hooks?.beforeValidate).toHaveLength(1)
    expect(out.hooks?.afterDelete).toHaveLength(1)
    const row = out.fields[1] as Extract<Field, { type: 'row' }>
    expect((row.fields[0] as Extract<Field, { type: 'text' }>).admin?.description).toContain('Blank = from the title')
    expect(posts.hooks).toBeUndefined() // input untouched
  })
  test('skips collections without a title, and slug fields with their own hooks', () => {
    expect(withAutoSlug({ slug: 'x', fields: [{ name: 'slug', type: 'text' }] }).hooks).toBeUndefined()
    const own: CollectionConfig = {
      slug: 'y',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'slug', type: 'text', hooks: { beforeValidate: [({ value }) => value] } },
      ],
    }
    expect(withAutoSlug(own).hooks).toBeUndefined()
  })
})
