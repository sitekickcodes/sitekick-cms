import type { CollectionConfig, CollectionSlug, Config, GlobalConfig, GlobalSlug, Payload, Where } from 'payload'
import { z } from 'zod'

import { contractFromConfig, type ResolvedContract } from '../agent/contract'

/**
 * The public read-only catalog: an explicit allowlist of tools with fixed
 * output schemas, derived from the contract. Every surface (MCP, REST,
 * OpenAPI, llms.txt, Markdown) is generated from this one list.
 */

export type PublicSite = {
  name: string
  /** Absolute origin, e.g. https://example.com (no trailing slash). */
  url: string
  description?: string
}

export type PublicToolContext = {
  payload: Payload
  site: PublicSite
}

export type PublicTool = {
  /** snake_case; also the REST path segment. */
  name: string
  /** camelCase OpenAPI operationId. */
  operationId: string
  summary: string
  description: string
  input: z.ZodObject<z.ZodRawShape>
  output: z.ZodType
  /** Resolve to `null` for "not found" (REST 404, MCP isError). */
  handler: (input: Record<string, unknown>, ctx: PublicToolContext) => Promise<unknown>
  /** What it reads, for llms.txt grouping. */
  source?: { kind: 'collection' | 'global'; slug: string; label: string; url?: string }
}

export type PublicCatalog = { tools: PublicTool[] }

/** Type-erase an app-defined tool so it can sit next to the derived ones. */
export const definePublicTool = <Input extends z.ZodObject<z.ZodRawShape>, Output extends z.ZodType>(tool: {
  name: string
  operationId?: string
  summary: string
  description: string
  input: Input
  output: Output
  handler: (input: z.output<Input>, ctx: PublicToolContext) => Promise<z.input<Output> | null>
}): PublicTool => ({
  ...tool,
  operationId: tool.operationId ?? camel(tool.name),
  handler: (input, ctx) => tool.handler(tool.input.parse(input) as z.output<Input>, ctx),
})

export const camel = (name: string): string => name.replace(/[-_]+(\w)/g, (_, c: string) => c.toUpperCase())

/** Fixed shape of a public collection entry. Nothing else leaves the CMS. */
export const entrySchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  slug: z.string(),
  url: z.string().describe('Public page URL.'),
  excerpt: z.string().describe('Listing blurb or SEO description; may be empty.'),
  updatedAt: z.string(),
})
export type PublicEntry = z.output<typeof entrySchema>

export const listInput = z
  .object({
    q: z.string().trim().min(2).max(200).optional().describe('Words to match in the title and searchable fields.'),
    limit: z.number().int().min(1).max(50).default(20).describe('Entries per page (1-50).'),
    page: z.number().int().min(1).default(1).describe('Page number, from 1.'),
  })
  .strict()

export const listOutput = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  limit: z.number().int(),
  items: z.array(entrySchema),
})

export const slugInput = z
  .object({
    slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Use the slug from a list result.').describe('Entry slug.'),
  })
  .strict()

export const searchOutput = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  results: z.array(entrySchema.extend({ type: z.string().describe('Collection slug.') })),
})

export const globalOutput = z.object({
  slug: z.string(),
  label: z.string(),
  updatedAt: z.string(),
  /** Top-level scalar fields only; relationships, uploads and rich text are excluded. */
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

type Entity = CollectionConfig | GlobalConfig

/** Whether anonymous readers pass `access.read`. Omitted access = signed-in only in Payload. */
export const isPublicRead = async (entity: Entity, payload?: Pick<Payload, 'config'>): Promise<boolean> => {
  const read = entity.access?.read
  if (!read) return false
  try {
    // Payload 4 wraps every access function and reads `req.payload.config.baseAccess`;
    // an unsanitised config gets a stub with no base access.
    const req = { user: null, payload: payload ?? { config: { baseAccess: undefined } }, context: {} }
    const result = await read({ req } as unknown as Parameters<typeof read>[0])
    return result === true || (typeof result === 'object' && result !== null)
  } catch {
    return false
  }
}

const SCALAR_TYPES = new Set(['text', 'textarea', 'number', 'checkbox', 'email', 'date', 'select', 'radio', 'code'])

/** Per-collection reading plan, from the contract and the admin config. */
export type CollectionSource = {
  contract: ResolvedContract
  titleField: string
  excerptField?: string
  hasMeta: boolean
  searchFields: string[]
}

export const collectionSource = (collection: CollectionConfig, contract: ResolvedContract): CollectionSource => {
  const names = new Set(contract.fields.map((f) => f.name))
  const titleField = contract.titleField && names.has(contract.titleField) ? contract.titleField : 'title'
  const excerptField = contract.fields.find((f) => f.type === 'textarea')?.name
  const searchable = (collection.admin?.listSearchableFields ?? []).filter((f) => names.has(f))
  const searchFields = [...new Set([titleField, ...(excerptField ? [excerptField] : []), ...searchable])]
  return { contract, titleField, hasMeta: names.has('meta'), searchFields, ...(excerptField ? { excerptField } : {}) }
}

const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value))

