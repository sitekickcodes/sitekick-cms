import { tool } from 'ai'
import type { Tool } from 'ai'
import { z } from 'zod'

import { globalGuides } from './global'
import type { Guide } from './parse'

export { parseGuide, type Guide, type GuideLoad } from './parse'
export { globalGuides } from './global'

/**
 * Three layers of judgment, most general first:
 *
 *   global   the kit's craft (packages/agents/skills): design, UX, writing, page types
 *   site     the client's `agent/` folder, in their repo: brand, voice, audience, exemplars,
 *            and `blocks/<slug>.md` for how this site uses a block
 *   block    each block's own `custom.guide` in @sitekick/blocks (a site's blocks/<slug>.md wins)
 *
 * `always` guides go into the instructions; the rest are listed, and the agent reads what a
 * task needs with `read_guides`. Prose is judgment the model weighs; whatever must always
 * hold is a validation in code.
 */

/** Site guides replace global ones with the same name; the rest are added after. */
export function mergeGuides(base: Guide[], site: Guide[] = []): Guide[] {
  const bySite = new Map(site.map((g) => [g.name, g]))
  return [...base.map((g) => bySite.get(g.name) ?? g), ...site.filter((g) => !base.some((b) => b.name === g.name))]
}

/** The guides an agent sees: the kit's plus the site's, filtered to this agent. */
export function guidesFor(agent: string, guides: Guide[] = globalGuides): Guide[] {
  return guides.filter((g) => !g.name.startsWith('blocks/') && (g.agents.length === 0 || g.agents.includes(agent)))
}

/** A site's block notes, by block slug (`blocks/hero.md` → `hero`). */
export function blockGuides(guides: Guide[] = []): Record<string, string> {
  const out: Record<string, string> = {}
  for (const g of guides) if (g.name.startsWith('blocks/') && g.body) out[g.name.slice('blocks/'.length)] = g.body
  return out
}

const titled = (g: Guide) => `## ${g.name}${g.source === 'site' ? ' (this site)' : ''}\n${g.body}`

/** The guides section of an agent's instructions. Empty when there are none. */
export function guidesPrompt(guides: Guide[]): string {
  if (!guides.length) return ''
  const always = guides.filter((g) => g.load === 'always')
  // Global first, the site's last: closer to the task, and it wins where they disagree.
  const ordered = [...always.filter((g) => g.source === 'global'), ...always.filter((g) => g.source === 'site')]
  const onDemand = guides.filter((g) => g.load !== 'always')
  const parts = ['# Guides', 'How to work on this site. Guides marked "(this site)" are the client\'s own and win over the general ones where they disagree.']
  parts.push(...ordered.map(titled))
  if (onDemand.length) {
    parts.push(
      `## More guides\nRead the ones this task needs with read_guides before you propose (skip it for a small wording change):\n${onDemand.map((g) => `- ${g.name}${g.source === 'site' ? ' (this site)' : ''}: ${g.description}`).join('\n')}`,
    )
  }
  return parts.join('\n\n')
}

/** `read_guides`: the on-demand guides, by name. Absent when there are none to read. */
export function readGuidesTool(guides: Guide[]): Record<string, Tool> {
  const readable = guides.filter((g) => g.load !== 'always')
  if (!readable.length) return {}
  const byName = new Map(readable.map((g) => [g.name, g]))
  return {
    read_guides: tool({
      description: 'Read guides from the "More guides" list by name, e.g. ["ux/calls-to-action", "page-types/landing"].',
      inputSchema: z.object({ names: z.array(z.string().min(1)).min(1).max(6) }),
      execute: async ({ names }) => {
        const found = names.map((n) => byName.get(n.replace(/\.md$/, '').replace(/ \(this site\)$/, ''))).filter((g): g is Guide => Boolean(g))
        const missing = names.filter((n) => !byName.has(n.replace(/\.md$/, '').replace(/ \(this site\)$/, '')))
        return {
          guides: found.map((g) => ({ name: g.name, body: g.body })),
          ...(missing.length ? { unknown: missing, available: [...byName.keys()] } : {}),
        }
      },
    }),
  }
}
