/**
 * Compile skills/*.md into src/guides/global.ts. The packages publish compiled `src` only,
 * so the kit's guides travel as data. `bun run guides`; a test fails when the output is stale.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { parseGuide, type Guide } from '../src/guides/parse'

const root = join(import.meta.dir, '..')

export function readGlobalGuides(dir = join(root, 'skills')): Guide[] {
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.md') && e.name !== 'README.md' ? [join(d, e.name)] : []))
  return walk(dir)
    .sort()
    .map((file) => parseGuide(relative(dir, file).split(sep).join('/').replace(/\.md$/, ''), readFileSync(file, 'utf8'), 'global'))
}

export function renderGlobalGuides(guides: Guide[]): string {
  return [
    '// Generated from packages/agents/skills by `bun run guides`. Do not edit by hand.',
    "import type { Guide } from './parse'",
    '',
    `export const globalGuides: Guide[] = ${JSON.stringify(guides, null, 2)}`,
    '',
  ].join('\n')
}

if (import.meta.main) {
  const guides = readGlobalGuides()
  writeFileSync(join(root, 'src/guides/global.ts'), renderGlobalGuides(guides))
  console.log(`${guides.length} guides → src/guides/global.ts`)
}
