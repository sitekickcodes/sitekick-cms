import { describe, expect, test } from 'bun:test'

import { blockSlugs, createBlocks, layoutField, validateLayout } from '../index'
import { blockComponents } from '../react/render-blocks'

describe('block library', () => {
  test('every slug is unique and matches the published list', () => {
    const slugs = createBlocks().map((block) => block.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toEqual([...blockSlugs])
  })

  test('every block has a renderer', () => {
    for (const block of createBlocks()) {
      expect(blockComponents).toHaveProperty(block.slug)
    }
    expect(Object.keys(blockComponents).sort()).toEqual([...blockSlugs].sort())
  })

  test('collection slugs are configurable', () => {
    const blocks = createBlocks({ media: 'images', pages: 'articles' })
    const hero = blocks.find((block) => block.slug === 'hero')
    const image = hero?.fields.find((field) => 'name' in field && field.name === 'image')
    expect(image && 'relationTo' in image ? image.relationTo : null).toBe('images')
    const buttons = hero?.fields.find((field) => 'name' in field && field.name === 'buttons')
    const page = buttons && 'fields' in buttons ? buttons.fields.find((f) => 'name' in f && f.name === 'page') : undefined
    expect(page && 'relationTo' in page ? page.relationTo : null).toBe('articles')
  })
})

describe('layoutField', () => {
  test('is a blocks field named layout with Section labels', () => {
    const field = layoutField()
    expect(field.type).toBe('blocks')
    expect('name' in field && field.name).toBe('layout')
    expect('label' in field && field.label).toBe('Sections')
    expect('labels' in field && field.labels).toEqual({ singular: 'Section', plural: 'Sections' })
    expect(field.admin && 'initCollapsed' in field.admin && field.admin.initCollapsed).toBe(true)
  })

  test('allows at most one hero', () => {
    expect(validateLayout(undefined)).toBe(true)
    expect(validateLayout([{ blockType: 'hero' }, { blockType: 'cta' }])).toBe(true)
    expect(validateLayout([{ blockType: 'hero' }, { blockType: 'richText' }, { blockType: 'hero' }])).toBe(
      'A page can only have one Hero.',
    )
  })
})
