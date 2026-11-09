import { describe, expect, test } from 'bun:test'
import type { Config, Field } from 'payload'

import { externalLink, phoneField } from '../../fields'
import { localization, localizeFields } from '../localization'

const localized = (fields: Field[]): string[] => {
  const out: string[] = []
  const walk = (list: Field[], prefix: string) => {
    for (const f of list) {
      const name = 'name' in f ? `${prefix}${f.name}` : prefix
      if ('localized' in f && f.localized) out.push(name)
      if ('fields' in f) walk(f.fields as Field[], 'name' in f ? `${name}.` : prefix)
      if (f.type === 'tabs') for (const t of f.tabs) walk(t.fields, 'name' in t ? `${prefix}${t.name}.` : prefix)
      if (f.type === 'blocks') for (const b of f.blocks) if (typeof b !== 'string') walk(b.fields, `${name}.${b.slug}.`)
    }
  }
  walk(fields, '')
  return out
}

describe('localizeFields', () => {
  test('translates words, shares structure, identifiers and addresses', () => {
    const fields: Field[] = [
      { name: 'title', type: 'text' },
      { name: 'slug', type: 'text' },
      { name: 'code', type: 'text', unique: true },
      { name: 'body', type: 'richText' },
      { name: 'publishedAt', type: 'date' },
      { name: 'author', type: 'relationship', relationTo: 'people' },
      externalLink({ name: 'website' }),
      phoneField({ name: 'phone' }),
      { name: 'kept', type: 'text', localized: false },
      { name: 'skip', type: 'text', custom: { sitekick: { localized: false } } },
      {
        type: 'tabs',
        tabs: [
          { label: 'Content', fields: [{ name: 'intro', type: 'textarea' }] },
          { name: 'meta', fields: [{ name: 'title', type: 'text' }] },
        ],
      },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'hero', fields: [{ name: 'heading', type: 'text' }, { name: 'href', type: 'text' }, { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] }] }, 'shared-block'],
      },
    ]
    expect(localized(localizeFields(fields))).toEqual(['title', 'body', 'intro', 'meta.title', 'layout.hero.heading', 'layout.hero.items.label'])
  })
})

describe('localization', () => {
  const base = {
    collections: [
      { slug: 'pages', fields: [{ name: 'title', type: 'text' }] },
      { slug: 'users', auth: true, fields: [{ name: 'name', type: 'text' }] },
      { slug: 'runs', fields: [{ name: 'title', type: 'text' }] },
      { slug: 'keys', custom: { sitekick: { private: true } }, fields: [{ name: 'title', type: 'text' }] },
    ],
    globals: [{ slug: 'site-settings', fields: [{ name: 'tagline', type: 'text' }] }],
  } as unknown as Config

  test('sets up locales with friendly names and fallback, and translates content collections only', () => {
    const out = localization({ locales: ['en', 'es'] })(base) as Config
    expect(out.localization).toEqual({ locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }], defaultLocale: 'en', fallback: true })
    expect(out.collections!.map((c) => localized(c.fields).length)).toEqual([1, 0, 0, 0])
    expect(localized(out.globals![0]!.fields)).toEqual(['tagline'])
  })

  test('collections narrows the set; a bad default locale is caught', () => {
    const out = localization({ locales: ['en', 'fr'], collections: [], globals: [] })(base) as Config
    expect(out.collections!.every((c) => localized(c.fields).length === 0)).toBe(true)
    expect(() => localization({ locales: ['en'], defaultLocale: 'de' })(base)).toThrow('not in locales')
  })

  test('with the agent buttons on, translated collections get Translate; without, nothing', () => {
    const withAgents = { ...base, admin: { custom: { sitekick: { agents: { basePath: '/api/agents', enrich: [], draft: [], edit: [] } } } } } as unknown as Config
    const out = localization({ locales: ['en', 'fr'] })(withAgents) as Config
    const controls = (slug: string) => out.collections!.find((c) => c.slug === slug)!.admin?.components?.edit?.beforeDocumentControls ?? []
    expect(controls('pages')).toEqual(['@sitekick/cms/admin#TranslateButton'])
    expect(controls('users')).toEqual([])
    expect((out.admin!.custom as { sitekick: { agents: { translate: string[] } } }).sitekick.agents.translate).toEqual(['pages'])
    const off = localization({ locales: ['en', 'fr'] })(base) as Config
    expect(off.collections!.find((c) => c.slug === 'pages')!.admin?.components?.edit).toBeUndefined()
    expect(off.admin).toBeUndefined()
  })
})
