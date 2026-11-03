import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { z } from 'zod'

import type { PublicCatalog, PublicSite, PublicToolContext } from './catalog'
import { applyHeaders, problem, type Budget } from './http'
import type { PublicPaths } from './paths'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const

export const publicInstructions = (site: PublicSite, paths: PublicPaths): string =>
  [
    `Published content from ${site.name}, read-only and anonymous.`,
    site.description,
    'Use list_* tools to find slugs, get_* for one entry, search across everything.',
    'Every result carries the public page URL; cite it.',
    `Site: ${site.url}. REST equivalent: ${site.url}${paths.openapi}.`,
  ]
    .filter(Boolean)
    .join(' ')

type ToolResult = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean }

/** One server per request: tools are read-only and stateless. */
export const buildPublicServer = (catalog: PublicCatalog, ctx: PublicToolContext, instructions: string): McpServer => {
  const server = new McpServer({ name: `${ctx.site.name} public content`, version: '1.0.0' }, { instructions })
  for (const tool of catalog.tools) {
    server.registerTool(
      tool.name,
      { title: tool.summary, description: tool.description, inputSchema: tool.input, outputSchema: tool.output, annotations: READ_ONLY },
      async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const raw = await tool.handler(args, ctx)
          if (raw === null) return { isError: true, content: [{ type: 'text', text: 'No published entry matches.' }] }
          const data = (tool.output as z.ZodType).parse(raw) as Record<string, unknown>
          return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }
        } catch {
          // Never echo upstream errors; they can carry query text or internals.
          return { isError: true, content: [{ type: 'text', text: 'Public content is temporarily unavailable. Retry shortly.' }] }
        }
      },
    )
  }
  return server
}

export type PublicMcpOptions = {
  catalog: () => Promise<PublicCatalog>
  context: () => Promise<PublicToolContext>
  site: PublicSite
  paths: PublicPaths
  budget: Budget
  /** Largest JSON-RPC body accepted. Default 16 KiB. */
  maxRequestBodySize?: number
}

/**
 * Stateless Streamable HTTP; GET/DELETE answer 405. Modern (2026-07-28)
 * clients get a JSON body; 2025-era clients get the SSE framing their
 * transport expects. `auto` rather than `json` so nothing is logged at start.
 */
export const publicMcpHandler = (options: PublicMcpOptions): ((req: Request) => Promise<Response>) => {
  const instructions = publicInstructions(options.site, options.paths)
  const handler = createMcpHandler(
    async () => buildPublicServer(await options.catalog(), await options.context(), instructions),
    { legacy: 'stateless', responseMode: 'auto', maxRequestBodySize: options.maxRequestBodySize ?? 16_384 },
  )
  return async (req) => {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin) return problem(403, 'Use this endpoint from the same origin or a server-side MCP client.')
    const quota = options.budget.take(req)
    if (quota.limited) return problem(429, 'Wait for Retry-After seconds before retrying.', quota.headers)
    const response = await handler.fetch(req)
    return applyHeaders(response, quota.headers)
  }
}
