#!/usr/bin/env node
/**
 * bunx create-sitekick-cms my-site
 *
 * Writes a Sitekick CMS site (Payload 4 + Next.js 16, the @sitekick packages) into a new
 * folder, installs it, generates its types, import map and first migration, and commits.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import { customize, fromPackaged, titleFrom, validAccent, validName, type Files } from './template'

const HELP = `Create a Sitekick CMS site.

Usage
  bunx create-sitekick-cms [folder] [options]

Options
  --site-name <name>     Shown in the admin and to agents. Default: from the folder name.
  --description <text>   One sentence about the site, for agents and search.
  --accent <#rrggbb>     Brand colour. Default: #0f766e.
  --no-people            Leave out the People collection (team, authors, partners).
  --database-url <url>   Postgres connection string for .env. Default: blank, set it later.
  --no-install           Write the files only.
  --no-git               Don't create a git repository.
  --packages <dir>       Install @sitekick packages from tarballs in <dir> (for testing a release).
  -y, --yes              Accept the defaults without asking.
  -h, --help             Show this.
`

const DEFAULT_ACCENT = '#0f766e'
const here = dirname(fileURLToPath(import.meta.url))
const templateDir = resolve(here, '../template')

type Args = {
  folder?: string
  siteName?: string
  description?: string
  accent?: string
  people?: boolean
  databaseUrl?: string
  install: boolean
  git: boolean
  packages?: string
  yes: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { install: true, git: true, yes: false }
  const value = (i: number, flag: string) => {
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) fail(`${flag} needs a value.`)
    return v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '-h' || a === '--help') {
      console.log(HELP)
      process.exit(0)
    } else if (a === '-y' || a === '--yes') args.yes = true
    else if (a === '--no-people') args.people = false
    else if (a === '--people') args.people = true
    else if (a === '--no-install') args.install = false
    else if (a === '--no-git') args.git = false
    else if (a === '--site-name') args.siteName = value(i++, a)
    else if (a === '--description') args.description = value(i++, a)
    else if (a === '--accent') args.accent = value(i++, a)
    else if (a === '--database-url') args.databaseUrl = value(i++, a)
    else if (a === '--packages') args.packages = resolve(value(i++, a))
    else if (a.startsWith('-')) fail(`Unknown option ${a}. See --help.`)
    else if (!args.folder) args.folder = a
    else fail(`Unexpected argument ${a}.`)
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const interactive = !args.yes && process.stdin.isTTY
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined
  const ask = async (question: string, fallback: string, check?: (v: string) => string | undefined) => {
    if (!rl) {
      const problem = check?.(fallback)
      if (problem) fail(problem)
      return fallback
    }
    for (;;) {
      const answer = (await rl.question(`${question} ${dim(`(${fallback})`)} `)).trim() || fallback
      const problem = check?.(answer)
      if (!problem) return answer
      console.log(`  ${problem}`)
    }
  }

  console.log(`\n${bold('Sitekick CMS')}\n`)
  const folder = args.folder ?? (await ask('Folder for the new site?', 'my-site'))
  const target = resolve(folder)
  const name = basename(target).toLowerCase()
  const nameProblem = validName(name)
  if (nameProblem) fail(`"${basename(target)}": ${nameProblem}`)
  if (existsSync(target) && readdirSync(target).filter((f) => f !== '.git' && f !== '.DS_Store').length) {
    fail(`${relative(process.cwd(), target) || '.'} is not empty. Pick a new folder.`)
  }

  const siteName = args.siteName ?? (await ask('Site name?', titleFrom(name)))
  const description = args.description ?? (await ask('One sentence about it?', `The ${siteName} website.`))
  const accent = (args.accent ?? (await ask('Brand colour?', DEFAULT_ACCENT, validAccent))).toLowerCase()
  if (args.accent && validAccent(args.accent)) fail(validAccent(args.accent)!)
  const people =
    args.people ?? (rl ? /^y/i.test(await ask('Include People (team, authors, partners)? y/n', 'y')) : true)
  rl?.close()

  const files = customize(readTemplate(), { name, siteName, description, accent, people })
  if (args.packages) usePackageTarballs(files, args.packages)
  writeFiles(target, files)
  writeFileSync(join(target, '.env'), env(args.databaseUrl))
  step(`Wrote ${files.size} files to ${relative(process.cwd(), target) || '.'}`)

  if (args.install) {
    if (!has('bun')) {
      fail('Sitekick CMS sites run on Bun. Install it (https://bun.sh), then run `bun install` in the new folder.')
    }
    run('bun', ['install'], target, 'Installing packages')
    run('bun', ['run', 'generate:importmap'], target, 'Generating the admin import map')
    run('bun', ['run', 'generate:types'], target, 'Generating types')
    run('bun', ['run', 'migrate:create', 'initial'], target, 'Creating the first database migration')
  }
  if (args.git && has('git') && !existsSync(join(target, '.git'))) {
    run('git', ['init', '-q', '-b', 'main'], target)
    run('git', ['add', '-A'], target)
    run('git', ['commit', '-q', '-m', 'Create site with create-sitekick-cms'], target, 'Committing')
  }

  const cd = relative(process.cwd(), target) || '.'
  console.log(`
${bold('Done.')} ${siteName} is in ${cd}.

Next
  cd ${cd}
${args.install ? '' : '  bun install\n  bun run generate:importmap && bun run generate:types\n  bun run migrate:create initial\n'}${args.databaseUrl ? '' : '  Set DATABASE_URL in .env to a Postgres database (a Neon branch works well).\n'}  bun run migrate        create the tables
  bun run dev            http://localhost:3000/admin, create the first user

Deploy on Vercel
  bunx vercel link                         create the project
  bunx vercel integration add neon         Postgres; sets DATABASE_URL
  bunx vercel blob store add media         image storage; sets BLOB_READ_WRITE_TOKEN
  bunx vercel env add PAYLOAD_SECRET       copy it from .env
  bunx vercel env add AUTOSEND_API_KEY     and EMAIL_FROM, so invites are emailed
  bunx vercel --prod

Agents use AI Gateway through the project's OIDC token: run \`bunx vercel env pull .env.local\`
after linking to use them locally.
`)
}

function readTemplate(): Files {
  if (!existsSync(templateDir)) fail(`Template not found at ${templateDir}. Reinstall create-sitekick-cms.`)
  const files: Files = new Map()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else files.set(fromPackaged(relative(templateDir, path)), readFileSync(path, 'utf8'))
    }
  }
  walk(templateDir)
  return files
}

function writeFiles(target: string, files: Files) {
  for (const [path, text] of files) {
    const file = join(target, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

function usePackageTarballs(files: Files, dir: string) {
  const tarballs = readdirSync(dir).filter((f) => f.endsWith('.tgz'))
  const pkg = JSON.parse(files.get('package.json')!)
  for (const dep of Object.keys(pkg.dependencies)) {
    if (!dep.startsWith('@sitekick/')) continue
    const prefix = dep.replace('@', '').replace('/', '-') + '-'
    const tgz = tarballs.filter((f) => f.startsWith(prefix) && /^\d/.test(f.slice(prefix.length))).sort().at(-1)
    if (!tgz) fail(`No ${dep} tarball in ${dir}.`)
    pkg.dependencies[dep] = `file:${join(dir, tgz)}`
  }
  files.set('package.json', JSON.stringify(pkg, null, 2) + '\n')
}

function env(databaseUrl = '') {
  return `# Postgres. On Vercel the Neon integration sets these.
DATABASE_URL=${databaseUrl}
DATABASE_URL_UNPOOLED=
# Signs sessions and API keys. Keep it secret; the deployed site needs the same value.
PAYLOAD_SECRET=${randomBytes(32).toString('hex')}
# Vercel Blob. Without it media is stored on local disk (dev only).
BLOB_READ_WRITE_TOKEN=
# Account email (invites, password resets) through AutoSend. Until both are set, invite links are shown to the admin instead.
AUTOSEND_API_KEY=
# Sender on a domain verified in AutoSend, e.g. "Acme <hello@acme.com>".
EMAIL_FROM=
# Google sign-in (optional): a Google Cloud OAuth web client with redirect URI <site>/api/users/google/callback.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Public URL of this site. Blank = the Vercel production URL, or http://localhost:3000.
NEXT_PUBLIC_SERVER_URL=
`
}

function run(cmd: string, argv: string[], cwd: string, label?: string) {
  if (label) step(label)
  const result = spawnSync(cmd, argv, { cwd, stdio: label ? ['ignore', 'pipe', 'pipe'] : 'ignore', encoding: 'utf8' })
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    fail(`\`${cmd} ${argv.join(' ')}\` failed in ${cwd}.`)
  }
}

function has(cmd: string) {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0
}

function step(text: string) {
  console.log(`${dim('·')} ${text}`)
}

function fail(message: string): never {
  console.error(`\n${message}`)
  process.exit(1)
}

const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s)
const dim = (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s)

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
