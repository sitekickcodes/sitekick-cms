# Agent contract, MCP and the public surface

Principle 7 of the plan: collections declare one contract; everything an agent
sees is derived from it. Two layers live here:

- `src/agent/` (`@sitekick/cms/agent`): the contract reader and the editor-side
  MCP (`@payloadcms/plugin-mcp`) configuration, API keys included.
- `src/public/` (`@sitekick/cms/public`): the anonymous read-only surface:
  MCP server, REST mirror, `openapi.json`, `llms.txt`, server card, Markdown.

## Declaring the contract

```ts
custom: {
  sitekick: {
    agent: {
      description: 'A news post shown on /news.',   // one line, for the LLM
      writable: ['title', 'excerpt', 'body'],       // everything else is read-only to agents
      fillEmptyOnly: ['excerpt'],
      review: 'required',                           // 'required' | 'optional' | 'none'
      notes: 'Never publish. Excerpt under 160 chars.',
    },
    seo: { pathPrefix: '/news' },                   // public URL = site.url + prefix + /<slug>
    private: true,                                  // hidden from agents and the catalog entirely
  },
}
```

Defaults when nothing is declared: description from `admin.description`, else
the plural label (plus " Drafts-enabled." when drafts are on); `writable: []`
(read-only to agents); `review: 'required'`; path prefix `/<slug>`.

There is no delete grant. `writable` never includes deleting and the MCP
`delete` tool is switched off for every collection; put any exception in
`notes` for a human, not the agent.

## What is derived

`readContract(entity)` / `contractCatalog(config)` produce `ResolvedContract`:
slug, kind, label, description, writable, fillEmptyOnly, review, notes,
private, drafts, titleField, pathPrefix and the top-level fields (name, type,
required; hidden and UI fields excluded, rows/collapsibles/unnamed tabs
flattened).

From the catalog:

| Surface | Source |
| --- | --- |
| plugin-mcp per-entity `description` | description + notes + "Writable by agents: a, b. Everything else is read-only." + "Writes land as proposals for review." (review != none) |
| plugin-mcp `tools` | `delete: false` everywhere; `create/update/duplicate/restoreVersion/getUploadInstructions: false` when `writable` is empty; every tool `false` when private (plugin-mcp's map is not an allowlist) |
| API Keys | `payload-mcp-api-keys`: label "API Keys", group Admin, admin-only, `user` relationship, Read/Create/Edit/Delete boxes defaulting on |
| `overrideGetAuthorizedMCP` | Bearer key → bound user (`req.user`, `_strategy: 'mcp-api-key'`) → tools the four boxes allow, private entities dropped, `overrideAccess: false` |
| Public catalog | every non-private collection with anonymous `access.read` and a `slug` field: `list_<slug>`, `get_<slug>`; one `search`; non-private public globals: `get_<slug>` |
| OpenAPI 3.1, llms.txt, MCP tools, REST | the public catalog |

Public entries have one fixed shape, whatever the collection:
`{ id, title, slug, url, excerpt, updatedAt }` (title = `admin.useAsTitle`,
excerpt = first textarea else `meta.description`). Only published documents
are read (`draft: false`, `_status: published` where drafts), with Payload
access on and no user. Globals project top-level scalar fields only.

## Wiring the editor MCP

`contractPlugin` runs inside `sitekickCMS`. It stores the catalog on
`config.custom.sitekick.contract`, the plugin-mcp options on
`config.custom.sitekick.mcp`, adds the API Keys collection, and wraps
`onInit` so a key never becomes `req.user` outside `/api/mcp`
(`dropApiKeyLogin`). `mcpPlugin` goes after `sitekickCMS` in `plugins`:

```ts
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { filterMCPItems } from '@payloadcms/plugin-mcp/internal'
import { mcpPluginOptions } from '@sitekick/cms/agent'

plugins: [
  sitekickCMS({ site }),
  mcpPlugin(mcpPluginOptions(config, { site, filterItems: filterMCPItems })),
]
```

`@payloadcms/plugin-mcp` is the app's dependency, not this package's, so the
config shape is mirrored structurally (`MCPPluginOptionsShape`) and
`filterMCPItems` is passed in. Without `filterItems` every non-private tool is
advertised and Payload refuses forbidden calls at operation time.

## Wiring the public surface (Next)

```ts
// src/lib/agent-surface.ts
import { getPayload } from 'payload'
import { createPublicSurface } from '@sitekick/cms/public'
import config from '@payload-config'

export const surface = createPublicSurface({
  payload: () => getPayload({ config }),
  site: { name: 'Demo Co.', url: process.env.NEXT_PUBLIC_SERVER_URL!, description: 'What the site is.' },
  // catalog: { tools: [definePublicTool({ ... })] }  // app-specific extras
})
```

```ts
// src/app/llms.txt/route.ts
export const GET = surface.llmsTxt
// src/app/openapi.json/route.ts
export const GET = surface.openapi
// src/app/mcp/route.ts
export const POST = surface.mcp
export const GET = surface.mcp      // answers 405: stateless, no SSE stream
export const OPTIONS = surface.mcp
// src/app/.well-known/mcp/server-card.json/route.ts
export const GET = surface.serverCard
// src/app/api/public/v1/[tool]/route.ts
export const GET = async (req: Request, ctx: { params: Promise<{ tool: string }> }) =>
  surface.rest(req, (await ctx.params).tool)
export const OPTIONS = GET
// src/app/md/[...path]/route.ts
export const GET = async (req: Request, ctx: { params: Promise<{ path: string[] }> }) =>
  surface.markdown(req, (await ctx.params).path)
```

Paths are configurable (`paths` option) and the documents link to them.
`prefersMarkdown(accept)` and `markdownResponse()` are exported for an
`Accept: text/markdown` negotiation in the app's own page routes.

Rate limiting is an in-memory budget per process (120 requests / 60 s per
client IP by default), advertised with `RateLimit-Policy` / `RateLimit` and
`Retry-After` on 429. It is a per-instance ceiling, not a global quota.

MCP: stateless Streamable HTTP via `@modelcontextprotocol/server`'s
`createMcpHandler`. Modern clients get JSON; 2025-era clients get SSE framing.
Bodies over 16 KiB are refused, browser `Origin` must match, every tool is
annotated read-only.
