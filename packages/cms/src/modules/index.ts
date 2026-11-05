import type { Block, CollectionConfig, Config, Field, GlobalConfig, Payload, Plugin } from 'payload'

import type { DashboardCard } from '../dashboard/types'
import { DEFAULT_HELP_TOPICS, HELP_SLUG } from '../help/shared'
import type { NavArea, NavArrangement } from '../types'

/**
 * Site modules: a client's own features, kept in the client's repo (`src/modules/<name>/`)
 * and handed to sitekickCMS, never patched into the packages.
 *
 *   sitekickCMS({ site, nav, modules: [events, donations] })
 *
 * A module is a description, not a plugin, because order matters: sitekickCMS adds the
 * module's collections, globals and blocks *before* it applies its conventions, so a
 * module's collections get slugs, SEO, row labels, the board, saved views and the agent
 * buttons exactly like the built-in ones. Its dashboard cards, commands and help articles
 * go to the dashboard, the command palette and the help drawer.
 *
 * Anything a module needs that this shape doesn't cover goes in `plugin`, which runs at the
 * same early point. If that keeps being needed, the extension point belongs here.
 */
export type SiteModule = {
  /** For errors and logs: `events`. */
  name: string
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  /**
   * Page sections. Added to every collection's top-level `layout` blocks field (the one
   * `layoutField()` makes), or to the fields named in `into`, e.g. `{ pages: 'layout' }`.
   * Render them with `RenderBlocks`'s `custom` prop from `@sitekick/blocks/react`.
   */
  blocks?: Block[]
  into?: Record<string, string>
  /**
   * Where the module sits in the sidebar, used when the site's `nav` doesn't already place
   * these links. Without a site `nav`, set `admin.group` on the collections instead.
   */
  nav?: NavArea
  /** Cards on the dashboard home (server components by import-map path). */
  dashboard?: DashboardCard[]
  /** Extra entries in the command palette (Cmd+K). */
  commands?: ModuleCommand[]
  /**
   * Help articles the module ships. Created in the help collection on start-up when no
   * article has that slug yet, then the site's to edit: an edited, unpublished or moved
   * article is never overwritten. `body` is Lexical JSON; write Markdown and convert it
   * with `markdownToLexical` from `@sitekick/agents`.
   */
  help?: ModuleHelpArticle[]
  /** Escape hatch: a plain Payload plugin, applied before the conventions. */
  plugin?: Plugin
}

export type ModuleCommand = {
  label: string
  /** Under the admin route (`/collections/events?where…`) or a full URL. */
  href: string
  /** Default `Go to`. */
  group?: 'Go to' | 'Create' | 'Actions'
  hint?: string
  keywords?: string[]
}

export type ModuleHelpArticle = {
  slug: string
  title: string
  /** Topic in the drawer. A new topic is added to the help collection's choices. */
  topic: string
  summary?: string
  body: Record<string, unknown>
}

/** Typed identity: `export const events = defineModule({ name: 'events', ... })`. */
export const defineModule = (module: SiteModule): SiteModule => module

/** What sitekickCMS hands on to the dashboard, palette and help steps. */
export type ModuleContributions = {
  cards: DashboardCard[]
  commands: ModuleCommand[]
  help: ModuleHelpArticle[]
  helpTopics: string[]
}

/**
 * Add the modules' schema to the config, before anything else runs. Throws on a slug that
 * already exists: two modules (or a module and the site) defining `events` is a mistake
 * worth stopping the build for, not a silent override.
 */
