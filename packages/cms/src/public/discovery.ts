import type { PublicSite } from './catalog'
import type { PublicPaths } from './paths'

/** MCP server card for `.well-known/mcp/server-card.json`. */
export const serverCard = (site: PublicSite, paths: PublicPaths) => {
  const host = new URL(site.url).hostname.replace(/^www\./, '')
  const reverseDomain = host.split('.').reverse().join('.')
  const id = host.split('.')[0] ?? 'site'
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
    name: `${reverseDomain}/${id}`,
    title: site.name,
    description: site.description ?? `Published content from ${site.name}: read-only list, get and search tools.`,
    version: '1.0.0',
    websiteUrl: `${site.url}/`,
    remotes: [{ type: 'streamable-http', url: `${site.url}${paths.mcp}` }],
  }
}

export const discoveryHeaders = (contentType = 'application/json; charset=utf-8'): Record<string, string> => ({
  'Content-Type': contentType,
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600',
})