export const entryUrl = (site: PublicSite, contract: ResolvedContract, slug: string): string =>
  `${site.url}${contract.pathPrefix.replace(/\/$/, '')}/${encodeURIComponent(slug)}`

/** Defence in depth: project a doc to the fixed entry shape, or drop it. */
export const toEntry = (doc: unknown, source: CollectionSource, site: PublicSite): PublicEntry | null => {
  const row = (typeof doc === 'object' && doc !== null ? doc : {}) as Record<string, unknown>
  if (source.contract.drafts && row._status !== 'published') return null
  const slug = str(row.slug).trim()
  const title = str(row[source.titleField]).trim()
  if (!slug || !title) return null
  const meta = (typeof row.meta === 'object' && row.meta !== null ? row.meta : {}) as Record<string, unknown>
  const excerpt = (source.excerptField && str(row[source.excerptField]).trim()) || str(meta.description).trim()
  return {
    id: typeof row.id === 'number' ? row.id : str(row.id),
    title,
    slug,
    url: entryUrl(site, source.contract, slug),
    excerpt,
    updatedAt: str(row.updatedAt),
  }
}

const published = (contract: ResolvedContract): Where | undefined => (contract.drafts ? { _status: { equals: 'published' } } : undefined)

const and = (...parts: (Where | undefined)[]): Where | undefined => {
  const present = parts.filter((p): p is Where => Boolean(p))
  return present.length === 0 ? undefined : present.length === 1 ? present[0] : { and: present }
}

const matching = (source: CollectionSource, q: string | undefined): Where | undefined =>
  q ? { or: source.searchFields.map((field) => ({ [field]: { like: q } })) } : undefined

const selectFor = (source: CollectionSource): Record<string, true> => {
  const select: Record<string, true> = { id: true, slug: true, updatedAt: true, [source.titleField]: true }
  if (source.excerptField) select[source.excerptField] = true
  if (source.hasMeta) select.meta = true
  if (source.contract.drafts) select._status = true
  return select
}

// Anonymous reads with Payload access on: the collection passed `isPublicRead`, so its own rule applies.
const anonymous = { draft: false, depth: 0, overrideAccess: false, user: undefined } as const

export const findEntries = async (
  payload: Payload,
  source: CollectionSource,
  site: PublicSite,
  options: { q?: string; limit: number; page: number },
): Promise<{ total: number; page: number; limit: number; items: PublicEntry[] }> => {
  const result = await payload.find({
    ...anonymous,
    collection: source.contract.slug as CollectionSlug,
    where: and(published(source.contract), matching(source, options.q)),
    select: selectFor(source),
    limit: options.limit,
    page: options.page,
    sort: '-updatedAt',
  })
  return {
    total: result.totalDocs,
    page: result.page ?? options.page,
    limit: options.limit,
    items: result.docs.flatMap((doc) => toEntry(doc, source, site) ?? []),
  }
}

export const findEntry = async (payload: Payload, source: CollectionSource, site: PublicSite, slug: string): Promise<PublicEntry | null> => {
  const result = await payload.find({
    ...anonymous,
    collection: source.contract.slug as CollectionSlug,
    where: and(published(source.contract), { slug: { equals: slug } }),
    select: selectFor(source),
    limit: 1,
    pagination: false,
  })
  const doc = result.docs[0]
  return doc ? toEntry(doc, source, site) : null
}