export function applyModules(config: Config, modules: SiteModule[]): { config: Config; contributions: ModuleContributions } {
  let next: Config = { ...config, collections: [...(config.collections ?? [])], globals: [...(config.globals ?? [])] }
  const taken = (list: { slug: string }[], slug: string) => list.some((c) => c.slug === slug)

  for (const module of modules) {
    for (const collection of module.collections ?? []) {
      if (taken(next.collections!, collection.slug)) throw new Error(`Module "${module.name}": a collection "${collection.slug}" already exists`)
      next.collections!.push(collection)
    }
    for (const global of module.globals ?? []) {
      if (taken(next.globals!, global.slug)) throw new Error(`Module "${module.name}": a global "${global.slug}" already exists`)
      next.globals!.push(global)
    }
  }
  // Blocks after every module's collections are in, so a module can add sections to another's pages.
  for (const module of modules) {
    if (module.blocks?.length) next = { ...next, collections: next.collections!.map((c) => withBlocks(c, module)) }
  }
  for (const module of modules) {
    if (module.plugin) {
      const out = module.plugin(next)
      if (out instanceof Promise) throw new Error(`Module "${module.name}": async plugins are not supported`)
      next = out
    }
  }

  const help = modules.flatMap((m) => m.help ?? [])
  return {
    config: next,
    contributions: {
      cards: modules.flatMap((m) => m.dashboard ?? []),
      commands: modules.flatMap((m) => m.commands ?? []),
      help,
      helpTopics: [...new Set(help.map((a) => a.topic))].filter((t) => !(DEFAULT_HELP_TOPICS as readonly string[]).includes(t)),
    },
  }
}

function withBlocks(collection: CollectionConfig, module: SiteModule): CollectionConfig {
  const target = module.into ? module.into[collection.slug] : 'layout'
  if (!target) return collection
  let found = false
  const walk = (fields: Field[]): Field[] =>
    fields.map((field): Field => {
      if (field.type === 'blocks' && field.name === target) {
        found = true
        const have = new Set(field.blocks.map((b) => (typeof b === 'string' ? b : b.slug)))
        const extra = module.blocks!.filter((b) => !have.has(b.slug))
        return { ...field, blocks: [...field.blocks, ...extra] }
      }
      // Top level, through unnamed tabs, rows and collapsibles: where layoutField() sits.
      if (field.type === 'tabs') return { ...field, tabs: field.tabs.map((t) => ('name' in t && t.name ? t : { ...t, fields: walk(t.fields) })) }
      if (field.type === 'row' || field.type === 'collapsible') return { ...field, fields: walk(field.fields) } as Field
      return field
    })
  const fields = walk(collection.fields)
  if (module.into?.[collection.slug] && !found) throw new Error(`Module "${module.name}": ${collection.slug} has no blocks field "${target}"`)
  return found ? { ...collection, fields } : collection
}

/** The site's nav plus each module's area, unless the site already placed those links. */
export function navWithModules(nav: NavArrangement | undefined, modules: SiteModule[]): NavArrangement | undefined {
  if (!nav) return nav
  const key = (link: NavArea['links'][number]) => (typeof link === 'string' ? link : link.to)
  const placed = new Set(nav.flatMap((area) => area.links.map(key)))
  const extra = modules.flatMap((m) => (m.nav && !m.nav.links.some((l) => placed.has(key(l))) ? [m.nav] : []))
  return extra.length ? [...nav, ...extra] : nav
}

/**
 * Create the modules' help articles that don't exist yet (by slug, drafts included), as
 * published. Runs from onInit; a missing table (before the first migration) is not an error.
 */
export async function seedHelp(payload: Payload, articles: ModuleHelpArticle[], slug = HELP_SLUG): Promise<number> {
  if (!articles.length || !payload.collections[slug as never]) return 0
  let created = 0
  try {
    const { docs } = await payload.find({ collection: slug as never, where: { slug: { in: articles.map((a) => a.slug) } }, draft: true, depth: 0, limit: 0, pagination: false, select: { slug: true } as never, overrideAccess: true })
    const have = new Set(docs.map((d) => String((d as { slug?: unknown }).slug)))
    for (const article of articles) {
      if (have.has(article.slug)) continue
      await payload.create({ collection: slug as never, data: { ...article, summary: article.summary ?? '', _status: 'published' } as never, overrideAccess: true })
      created++
    }
    if (created) payload.logger.info(`Help: added ${created} article${created === 1 ? '' : 's'} from site modules`)
  } catch (err) {
    // Before the migrations have run (including during `payload migrate` itself); next start adds them.
    const reason = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message).split('\n')[0] : String(err)
    payload.logger.warn(`Help: module articles not added yet (${reason}). They are added on the next start after the migrations run.`)
  }
  return created
}
