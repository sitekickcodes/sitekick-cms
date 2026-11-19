import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readGlobalGuides, renderGlobalGuides } from '../../scripts/build-guides'
import { blockGuides, globalGuides, guidesFor, guidesPrompt, mergeGuides, parseGuide, readGuidesTool } from './index'
import { execTool } from '../testing/stub-payload'
import { loadGuides, loadSiteGuides } from './site'

describe('global guides', () => {
  test('src/guides/global.ts is up to date with skills/ (run `bun run guides`)', () => {
    expect(readFileSync(join(import.meta.dir, 'global.ts'), 'utf8')).toBe(renderGlobalGuides(readGlobalGuides()))
  })

  test('every guide has a description, and the always-on set stays short', () => {
    for (const g of globalGuides) expect(g.description.length).toBeGreaterThan(10)
    const always = guidesFor('edit').filter((g) => g.load === 'always')
    expect(always.map((g) => g.name)).toContain('core')
    // Always-on guides ride along on every run; keep them to a few thousand characters.
    expect(always.reduce((n, g) => n + g.body.length, 0)).toBeLessThan(6_000)
  })
})

describe('parseGuide', () => {
  test('frontmatter, list values, comments and defaults', () => {
    const g = parseGuide('ux/x', '---\ndescription: Short one\nload: always # note\nagents: [edit, draft]\n---\n<!-- for people -->\n# Title\n\nBody text.\n', 'global')
    expect(g).toEqual({ name: 'ux/x', description: 'Short one', load: 'always', agents: ['edit', 'draft'], source: 'global', body: '# Title\n\nBody text.' })
    const plain = parseGuide('brand', '# Brand of Acme\n\nBlue.', 'site', { load: 'always' })
    expect(plain.description).toBe('Brand of Acme')
    expect(plain.load).toBe('always')
  })
})

describe('merging and prompting', () => {
  const site = [
    parseGuide('writing/voice', '# Voice\n\nCasual and warm.', 'site', { load: 'always' }),
    parseGuide('brand', '# Brand\n\nTeal.', 'site', { load: 'always' }),
    parseGuide('blocks/hero', 'Always left-aligned.', 'site'),
  ]

  test('a site guide replaces the global one of the same name', () => {
    const merged = mergeGuides(globalGuides, site)
    const voice = merged.filter((g) => g.name === 'writing/voice')
    expect(voice).toHaveLength(1)
    expect(voice[0]!.source).toBe('site')
    expect(merged.some((g) => g.name === 'brand')).toBe(true)
  })

  test('agent filter and block notes', () => {
    const merged = mergeGuides(globalGuides, site)
    expect(guidesFor('draft', merged).some((g) => g.name === 'design/composition')).toBe(false)
    expect(guidesFor('edit', merged).some((g) => g.name === 'design/composition')).toBe(true)
    expect(guidesFor('edit', merged).some((g) => g.name.startsWith('blocks/'))).toBe(false)
    expect(blockGuides(merged)).toEqual({ hero: 'Always left-aligned.' })
  })

  test('the prompt carries always-on guides, site ones last, and lists the rest', () => {
    const prompt = guidesPrompt(guidesFor('edit', mergeGuides(globalGuides, site)))
    expect(prompt).toContain('## core')
    expect(prompt).toContain('## brand (this site)')
    expect(prompt.indexOf('## brand (this site)')).toBeGreaterThan(prompt.indexOf('## core'))
    expect(prompt).toContain('- ux/calls-to-action: ')
    expect(prompt).not.toContain('Prefer images from the site') // imagery is on demand
    expect(guidesPrompt([])).toBe('')
  })

  test('read_guides returns bodies and names unknown guides', async () => {
    const tools = readGuidesTool(guidesFor('edit'))
    const out = (await execTool(tools.read_guides, { names: ['ux/calls-to-action', 'nope'] })) as { guides: { name: string }[]; unknown?: string[] }
    expect(out.guides.map((g) => g.name)).toEqual(['ux/calls-to-action'])
    expect(out.unknown).toEqual(['nope'])
    expect(readGuidesTool([])).toEqual({})
  })
})

describe('loadSiteGuides', () => {
  test('top level always, subfolders on demand, readme skipped, missing folder empty', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guides-'))
    mkdirSync(join(dir, 'blocks'))
    writeFileSync(join(dir, 'README.md'), '# How to write these')
    writeFileSync(join(dir, 'brand.md'), '# Brand\n\nTeal and calm.')
    writeFileSync(join(dir, 'blocks', 'cta.md'), 'One per page.')
    writeFileSync(join(dir, 'voice.md'), '# Voice\n\n<!-- Write how the site sounds. -->\n')
    const guides = await loadSiteGuides(dir)
    expect(guides.map((g) => [g.name, g.load, g.source])).toEqual([
      ['blocks/cta', 'on-demand', 'site'],
      ['brand', 'always', 'site'],
    ])
    expect(await loadSiteGuides(join(dir, 'missing'))).toEqual([])
    expect((await loadGuides(dir)).length).toBe(globalGuides.length + 2)
  })
})
