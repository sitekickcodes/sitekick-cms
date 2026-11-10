/**
 * The two text transforms behind `create-sitekick-cms`.
 *
 * - `toTemplate` runs when the CLI is built: it turns the playground (the monorepo's demo site)
 *   into a generic starter that installs the published packages.
 * - `customize` runs on the user's machine: it names the site, sets the brand colour and
 *   drops optional collections.
 *
 * Both are plain find-and-replace over known lines of the playground. Every edit must find its
 * target, so a playground change that would silently break the template fails the build (and
 * the tests) instead.
 */

export type Files = Map<string, string>

/** Playground files that stay in the monorepo: demo seeding, live model checks, the admin suite, its history. */
const PLAYGROUND_ONLY = [
  /^scripts\/(?!migrate\.ts$|evals\.ts$)/,
  /^e2e\//,
  /^playwright\.config\.ts$/,
  /^evals\/ledger\.jsonl$/,
  /^src\/migrations\//,
  /^README\.md$/,
  /^AGENTS\.md$/,
]

export function toTemplate(playground: Files, opts: { version: string }): Files {
  const files: Files = new Map()
  for (const [path, text] of playground) {
    if (!PLAYGROUND_ONLY.some((re) => re.test(path))) files.set(path, text)
  }

  edit(files, 'package.json', (text) => {
    const pkg = JSON.parse(text)
    pkg.name = 'my-site'
    pkg.version = '0.1.0'
    pkg.description = 'A Sitekick CMS site.'
    delete pkg.license
    pkg.scripts.dev = pkg.scripts.dev.replace('-p 3100', '-p 3000')
    // The admin suite tests the playground's demo content; it stays in the monorepo.
    delete pkg.scripts.e2e
    delete pkg.scripts['e2e:seed']
    delete pkg.devDependencies?.['@playwright/test']
    for (const [name, range] of Object.entries<string>(pkg.dependencies)) {
      if (range.startsWith('workspace:')) pkg.dependencies[name] = `^${opts.version}`
    }
    return JSON.stringify(pkg, null, 2) + '\n'
  })

  // Outside the monorepo: install in place, and the packages ship compiled JavaScript.
  edit(files, 'vercel.json', (text) => {
    const json = JSON.parse(text)
    json.installCommand = 'bun install --frozen-lockfile'
    return JSON.stringify(json, null, 2) + '\n'
  })
  edit(files, 'next.config.ts', (text) =>
    replace(
      replace(
        replace(text, "  // Workspace packages ship TypeScript source.\n  transpilePackages: ['@sitekick/cms', '@sitekick/blocks', '@sitekick/agents'],\n", ''),
        "  turbopack: {\n    root: path.resolve(dirname, '../..'),\n  },\n",
        '',
      ),
      "import path from 'path'\nimport { fileURLToPath } from 'url'\n\nconst dirname = path.dirname(fileURLToPath(import.meta.url))\n\n",
      '',
    ),
  )
  edit(files, 'src/app/(frontend)/globals.css', (text) =>
    replace(
      text,
      "/* Scan the block package's source so its utility classes are compiled here. */\n@source '../../../../../packages/blocks/src';",
      "/* Scan the block renderers so their utility classes are compiled here. */\n@source '../../../node_modules/@sitekick/blocks/dist';",
    ),
  )
  edit(files, 'src/lib/site.ts', (text) => replace(text, "'http://localhost:3100'", "'http://localhost:3000'"))
  edit(files, 'DESIGN.md', (text) =>
    replace(
      replace(text, '# Playground design', '# Site design'),
      'The single visual reference for the playground site.',
      'The single visual reference for this site.',
    ),
  )
  return files
}

export type Options = {
  /** npm package name and folder name. */
  name: string
  /** Shown in the admin, the site header and to agents. */
  siteName: string
  /** One sentence, for agents and search. */
  description: string
  /** Brand colour, `#rrggbb`. */
  accent: string
  /** Keep the People collection (team, authors, partners; post authors link to it). */
  people: boolean
  /** Keep the Events module (src/modules/events): the example of a site module. */
  events: boolean
}

