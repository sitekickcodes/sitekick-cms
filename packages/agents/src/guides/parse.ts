/**
 * Agent guides: Markdown that teaches an agent judgment (design, UX, writing, this client's
 * brand). Pure parsing only; reading folders lives in `./site.ts` (Node only).
 */
export type GuideLoad = 'always' | 'on-demand'

export type Guide = {
  /** Path without `.md`, e.g. `design/composition`, `brand`, `blocks/hero`. Site guides replace global ones of the same name. */
  name: string
  description: string
  load: GuideLoad
  /** Agents that see it (`edit`, `draft`); empty means all. */
  agents: string[]
  /** Where it came from: the kit or the site. */
  source: 'global' | 'site'
  body: string
}

/**
 * Parse a guide file. Frontmatter is a tiny YAML subset: `key: value` and `key: [a, b]`.
 * HTML comments are notes for the people editing the file and never reach the model.
 */
export function parseGuide(name: string, text: string, source: Guide['source'], defaults: Partial<Pick<Guide, 'load' | 'description'>> = {}): Guide {
  let body = text.replace(/\r\n/g, '\n')
  const meta: Record<string, string | string[]> = {}
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(body)
  if (fm) {
    body = body.slice(fm[0].length)
    for (const line of fm[1]!.split('\n')) {
      const m = /^([\w-]+):\s*(.*?)\s*(#.*)?$/.exec(line)
      if (!m) continue
      const raw = m[2]!
      meta[m[1]!] = raw.startsWith('[') ? raw.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean) : raw.replace(/^["']|["']$/g, '')
    }
  }
  body = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim()
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim()
  const load = meta.load === 'always' || meta.load === 'on-demand' ? meta.load : (defaults.load ?? 'on-demand')
  const description = typeof meta.description === 'string' && meta.description ? meta.description : (defaults.description ?? heading ?? name)
  const agents = Array.isArray(meta.agents) ? meta.agents : typeof meta.agents === 'string' && meta.agents ? [meta.agents] : []
  return { name, description, load, agents, source, body }
}
