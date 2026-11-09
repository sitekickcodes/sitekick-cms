/**
 * Builds the publishable packages and packs them as npm tarballs.
 *
 *   bun scripts/pack.ts                 # all packages, tarballs in ./.pack
 *   bun scripts/pack.ts --out /tmp/tgz  # somewhere else
 *
 * In the monorepo the packages export TypeScript source (the playground transpiles it). A
 * published package has to work in an app that transpiles nothing in node_modules, including
 * Payload's CLI under plain Node, so each one is compiled to ESM JavaScript with declarations.
 * The source keeps extensionless imports; Node's ESM loader needs real paths, so they are
 * rewritten after compiling. `workspace:*` versions become the release version.
 */
import { $ } from 'bun'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const PACKAGES = ['cms', 'blocks', 'agents', 'create-sitekick-cms']

const args = process.argv.slice(2)
const outArg = args.indexOf('--out')
const out = resolve(outArg >= 0 ? args[outArg + 1]! : join(root, '.pack'))
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

type Manifest = Record<string, unknown> & {
  name: string
  version: string
  exports?: Record<string, string>
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const manifests = new Map<string, Manifest>(
  PACKAGES.map((dir) => [dir, JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'))]),
)
const versions = new Map([...manifests.values()].map((m) => [m.name, m.version]))

mkdirSync(out, { recursive: true })
for (const dir of only.length ? only : PACKAGES) {
  const manifest = manifests.get(dir)
  if (!manifest) throw new Error(`Unknown package "${dir}". Known: ${PACKAGES.join(', ')}`)
  const pkg = join(root, 'packages', dir)
  const stage = join(pkg, '.pack')
  rmSync(stage, { recursive: true, force: true })

  if (existsSync(join(pkg, 'build.ts'))) {
    // A package with its own build (the CLI bundles itself and its template).
    await $`bun build.ts ${stage}`.cwd(pkg)
  } else {
    await compile(pkg, join(stage, 'dist'))
    writeFileSync(join(stage, 'package.json'), JSON.stringify(publishManifest(manifest), null, 2) + '\n')
  }
  for (const file of ['README.md']) if (existsSync(join(pkg, file))) cpSync(join(pkg, file), join(stage, file))
  cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'))

  const tgz = (await $`npm pack --silent --pack-destination ${out}`.cwd(stage).text()).trim()
  console.log(`${manifest.name}@${manifest.version} → ${relative(process.cwd(), join(out, tgz))}`)
}

async function compile(pkg: string, dist: string) {
  const tsconfig = join(pkg, 'tsconfig.build.json')
  writeFileSync(
    tsconfig,
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        declaration: true,
        declarationMap: false,
        sourceMap: false,
        rootDir: 'src',
        outDir: dist,
        allowJs: false,
        incremental: false,
      },
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**'],
    }),
  )
  try {
    await $`bunx tsc -p ${tsconfig}`.cwd(pkg)
  } finally {
    rmSync(tsconfig)
  }
  // Stylesheets and CSS modules ride along next to the components that import them.
  for (const file of walk(join(pkg, 'src'))) {
    if (file.endsWith('.css')) {
      const target = join(dist, relative(join(pkg, 'src'), file))
      mkdirSync(dirname(target), { recursive: true })
      cpSync(file, target)
    }
  }
  for (const file of walk(dist)) {
    if (file.endsWith('.js') || file.endsWith('.d.ts')) writeFileSync(file, withExtensions(file, readFileSync(file, 'utf8')))
  }
}

/** `./x` → `./x.js` or `./x/index.js`, whichever exists. Stylesheets and JSON stay as they are. */
function withExtensions(file: string, code: string): string {
  const fix = (spec: string) => {
    if (!spec.startsWith('.') || /\.(js|css|json)$/.test(spec)) return spec
    const base = resolve(dirname(file), spec)
    if (existsSync(`${base}.js`)) return `${spec}.js`
    if (existsSync(join(base, 'index.js'))) return `${spec}/index.js`
    // Unresolvable means it is not a real import (doc comments quote example paths).
    return spec
  }
  return code
    .replace(/(\bfrom\s*['"])([^'"]+)(['"])/g, (_, a, spec, b) => a + fix(spec) + b)
    .replace(/(\bimport\s*\(\s*['"])([^'"]+)(['"]\s*\))/g, (_, a, spec, b) => a + fix(spec) + b)
    .replace(/(\bimport\s+['"])([^'"]+)(['"])/g, (_, a, spec, b) => a + fix(spec) + b)
}

function publishManifest(m: Manifest): Manifest {
  const exports: Record<string, string | { types: string; default: string }> = {}
  for (const [key, target] of Object.entries(m.exports ?? {})) {
    if (target.endsWith('.css')) {
      exports[key] = target.replace(/^\.\/src\//, './dist/')
    } else {
      const js = target.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.js')
      exports[key] = { types: js.replace(/\.js$/, '.d.ts'), default: js }
    }
  }
  const { scripts: _scripts, devDependencies: _dev, ...rest } = m
  return {
    ...rest,
    dependencies: pinWorkspace(m.dependencies),
    peerDependencies: pinWorkspace(m.peerDependencies),
    exports: exports as unknown as Record<string, string>,
    files: ['dist'],
    publishConfig: { access: 'public' },
  }
}

function pinWorkspace(deps?: Record<string, string>) {
  if (!deps) return undefined
  return Object.fromEntries(
    Object.entries(deps).map(([name, range]) => [name, range.startsWith('workspace:') ? versions.get(name) ?? range : range]),
  )
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}
