/** Where the app mounts each route. Defaults match the README's Next snippets. */
export type PublicPaths = {
  /** REST base; each tool is `GET <basePath>/<tool>`. */
  basePath: string
  mcp: string
  llms: string
  openapi: string
  serverCard: string
  /** Markdown base; entries are `<markdown>/<collection>/<slug>`. */
  markdown: string
}

export const DEFAULT_PATHS: PublicPaths = {
  basePath: '/api/public/v1',
  mcp: '/mcp',
  llms: '/llms.txt',
  openapi: '/openapi.json',
  serverCard: '/.well-known/mcp/server-card.json',
  markdown: '/md',
}
