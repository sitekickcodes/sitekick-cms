/**
 * Stages the publishable CLI: `bun build.ts <stage>` (called by scripts/pack.ts).
 *
 *   <stage>/dist/index.js   the CLI, bundled for Node
 *   <stage>/template/       the playground, turned into a generic starter (see src/template.ts)
 *   <stage>/package.json
 */
import { $ } from 'bun'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { toPackaged, toTemplate, type Files } from './src/template'

const stage = resolve(process.argv[2] ?? '.pack')
const root = resolve(import.meta.dir, '../..')
const playground = join(root, 'apps/playground')
const manifest = JSON.parse(readFileSync(join(import.meta.dir, 'package.json'), 'utf8'))

rmSync(stage, { recursive: true, force: true })
await $`bun build src/index.ts --target node --format esm --outfile ${join(stage, 'dist/index.js')}`.cwd(import.meta.dir).quiet()

// Tracked files only: no .env, .next, node_modules or local scratch.
const tracked = (await $`git ls-files`.cwd(playground).text()).split('\n').filter(Boolean)
const source: Files = new Map(tracked.map((path) => [path, readFileSync(join(playground, path), 'utf8')]))
const template = toTemplate(source, { version: manifest.version })
template.set('README.md', readFileSync(join(import.meta.dir, 'files/README.md'), 'utf8'))
for (const [path, text] of template) {
  const file = join(stage, 'template', toPackaged(path))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

const { scripts: _s, devDependencies: _d, ...rest } = manifest
writeFileSync(
  join(stage, 'package.json'),
  JSON.stringify(
    {
      ...rest,
      files: ['dist', 'template'],
      repository: { type: 'git', url: 'git+https://github.com/sitekickcodes/sitekick-cms.git', directory: 'packages/create-sitekick-cms' },
      homepage: 'https://github.com/sitekickcodes/sitekick-cms',
      publishConfig: { access: 'public' },
    },
    null,
    2,
  ) + '\n',
)
console.log(`create-sitekick-cms: ${template.size} template files`)