const collectionTools = (source: CollectionSource): PublicTool[] => {
  const { contract } = source
  const label = contract.label
  const base = { kind: 'collection' as const, slug: contract.slug, label }
  return [
    definePublicTool({
      name: `list_${contract.slug}`,
      summary: `List ${label}`,
      description: `${contract.description} Published entries only, newest first, with title, slug, page URL and excerpt. Pass q to filter.`,
      input: listInput,
      output: listOutput,
      handler: (input, ctx) => findEntries(ctx.payload, source, ctx.site, input),
    }),
    definePublicTool({
      name: `get_${contract.slug}`,
      summary: `Get one of ${label} by slug`,
      description: `One published entry from ${label} by slug: title, page URL and excerpt. Use list_${contract.slug} to find slugs.`,
      input: slugInput,
      output: entrySchema,
      handler: (input, ctx) => findEntry(ctx.payload, source, ctx.site, input.slug),
    }),
  ].map((tool) => ({ ...tool, source: base }))
}

const searchTool = (sources: CollectionSource[]): PublicTool => {
  const types = sources.map((s) => s.contract.slug) as [string, ...string[]]
  return definePublicTool({
    name: 'search',
    summary: 'Search published content',
    description: `Search titles and listing text across ${sources.map((s) => s.contract.label).join(', ')}. Returns at most 50 entries with page URLs; filter by type (collection slug).`,
    input: z
      .object({
        q: z.string().trim().min(2).max(200).describe('Search words.'),
        type: z.enum(types).optional().describe('Limit to one collection.'),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .strict(),
    output: searchOutput,
    handler: async (input, ctx) => {
      const chosen = sources.filter((s) => !input.type || s.contract.slug === input.type)
      const pages = await Promise.all(chosen.map((s) => findEntries(ctx.payload, s, ctx.site, { q: input.q, limit: input.limit, page: 1 })))
      const results = chosen
        .flatMap((s, i) => pages[i]!.items.map((item) => ({ ...item, type: s.contract.slug })))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, input.limit)
      return { query: input.q, total: pages.reduce((n, p) => n + p.total, 0), results }
    },
  })
}

const globalTool = (contract: ResolvedContract): PublicTool => ({
  ...definePublicTool({
    name: `get_${contract.slug}`,
    summary: `Get ${contract.label}`,
    description: `${contract.description} Top-level text, number and choice fields only.`,
    input: z.object({}).strict(),
    output: globalOutput,
    handler: async (_input, ctx) => {
      const doc = (await ctx.payload.findGlobal({ ...anonymous, slug: contract.slug as GlobalSlug })) as unknown as Record<string, unknown>
      const data: Record<string, string | number | boolean> = {}
      for (const field of contract.fields) {
        if (!SCALAR_TYPES.has(field.type)) continue
        const value = doc[field.name]
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') data[field.name] = value
      }
      return { slug: contract.slug, label: contract.label, updatedAt: str(doc.updatedAt), data }
    },
  }),
  source: { kind: 'global', slug: contract.slug, label: contract.label },
})

export type CatalogConfig = Pick<Config, 'collections' | 'globals' | 'custom'>

/**
 * Non-private collections with public read and a `slug` field get list/get
 * tools and join `search`; non-private globals with public read get a getter.
 */
export const derivePublicCatalog = async (config: CatalogConfig, extra: PublicCatalog = { tools: [] }, payload?: Pick<Payload, 'config'>): Promise<PublicCatalog> => {
  const contracts = contractFromConfig(config)
  const sources: CollectionSource[] = []
  const tools: PublicTool[] = []
  for (const collection of config.collections ?? []) {
    const contract = contracts.find((c) => c.kind === 'collection' && c.slug === collection.slug)
    if (!contract || contract.private || !contract.fields.some((f) => f.name === 'slug')) continue
    if (!(await isPublicRead(collection, payload))) continue
    sources.push(collectionSource(collection, contract))
  }
  for (const source of sources) tools.push(...collectionTools(source))
  if (sources.length) tools.push(searchTool(sources))
  for (const global of config.globals ?? []) {
    const contract = contracts.find((c) => c.kind === 'global' && c.slug === global.slug)
    if (!contract || contract.private || !(await isPublicRead(global, payload))) continue
    tools.push(globalTool(contract))
  }
  const names = new Set(tools.map((t) => t.name))
  for (const tool of extra.tools) {
    if (names.has(tool.name)) throw new Error(`publicAgentSurface: duplicate tool name "${tool.name}"`)
    tools.push(tool)
  }
  return { tools }
}
