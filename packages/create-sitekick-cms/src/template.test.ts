import { describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { customize, fromPackaged, titleFrom, toPackaged, toTemplate, validAccent, validName, type Files } from './template'

// The real playground, so a change there that the template edits no longer match fails here.
const playgroundDir = resolve(import.meta.dir, '../../../apps/playground')
const playground: Files = new Map(
  execSync('git ls-files', { cwd: playgroundDir, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((path) => [path, readFileSync(join(playgroundDir, path), 'utf8')]),
)
const template = toTemplate(playground, { version: '1.2.3' })
const options = { name: 'acme-site', siteName: "Acme & Co's", description: 'Widgets.', accent: '#c2410c', people: true, events: true }

describe('toTemplate', () => {
  test('leaves out demo scripts, migrations and the playground notes', () => {
    expect(template.has('scripts/migrate.ts')).toBe(true)
    // A new site gets the eval suite, but not the playground's results.
    expect(template.has('scripts/evals.ts')).toBe(true)
    expect(template.has('evals/cases.ts')).toBe(true)
    for (const path of template.keys()) {
      expect(path).not.toMatch(/^scripts\/(seed|agents-live)|^src\/migrations\/|^README\.md$|^AGENTS\.md$|ledger\.jsonl$/)
    }
  })

  test('installs the released packages instead of workspace links', () => {
    const pkg = JSON.parse(template.get('package.json')!)
    expect(pkg.dependencies['@sitekick/cms']).toBe('^1.2.3')
    expect(JSON.stringify(pkg)).not.toContain('workspace:')
    expect(pkg.scripts.dev).toContain('-p 3000')
    expect(JSON.parse(template.get('vercel.json')!).installCommand).not.toContain('../..')
  })

  test('drops monorepo-only config and scans the compiled blocks', () => {
    const next = template.get('next.config.ts')!
    expect(next).not.toContain('transpilePackages')
    expect(next).not.toContain('turbopack')
    expect(template.get('src/app/(frontend)/globals.css')).toContain("@source '../../../node_modules/@sitekick/blocks/dist'")
  })
})

describe('customize', () => {
  test('names the site and sets the brand colour everywhere', () => {
    const files = customize(template, options)
    expect(JSON.parse(files.get('package.json')!).name).toBe('acme-site')
    const site = files.get('src/lib/site.ts')!
    expect(site).toContain("name: 'Acme & Co\\'s'")
    expect(site).toContain("description: 'Widgets.'")
    expect(site).toContain("accent: '#c2410c'")
    for (const path of ['src/app/(frontend)/globals.css', 'src/app/(payload)/custom.css', 'DESIGN.md', 'src/lib/site.ts']) {
      expect(files.get(path)).not.toContain('#0f766e')
    }
  })

  test('without People, nothing refers to the collection', () => {
    const files = customize(template, { ...options, people: false })
    expect(files.has('src/collections/People.ts')).toBe(false)
    for (const [path, text] of files) {
      if (path.endsWith('.ts') && path !== 'src/payload-types.ts') expect(text).not.toMatch(/\bPeople\b|'people'/)
    }
  })

  test('without Events, the module and its routes go and src/modules stays', () => {
    const files = customize(template, { ...options, events: false })
    expect([...files.keys()].filter((p) => /events/.test(p))).toEqual([])
    expect(files.get('src/modules/index.ts')).toContain('export const modules: SiteModule[] = [forms(), redirects()]')
    expect(files.has('src/modules/README.md')).toBe(true)
    for (const [path, text] of files) {
      if (/\.tsx?$/.test(path) && path !== 'src/payload-types.ts') expect(text).not.toMatch(/modules\/events|eventBlocks|'\/events'/)
    }
  })

  test('does not change the template it was given', () => {
    customize(template, { ...options, people: false })
    expect(template.has('src/collections/People.ts')).toBe(true)
  })
})

test('dotfiles survive npm packing', () => {
  expect(toPackaged('.gitignore')).toBe('_gitignore')
  expect(fromPackaged('_gitignore')).toBe('.gitignore')
  expect(fromPackaged('src/_x.ts')).toBe('src/_x.ts')
})

test('names and colours', () => {
  expect(validName('acme-site')).toBeUndefined()
  expect(validName('Acme Site')).toBeString()
  expect(validAccent('#C2410C')).toBeUndefined()
  expect(validAccent('orange')).toBeString()
  expect(titleFrom('@acme/big-site')).toBe('Big Site')
})