export function customize(template: Files, opts: Options): Files {
  const files: Files = new Map(template)

  edit(files, 'package.json', (text) => {
    const pkg = JSON.parse(text)
    pkg.name = opts.name
    return JSON.stringify(pkg, null, 2) + '\n'
  })
  edit(files, 'src/lib/site.ts', (text) =>
    replace(
      replace(
        replace(text, "name: 'Demo Co.'", `name: ${quote(opts.siteName)}`),
        "description: 'The Sitekick CMS playground: a demo company site.'",
        `description: ${quote(opts.description)}`,
      ),
      "accent: '#0f766e'",
      `accent: '${opts.accent}'`,
    ),
  )
  for (const css of ['src/app/(frontend)/globals.css', 'src/app/(payload)/custom.css']) {
    edit(files, css, (text) => replace(text, '--sk-accent: #0f766e;', `--sk-accent: ${opts.accent};`))
  }
  edit(files, 'DESIGN.md', (text) => text.replaceAll('#0f766e', opts.accent))

  if (!opts.people) {
    files.delete('src/collections/People.ts')
    edit(files, 'src/payload.config.ts', (text) =>
      replace(
        replace(
          replace(text, "import { People } from './collections/People'\n", ''),
          'collections: [Pages, Posts, People, Media, Users],',
          'collections: [Pages, Posts, Media, Users],',
        ),
        "        { label: 'People', icon: 'users', links: ['people'] },\n",
        '',
      ),
    )
    edit(files, 'src/collections/Posts.ts', (text) =>
      replace(
        replace(text, "defaultColumns: ['title', 'author', 'publishedAt', '_status'],", "defaultColumns: ['title', 'publishedAt', '_status'],"),
        "    {\n      name: 'author',\n      type: 'relationship',\n      relationTo: 'people',\n      admin: { position: 'sidebar', description: 'Shown with their photo and role.' },\n    },\n",
        '',
      ),
    )
  }
  if (!opts.events) {
    // The module folder and its routes go; src/modules stays, empty, for the site's own.
    for (const path of [...files.keys()]) {
      if (path.startsWith('src/modules/events/') || path.startsWith('src/app/(frontend)/events/')) files.delete(path)
    }
    edit(files, 'src/modules/index.ts', (text) =>
      replace(replace(text, "import { events } from './events'\n", ''), 'export const modules: SiteModule[] = [forms(), redirects(), events]', 'export const modules: SiteModule[] = [forms(), redirects()]'),
    )
    edit(files, 'src/modules/frontend.ts', (text) =>
      replace(replace(text, "import { eventBlocks } from './events/frontend'\n", ''), 'export const customBlocks: CustomBlockComponents = { formBlock: FormSection, ...eventBlocks }', 'export const customBlocks: CustomBlockComponents = { formBlock: FormSection }'),
    )
    edit(files, 'src/app/(frontend)/layout.tsx', (text) => replace(text, "  { href: '/events', label: 'Events' },\n", ''))
  }
  return files
}

/** `my-site`, `My Site`, `@acme/site` are fine; spaces, capitals and leading dots are not. */
export function validName(name: string): string | undefined {
  if (!name) return 'Give the project a name.'
  if (name.length > 214) return 'That name is too long for npm.'
  if (!/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return 'Use lowercase letters, numbers and dashes (it becomes the folder and package name).'
  }
}

export function validAccent(accent: string): string | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return 'Use a hex colour like #0f766e.'
}

/** A display name from a package name: `acme-site` → `Acme Site`. */
export function titleFrom(name: string): string {
  return name
    .replace(/^@[^/]+\//, '')
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

/** npm drops .gitignore from packages, so the packaged template stores dotfiles as `_name`. */
export function toPackaged(path: string): string {
  return path.replace(/^\.(gitignore|env\.example)$/, '_$1')
}

export function fromPackaged(path: string): string {
  return path.replace(/^_(gitignore|env\.example)$/, '.$1')
}

function edit(files: Files, path: string, fn: (text: string) => string) {
  const text = files.get(path)
  if (text === undefined) throw new Error(`Template is missing ${path}`)
  files.set(path, fn(text))
}

function replace(text: string, find: string, by: string): string {
  if (!text.includes(find)) throw new Error(`Template drifted: expected to find ${JSON.stringify(find.slice(0, 80))}`)
  return text.replace(find, by)
}

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}
