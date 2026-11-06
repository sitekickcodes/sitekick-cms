import { describe, expect, test } from 'bun:test'
import type { ArrayField, Block, Field } from 'payload'

import { BLOCK_ROW_LABEL, ROW_LABEL, withRowLabels } from '../rowLabels'

const rowLabel = (field: Field) => (field as ArrayField).admin?.components?.RowLabel

describe('withRowLabels', () => {
  test('labels arrays at every nesting level, keeping existing labels', () => {
    const fields: Field[] = [
      { name: 'team', type: 'array', labels: { singular: 'Person', plural: 'People' }, fields: [{ name: 'name', type: 'text' }] },
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Links',
            fields: [
              {
                type: 'row',
                fields: [
                  {
                    name: 'links',
                    type: 'array',
                    admin: { components: { RowLabel: '@/custom#Label' } },
                    fields: [{ name: 'faqs', type: 'array', fields: [{ name: 'question', type: 'text' }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'list', fields: [{ name: 'items', type: 'array', fields: [{ name: 'title', type: 'text' }] }] }],
      },
    ]
    const out = withRowLabels(fields)

    expect(rowLabel(out[0]!)).toEqual({ path: ROW_LABEL, clientProps: { fallback: 'Person', choices: {} } })

    const tabs = out[1] as Extract<Field, { type: 'tabs' }>
    const row = tabs.tabs[0]!.fields[0] as Extract<Field, { type: 'row' }>
    const links = row.fields[0] as ArrayField
    expect(links.admin?.components?.RowLabel).toBe('@/custom#Label')
    expect(rowLabel(links.fields[0]!)).toEqual({ path: ROW_LABEL, clientProps: { fallback: 'Faqs', choices: {} } })

    const blocks = out[2] as Extract<Field, { type: 'blocks' }>
    expect(rowLabel((blocks.blocks[0] as Block).fields[0]!)).toEqual({ path: ROW_LABEL, clientProps: { fallback: 'Items', choices: {} } })
  })

  test('blocks get a section header with their type, unless they bring a Label', () => {
    const fields: Field[] = [
      {
        name: 'layout',
        type: 'blocks',
        blocks: [
          { slug: 'imageText', labels: { singular: 'Image + text', plural: 'Image + text' }, fields: [] },
          { slug: 'cta', fields: [] },
          { slug: 'own', admin: { components: { Label: '@/custom#Own' } }, fields: [] },
        ],
      },
    ]
    const [a, b, c] = (withRowLabels(fields)[0] as Extract<Field, { type: 'blocks' }>).blocks as Block[]
    expect(a!.admin?.components?.Label).toEqual({ path: BLOCK_ROW_LABEL, clientProps: { blockLabel: 'Image + text' } })
    expect(b!.admin?.components?.Label).toEqual({ path: BLOCK_ROW_LABEL, clientProps: { blockLabel: 'Cta' } })
    expect(c!.admin?.components?.Label).toBe('@/custom#Own')
  })

  test('does not mutate the input', () => {
    const fields: Field[] = [{ name: 'team', type: 'array', fields: [] }]
    withRowLabels(fields)
    expect(rowLabel(fields[0]!)).toBeUndefined()
  })
})
