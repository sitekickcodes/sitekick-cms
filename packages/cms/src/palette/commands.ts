/**
 * The command palette's data, kept pure so it is testable without React:
 * what the person can jump to, how a typed query ranks it, and how a
 * document search for one collection is phrased for the REST API.
 */

export type CommandGroup = 'Go to' | 'Create' | 'Documents' | 'Actions'

export type Command = {
  id: string
  label: string
  /** Shown dim, right of the label: the collection, a shortcut, a hint. */
  hint?: string
  group: CommandGroup
  /** Navigation target. Absent = `event` is dispatched on window instead. */
  href?: string
  event?: string
  /** Extra words the query may match (slug, group label, singular). */
  keywords?: string[]
}

export type PaletteCollection = {
  slug: string
  labels: { singular: string; plural: string }
  useAsTitle?: string
  listSearchableFields?: string[]
  /** May the person read / create? From Payload's permissions. */
  canRead: boolean
  canCreate: boolean
  /** Upload and auth collections are created through their own flows. */
  isUpload?: boolean
  isAuth?: boolean
  /** The Draft agent is offered here (contract `actions: ['draft']`). */
  draftable?: boolean
}

export type PaletteGlobal = { slug: string; label: string; canRead: boolean }

export type PaletteView = { path: string; label: string }

export type BuildInput = {
  adminRoute: string
  collections: PaletteCollection[]
  globals: PaletteGlobal[]
  views: PaletteView[]
  accountPath: string
  logoutPath: string
  help: boolean
  /** Site modules' commands; `href` under the admin route unless it is a full URL. */
  extra?: { label: string; href: string; group?: 'Go to' | 'Create' | 'Actions'; hint?: string; keywords?: string[] }[]
}

export const PALETTE_OPEN_EVENT = 'sitekick:palette:open'
export const HELP_EVENT = 'sitekick:help:open'

const join = (adminRoute: string, path: string) => `${adminRoute.replace(/\/$/, '')}${path}`

/** Every static command, in display order within its group. */
export function buildCommands(input: BuildInput): Command[] {
  const { adminRoute } = input
  const out: Command[] = [{ id: 'go:dashboard', label: 'Dashboard', group: 'Go to', href: adminRoute, keywords: ['home'] }]
  for (const v of input.views) out.push({ id: `go:view:${v.path}`, label: v.label, group: 'Go to', href: join(adminRoute, v.path) })
  for (const c of input.extra ?? []) {
    const href = /^https?:\/\//.test(c.href) ? c.href : join(adminRoute, c.href.startsWith('/') ? c.href : `/${c.href}`)
    out.push({ id: `module:${c.label}`, label: c.label, group: c.group ?? 'Go to', href, ...(c.hint ? { hint: c.hint } : {}), ...(c.keywords ? { keywords: c.keywords } : {}) })
  }
  for (const c of input.collections) {
    if (!c.canRead) continue
    out.push({ id: `go:${c.slug}`, label: c.labels.plural, group: 'Go to', href: join(adminRoute, `/collections/${c.slug}`), keywords: [c.slug] })
  }
  for (const g of input.globals) {
    if (!g.canRead) continue
    out.push({ id: `go:global:${g.slug}`, label: g.label, group: 'Go to', href: join(adminRoute, `/globals/${g.slug}`), keywords: [g.slug] })
  }
  for (const c of input.collections) {
    if (!c.canCreate || c.isAuth) continue
    out.push({
      id: `create:${c.slug}`,
      label: c.isUpload ? `Upload ${c.labels.singular.toLowerCase()}` : `New ${c.labels.singular.toLowerCase()}`,
      hint: c.labels.plural,
      group: 'Create',
      href: join(adminRoute, `/collections/${c.slug}/create`),
      keywords: ['create', 'add', c.slug],
    })
    if (c.draftable && !c.isUpload) {
      out.push({
        id: `draft:${c.slug}`,
        label: `Draft ${c.labels.singular.toLowerCase()} from notes`,
        hint: 'AI',
        group: 'Create',
        href: join(adminRoute, `/collections/${c.slug}?draft=1`),
        keywords: ['write', 'ai', 'agent', 'notes', c.slug],
      })
    }
  }
  if (input.help) out.push({ id: 'act:help', label: 'Get help', group: 'Actions', event: HELP_EVENT, keywords: ['guide', 'docs', 'support'] })
  out.push({ id: 'act:account', label: 'My account', group: 'Actions', href: join(adminRoute, input.accountPath), keywords: ['profile', 'password'] })
  out.push({ id: 'act:logout', label: 'Log out', group: 'Actions', href: join(adminRoute, input.logoutPath), keywords: ['sign out'] })
  return out
}

/**
 * Lower is better; null = no match. Prefix on the label wins, then a word
 * boundary, then anywhere in label or keywords. Multi-word queries must
 * all match somewhere.
 */
export function score(cmd: Command, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const label = cmd.label.toLowerCase()
  const hay = [label, ...(cmd.keywords ?? []).map((k) => k.toLowerCase()), cmd.hint?.toLowerCase() ?? ''].join(' ')
  const words = q.split(/\s+/)
  if (!words.every((w) => hay.includes(w))) return null
  if (label.startsWith(q)) return 0
  if (new RegExp(`\\b${escape(q)}`).test(label)) return 1
  if (label.includes(q)) return 2
  return 3
}

export function rank(commands: Command[], query: string, limit = 12): Command[] {
  return commands
    .map((c, i) => ({ c, i, s: score(c, query) }))
    .filter((x): x is { c: Command; i: number; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c)
}

/** Collections worth searching documents in: readable, with a title field. */
export function searchable(collections: PaletteCollection[]): PaletteCollection[] {
  return collections.filter((c) => c.canRead && c.useAsTitle && c.useAsTitle !== 'id')
}

/**
 * The `where` for a REST list query: `like` across the title and the
 * collection's searchable fields. Payload's `like` is case-insensitive and
 * matches every word.
 */
export function searchWhere(c: PaletteCollection, q: string): Record<string, unknown> {
  const fields = Array.from(new Set([c.useAsTitle ?? 'id', ...(c.listSearchableFields ?? [])]))
  if (fields.length === 1) return { [fields[0]]: { like: q } }
  return { or: fields.map((f) => ({ [f]: { like: q } })) }
}

/** REST URL for one collection's search, `depth=0`, title only. */
export function searchURL(apiRoute: string, c: PaletteCollection, q: string, limit = 4): string {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('depth', '0')
  params.set('where', JSON.stringify(searchWhere(c, q)))
  return `${apiRoute.replace(/\/$/, '')}/${c.slug}?${params.toString()}`
}

/** A found document as a command row. */
export function docCommand(adminRoute: string, c: PaletteCollection, doc: Record<string, unknown>): Command {
  const raw = (c.useAsTitle ?? 'id').split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), doc)
  const title = typeof raw === 'string' && raw.trim() ? raw : `#${String(doc.id)}`
  return {
    id: `doc:${c.slug}:${String(doc.id)}`,
    label: title,
    hint: c.labels.singular,
    group: 'Documents',
    href: join(adminRoute, `/collections/${c.slug}/${String(doc.id)}`),
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
