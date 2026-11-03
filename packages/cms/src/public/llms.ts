import type { PublicCatalog, PublicSite } from './catalog'
import type { PublicPaths } from './paths'

/** https://llmstxt.org: a short map of the site and its agent surface. */
export const llmsTxt = (catalog: PublicCatalog, site: PublicSite, paths: PublicPaths): string => {
  const abs = (path: string) => `${site.url}${path}`
  const collections = catalog.tools.filter((t) => t.source?.kind === 'collection' && t.name.startsWith('list_'))
  const globals = catalog.tools.filter((t) => t.source?.kind === 'global')
  const custom = catalog.tools.filter((t) => !t.source)
  const lines: string[] = [`# ${site.name}`, '']
  if (site.description) lines.push(`> ${site.description}`, '')
  if (collections.length) {
    lines.push('## Content', '')
    for (const tool of collections) {
      const slug = tool.source!.slug
      lines.push(
        `- [${tool.source!.label}](${abs(`${paths.basePath}/${tool.name}`)}): ${tool.description} Markdown per entry at ${abs(`${paths.markdown}/${slug}/<slug>`)}.`,
      )
    }
    lines.push('')
  }
  if (globals.length) {
    lines.push('## Site-wide', '')
    for (const tool of globals) lines.push(`- [${tool.source!.label}](${abs(`${paths.basePath}/${tool.name}`)}): ${tool.description}`)
    lines.push('')
  }
  lines.push('## Tools', '', 'Each tool is an MCP tool and a REST GET with the same name and parameters.', '')
  for (const tool of catalog.tools) lines.push(`- \`${tool.name}\`: ${tool.summary}. GET ${abs(`${paths.basePath}/${tool.name}`)}`)
  if (custom.length) lines.push('', `Custom tools: ${custom.map((t) => `\`${t.name}\``).join(', ')}.`)
  lines.push(
    '',
    '## Agent access',
    '',
    `- MCP (Streamable HTTP, no auth, read-only): ${abs(paths.mcp)}`,
    `- OpenAPI 3.1: ${abs(paths.openapi)}`,
    `- MCP server card: ${abs(paths.serverCard)}`,
    `- Markdown entries: ${abs(paths.markdown)}/<collection>/<slug>`,
    '',
    'Only published content is returned. Nothing here can write, submit forms or read private records.',
    'Rate limit: 120 requests per minute per client per instance; honour Retry-After on 429.',
    '',
  )
  return lines.join('\n')
}
