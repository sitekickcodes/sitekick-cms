/**
 * Publishes the packages to npm: the compiled tarballs `scripts/pack.ts` makes, not the source
 * (in the monorepo the packages export TypeScript; see pack.ts).
 *
 *   bun scripts/release.ts             # pack, then publish every version npm doesn't have yet
 *   bun scripts/release.ts --dry-run   # the same, but npm only reports what it would do
 *
 * Safe to run on every push to main: a version already on npm is skipped, so it only
 * publishes after a "Version packages" PR (Changesets) has moved the version on. A prerelease
 * (`0.2.0-beta.1`) goes out under its tag (`beta`), so `npm install @sitekick/cms` keeps
 * getting the last stable release. In CI it publishes with provenance.
 *
 * Without an npm login (NPM_TOKEN in CI, `npm login` locally) it says so and stops before
 * publishing anything: the @sitekick scope has to exist on npm first. Dry runs need no login.
 */
import { $ } from 'bun'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const dryRun = process.argv.includes('--dry-run')
const PACKAGES = ['cms', 'blocks', 'agents', 'create-sitekick-cms']
const out = join(root, '.pack')

const manifests = PACKAGES.map((dir) => JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')) as { name: string; version: string })

/** Is this exact version already on npm? A 404 (new package or new version) means no. */
async function published(name: string, version: string): Promise<boolean> {
  const res = await $`npm view ${`${name}@${version}`} version --json`.quiet().nothrow()
  return res.exitCode === 0 && res.stdout.toString().trim().length > 0
}

const pending: typeof manifests = []
for (const m of manifests) {
  if (await published(m.name, m.version)) console.log(`✓ ${m.name}@${m.version} is already on npm`)
  else pending.push(m)
}
if (!pending.length) {
  console.log('Nothing to publish.')
  process.exit(0)
}

if (!dryRun) {
  const whoami = await $`npm whoami`.quiet().nothrow()
  if (whoami.exitCode !== 0) {
    console.log(`Not publishing ${pending.map((m) => `${m.name}@${m.version}`).join(', ')}: no npm login (set NPM_TOKEN in CI, or run npm login).`)
    process.exit(0)
  }
}

await $`bun scripts/pack.ts`.cwd(root)
const tarballs = readdirSync(out).filter((f) => f.endsWith('.tgz'))
// pack.ts names tarballs as npm does: @sitekick/cms@1.0.0 → sitekick-cms-1.0.0.tgz.
const tarballOf = (m: { name: string; version: string }) => tarballs.find((f) => f === `${m.name.replace(/^@/, '').replace('/', '-')}-${m.version}.tgz`)

const provenance = process.env.GITHUB_ACTIONS === 'true' && !dryRun ? ['--provenance'] : []
let failed = 0
for (const m of pending) {
  const file = tarballOf(m)
  if (!file) {
    console.error(`✗ ${m.name}@${m.version}: no tarball in .pack`)
    failed++
    continue
  }
  const tag = /-([a-z]+)/i.exec(m.version)?.[1] ?? 'latest'
  const flags = ['--access', 'public', '--tag', tag, ...provenance, ...(dryRun ? ['--dry-run'] : [])]
  console.log(`${dryRun ? '… would publish' : '→ publishing'} ${m.name}@${m.version} (${tag})`)
  const res = await $`npm publish ${join(out, file)} ${flags}`.nothrow()
  if (res.exitCode !== 0) failed++
}
process.exit(failed ? 1 : 0)
