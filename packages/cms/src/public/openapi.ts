import { z } from 'zod'

import type { PublicCatalog, PublicSite } from './catalog'
import { problemSchema } from './http'
import type { PublicPaths } from './paths'

type JsonSchema = Record<string, unknown> & { properties?: Record<string, unknown>; required?: string[] }

/** OpenAPI 3.1 for the REST mirror of the catalog: one GET per tool, query parameters from its input. */
export const openApiDocument = (catalog: PublicCatalog, site: PublicSite, paths: PublicPaths) => {
  const quota = Object.fromEntries(
    ['RateLimit', 'RateLimit-Policy', 'Retry-After'].map((name) => [
      name,
      {
        description: name === 'Retry-After' ? 'Seconds to wait before retrying (on 429 or 503).' : 'Per-instance burst budget (IETF RateLimit fields).',
        schema: { type: 'string' },
      },
    ]),
  )
  const problem = (description: string) => ({ description, headers: quota, content: { 'application/problem+json': { schema: problemSchema } } })
  return {
    openapi: '3.1.0',
    info: {
      title: `${site.name} public API`,
      version: '1.0.0',
      description: [
        site.description,
        'Public, read-only, no authentication. Only published content with a fixed shape. The same operations are MCP tools at',
        `${site.url}${paths.mcp}.`,
      ]
        .filter(Boolean)
        .join(' '),
      contact: { name: site.name, url: site.url },
    },
    servers: [{ url: site.url }],
    externalDocs: { description: 'Agent guide', url: `${site.url}${paths.llms}` },
    // Anonymous public reads. No fictitious OAuth scopes.
    security: [],
    paths: Object.fromEntries(
      catalog.tools.map((tool) => {
        const input = z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchema
        return [
          `${paths.basePath}/${tool.name}`,
          {
            get: {
              operationId: tool.operationId,
              summary: tool.summary,
              description: tool.description,
              tags: [tool.source?.label ?? 'Public content'],
              parameters: Object.entries(input.properties ?? {}).map(([name, schema]) => ({
                name,
                in: 'query',
                required: (input.required ?? []).includes(name),
                description: typeof schema === 'object' && schema !== null ? (schema as { description?: string }).description : undefined,
                schema,
              })),
              responses: {
                '200': {
                  description: 'Published public content only.',
                  headers: quota,
                  content: { 'application/json': { schema: z.toJSONSchema(tool.output) } },
                },
                '400': problem('Invalid or unknown parameters.'),
                '404': problem('No published entry matches.'),
                '429': problem('Burst budget exhausted; honour Retry-After.'),
                '503': problem('Content temporarily unavailable.'),
              },
            },
          },
        ]
      }),
    ),
  }
}
