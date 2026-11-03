import type { CollectionSlug } from 'payload'
import type { Payload, Where } from 'payload'

import type { ResolvedContract } from '../agent/contract'
import { contractFromConfig } from '../agent/contract'
import { derivePublicCatalog, type PublicCatalog, type PublicSite, type PublicToolContext } from './catalog'
import { discoveryHeaders, serverCard } from './discovery'
import { applyHeaders, budgetFor, cors, issuesText, problem, publicHeaders, queryToInput } from './http'
import { llmsTxt } from './llms'
import { docToMarkdown, markdownResponse, richTextEditors } from './markdown'
import { publicMcpHandler } from './mcp'
import { openApiDocument } from './openapi'
import { DEFAULT_PATHS, type PublicPaths } from './paths'
import type { RateLimitOptions } from './rateLimit'

export type PublicSurfaceOptions = {
  /** Lazily initialised Payload, e.g. `() => getPayload({ config })`. */
  payload: () => Promise<Payload>
  site: PublicSite
  /** App-defined tools appended to the derived catalog. */
  catalog?: PublicCatalog
  paths?: Partial<PublicPaths>
  rateLimit?: RateLimitOptions
}

export type PublicSurface = {
  llmsTxt: (req: Request) => Promise<Response>
  openapi: (req: Request) => Promise<Response>
  mcp: (req: Request) => Promise<Response>
  serverCard: (req: Request) => Promise<Response>
  /** `GET <basePath>/<tool>`; the app passes the tool segment. */
  rest: (req: Request, tool: string) => Promise<Response>
  /** `GET <markdown>/<collection>/<slug>`; the app passes the remaining segments. */
  markdown: (req: Request, path: string | string[]) => Promise<Response>
  /** The derived catalog (memoised after the first call). */
  catalog: () => Promise<PublicCatalog>
}

/**
 * Framework-neutral Request → Response handlers for the public read-only
 * agent surface. The catalog is derived once from the running config.
 */
export const createPublicSurface = (options: PublicSurfaceOptions): PublicSurface => {
  const site: PublicSite = { ...options.site, url: options.site.url.replace(/\/$/, '') }
  const paths: PublicPaths = { ...DEFAULT_PATHS, ...options.paths }
  const budget = budgetFor(options.rateLimit)
  const headers = publicHeaders(site.url, paths.openapi)
  let catalogPromise: Promise<PublicCatalog> | undefined
  let contracts: ResolvedContract[] | undefined

  const catalog = () => {
    catalogPromise ??= options.payload().then((payload) => {
      contracts = contractFromConfig(payload.config)
      return derivePublicCatalog(payload.config, options.catalog, payload)
    })
    return catalogPromise
  }
  const context = async (): Promise<PublicToolContext> => ({ payload: await options.payload(), site })

  const guard = (req: Request, handler: () => Promise<Response>): Promise<Response> => {
    if (req.method === 'OPTIONS') return Promise.resolve(cors(headers))
    if (req.method !== 'GET' && req.method !== 'HEAD') return Promise.resolve(problem(405, 'This surface is read-only; use GET.', { ...headers, Allow: 'GET, HEAD, OPTIONS' }))
    const quota = budget.take(req)
    if (quota.limited) return Promise.resolve(problem(429, 'Wait for Retry-After seconds before retrying.', { ...headers, ...quota.headers }))
    return handler().then((response) => applyHeaders(response, quota.headers))
  }

  const mcp = publicMcpHandler({ catalog, context, site, paths, budget })

  return {
    catalog,
    llmsTxt: (req) =>
      guard(req, async () => new Response(llmsTxt(await catalog(), site, paths), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })),
    openapi: (req) =>
      guard(req, async () => Response.json(openApiDocument(await catalog(), site, paths), { headers: { ...headers, 'Content-Type': 'application/vnd.oai.openapi+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })),
    serverCard: (req) => guard(req, async () => Response.json(serverCard(site, paths), { headers: discoveryHeaders('application/mcp-server-card+json; charset=utf-8') })),
    mcp: (req) => (req.method === 'OPTIONS' ? Promise.resolve(cors(headers, 'POST, OPTIONS')) : mcp(req)),
    rest: (req, name) =>
      guard(req, async () => {
        const tool = (await catalog()).tools.find((t) => t.name === name)
        if (!tool) return problem(404, `Unknown operation. See ${site.url}${paths.openapi}.`, headers)
        const parsed = tool.input.safeParse(queryToInput(new URL(req.url).searchParams, tool.input))
        if (!parsed.success) return problem(400, issuesText(parsed.error), headers)
        try {
          const raw = await tool.handler(parsed.data, await context())
          if (raw === null) return problem(404, 'No published entry matches.', headers)
          return Response.json(tool.output.parse(raw), { headers })
        } catch {
          console.error('publicAgentSurface: tool failed', name)
          return problem(503, 'Public content is temporarily unavailable. Retry shortly.', { ...headers, 'Retry-After': '30' })
        }
      }),
    markdown: (req, path) =>
      guard(req, async () => {
        const [collection, slug, ...rest] = (Array.isArray(path) ? path : path.split('/')).filter(Boolean)
        const notFound = (detail: string) => markdownResponse(`# Not found\n\n${detail}\n\nSee ${site.url}${paths.llms}.\n`, 404)
        if (!collection || !slug || rest.length || !/^[a-z0-9-]+$/.test(slug)) return notFound('Use /<collection>/<slug>.')
        const tools = (await catalog()).tools
        if (!tools.some((t) => t.name === `get_${collection}` && t.source?.kind === 'collection')) return notFound('No public collection by that name.')
        const contract = contracts?.find((c) => c.kind === 'collection' && c.slug === collection)
        if (!contract) return notFound('No public collection by that name.')
        const payload = await options.payload()
        const where: Where = contract.drafts ? { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] } : { slug: { equals: slug } }
        const { docs } = await payload.find({ collection: collection as CollectionSlug, where, draft: false, depth: 0, overrideAccess: false, user: undefined, limit: 1, pagination: false })
        const doc = docs[0] as unknown as Record<string, unknown> | undefined
        if (!doc) return notFound('No published entry matches.')
        return markdownResponse(await docToMarkdown(doc, contract, { site, editors: richTextEditors(payload, collection) }), 200, headers)
      }),
  }
}

export { derivePublicCatalog, definePublicTool, entrySchema, isPublicRead, listInput, listOutput, searchOutput, slugInput, globalOutput, type PublicCatalog, type PublicEntry, type PublicSite, type PublicTool, type PublicToolContext } from './catalog'
export { createRateLimiter, clientKey, type RateLimitOptions, type RateLimitResult } from './rateLimit'
export { openApiDocument } from './openapi'
export { llmsTxt } from './llms'
export { serverCard } from './discovery'
export { docToMarkdown, lexicalToMarkdown, richTextToMarkdown, prefersMarkdown, markdownResponse } from './markdown'
export { buildPublicServer, publicInstructions } from './mcp'
export { DEFAULT_PATHS, type PublicPaths } from './paths'
