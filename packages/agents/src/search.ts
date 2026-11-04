import { gateway, tool, type Tool } from 'ai'
import { z } from 'zod'

import { fetchWithReceipt } from './receipts'

/**
 * Web search for leads. Default: a Gateway-executed search tool
 * (`gateway.tools.exaSearch`), which runs server-side for any model with the
 * same Gateway credential, so there is nothing else to configure. A client
 * that prefers its own search backend sets SITEKICK_SEARCH_URL to an endpoint
 * that takes `?q=` and returns `{ results: [{ title, url, snippet }] }`.
 * SITEKICK_SEARCH picks another Gateway tool (exa | perplexity | parallel).
 * Search results are leads only: a fact counts once fetch_page has read it.
 */
export type SearchHit = { title: string; url: string; snippet?: string }

const customResponse = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string().optional() })),
})

export function webSearchTool(env: Record<string, string | undefined> = process.env): Tool {
  const custom = env.SITEKICK_SEARCH_URL?.trim()
  if (custom) {
    return tool({
      description: 'Search the web for leads (titles, URLs, snippets). Confirm anything you use with fetch_page.',
      inputSchema: z.object({ query: z.string().min(2).max(200) }),
      execute: async ({ query }) => {
        const target = new URL(custom)
        target.searchParams.set('q', query)
        // Through the guarded fetch so a misconfigured search URL cannot reach a private host either.
        const page = await fetchWithReceipt(target.toString(), { archive: false, maxBytes: 512 * 1024 })
        const parsed = customResponse.safeParse(JSON.parse(page.text))
        if (!parsed.success) throw new Error('SITEKICK_SEARCH_URL returned an unexpected shape')
        return { results: parsed.data.results.slice(0, 10) satisfies SearchHit[] }
      },
    })
  }
  const choice = env.SITEKICK_SEARCH?.trim().toLowerCase()
  if (choice === 'perplexity') return gateway.tools.perplexitySearch({ maxResults: 8 })
  if (choice === 'parallel') return gateway.tools.parallelSearch()
  return gateway.tools.exaSearch({ numResults: 8 })
}
