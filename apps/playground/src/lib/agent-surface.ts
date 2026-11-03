import config from '@payload-config'
import { createPublicSurface } from '@sitekick/cms/public'
import { getPayload } from 'payload'

import { siteUrl } from './site'

/**
 * The public, anonymous, read-only agent surface: llms.txt, OpenAPI, a
 * Markdown view of every public document and an MCP server. All derived
 * from the collections' agent contracts; nothing is hand-listed here.
 */
export const surface = createPublicSurface({
  payload: () => getPayload({ config }),
  site: { name: 'Demo Co.', url: siteUrl, description: 'The Sitekick CMS playground: a demo company site.' },
})
