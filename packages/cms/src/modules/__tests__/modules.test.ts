import { describe, expect, test } from 'bun:test'
import type { Block, CollectionConfig, Config } from 'payload'

import { buildCommands } from '../../palette/commands'
import { sitekickCMS } from '../../plugin'
import { applyModules, defineModule, navWithModules, seedHelp } from '../index'

const pages: CollectionConfig = { slug: 'pages', versions: { drafts: true }, fields: [{ name: 'title', type: 'text' }, { name: 'slug', type: 'text' }, { name: 'layout', type: 'blocks', blocks: [{ slug: 'hero', fields: [] }] }] }
const upcoming: Block = { slug: 'upcomingEvents', fields: [{ name: 'heading', type: 'text' }] }
const events = defineModule({
  name: 'events',
  collections: [{ slug: 'events', versions: { drafts: true }, fields: [{ name: 'title', type: 'text' }, { name: 'slug', type: 'text' }] }],
  blocks: [upcoming],
  nav: { label: 'Events', icon: 'calendar', links: ['events'] },
  dashboard: [{ key: 'coming-up', title: 'Coming up', Component: '/modules/events/admin/ComingUp#ComingUp' }],
  commands: [{ label: 'Upcoming events', href: '/collections/events?sort=startsAt' }],
  help: [{ slug: 'adding-an-event', title: 'Adding an event', topic: 'Events', body: { root: {} } }],
})
const base = { collections: [pages], globals: [] } as unknown as Config

describe('applyModules', () => {
  test('adds collections, and sections to every layout', () => {
    const { config, contributions } = applyModules(base, [events])
    expect(config.collections!.map((c) => c.slug)).toEqual(['pages', 'events'])
    const layout = config.collections![0]!.fields.find((f) => 'name' in f && f.name === 'layout') as { blocks: Block[] }
    expect(layout.blocks.map((b) => b.slug)).toEqual(['hero', 'upcomingEvents'])
    expect(contributions.helpTopics).toEqual(['Events'])
    expect(contributions.cards.map((c) => c.key)).toEqual(['coming-up'])
    // The input is untouched.
    expect((pages.fields[2] as { blocks: Block[] }).blocks).toHaveLength(1)
  })

  test('fields for an existing collection are appended; clashes and unknown collections stop the build', () => {
    const dept = defineModule({ name: 'dept', fields: { pages: [{ name: 'department', type: 'text' }] } })
    const { config } = applyModules(base, [dept])
    expect(config.collections![0]!.fields.map((f) => ('name' in f ? f.name : f.type))).toEqual(['title', 'slug', 'layout', 'department'])
    expect(() => applyModules(base, [defineModule({ name: 'x', fields: { pages: [{ name: 'title', type: 'text' }] } })])).toThrow('pages already has a field "title"')
    expect(() => applyModules(base, [defineModule({ name: 'x', fields: { nope: [] } })])).toThrow('no collection "nope"')
  })

  test('a clashing slug or a missing target field stops the build', () => {
    expect(() => applyModules(base, [defineModule({ name: 'dupe', collections: [{ slug: 'pages', fields: [] }] })])).toThrow('Module "dupe": a collection "pages" already exists')
    expect(() => applyModules(base, [defineModule({ name: 'x', blocks: [upcoming], into: { pages: 'sections' } })])).toThrow('pages has no blocks field "sections"')
  })

  test('nav: a module area is added unless the site placed its links', () => {
    const nav = [{ label: 'Website', links: ['pages'] }]
    expect(navWithModules(nav, [events])!.map((a) => a.label)).toEqual(['Website', 'Events'])
    expect(navWithModules([...nav, { label: 'Calendar', links: ['events'] }], [events])!.map((a) => a.label)).toEqual(['Website', 'Calendar'])
    expect(navWithModules(undefined, [events])).toBeUndefined()
  })
})

describe('sitekickCMS with modules', () => {
  const out = sitekickCMS({ site: { name: 'Acme' }, modules: [events], nav: [{ label: 'Website', links: ['pages'] }] })(base) as Config

  test('module collections get the conventions: slugs and the board', () => {
    const ev = out.collections!.find((c) => c.slug === 'events')!
    expect(ev.hooks?.beforeValidate?.length).toBeGreaterThan(0)
    expect(ev.admin?.components?.views?.board).toBeDefined()
    expect(ev.enableQueryPresets).toBe(true)
  })

  test('cards, commands and help topics reach the dashboard, palette and help', () => {
    const dashboard = out.admin!.components!.views!.dashboard as { Component: { serverProps: { cards: { key: string }[] } } }
    expect(dashboard.Component.serverProps.cards.map((c) => c.key)).toEqual(['coming-up'])
    const palette = (out.admin!.custom as { sitekick: { palette: { commands: unknown[] } } }).sitekick.palette
    expect(palette.commands).toHaveLength(1)
    const help = out.collections!.find((c) => c.slug === 'help-articles')!
    const topic = help.fields.find((f) => 'name' in f && f.name === 'topic') as { options: string[] }
    expect(topic.options).toContain('Events')
    expect(typeof out.onInit).toBe('function')
  })

  test('palette: a module command goes under its group, relative to the admin', () => {
    const commands = buildCommands({ adminRoute: '/admin', collections: [], globals: [], views: [], accountPath: '/account', logoutPath: '/logout', help: false, extra: [{ label: 'Upcoming events', href: '/collections/events?sort=startsAt' }, { label: 'Tickets', href: 'https://tickets.example', group: 'Actions' }] })
    expect(commands.find((c) => c.label === 'Upcoming events')).toMatchObject({ group: 'Go to', href: '/admin/collections/events?sort=startsAt' })
    expect(commands.find((c) => c.label === 'Tickets')).toMatchObject({ group: 'Actions', href: 'https://tickets.example' })
  })
})

describe('seedHelp', () => {
  const fake = (existing: string[]) => {
    const created: string[] = []
    const payload = {
      collections: { 'help-articles': {} },
      find: async () => ({ docs: existing.map((slug) => ({ slug })) }),
      create: async ({ data }: { data: { slug: string; _status: string } }) => {
        expect(data._status).toBe('published')
        created.push(data.slug)
      },
      logger: { info: () => {}, warn: () => {} },
    }
    return { payload: payload as never, created }
  }
  const articles = events.help!

  test('creates only the articles that are missing, and leaves the rest to the site', async () => {
    const fresh = fake([])
    expect(await seedHelp(fresh.payload, articles)).toBe(1)
    expect(fresh.created).toEqual(['adding-an-event'])
    const edited = fake(['adding-an-event'])
    expect(await seedHelp(edited.payload, articles)).toBe(0)
  })

  test('a database without the table yet is a warning, not a crash', async () => {
    const warned: string[] = []
    const payload = { collections: { 'help-articles': {} }, find: async () => { throw new Error('relation "help_articles" does not exist') }, logger: { warn: (m: string) => warned.push(m) } }
    expect(await seedHelp(payload as never, articles)).toBe(0)
    expect(warned[0]).toContain('next start')
  })
})
