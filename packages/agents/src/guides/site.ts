import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

import { mergeGuides } from './index'
import { globalGuides } from './global'
import { parseGuide, type Guide } from './parse'

/**
 * Read a site's guides from its `agent/` folder (Node only; `@sitekick/agents/guides`).
 *
 * Top-level files (brand.md, voice.md, audience.md, exemplars.md…) load into every run by
 * default: they are short and always relevant. Files in subfolders are on demand, except
 * `blocks/<slug>.md`, which joins that block's entry in the catalogue. Frontmatter overrides
 * either default. A missing folder means no site guides.
 */
export async function loadSiteGuides(dir: string): Promise<Guide[]> {
  if (!existsSync(dir)) return []
  const files = await walk(dir)
  const guides: Guide[] = []
  for (const file of files.sort()) {
    const name = relative(dir, file).split(sep).join('/').replace(/\.md$/, '')
    if (/(^|\/)readme$/i.test(name)) continue
    const guide = parseGuide(name, await readFile(file, 'utf8'), 'site', { load: name.includes('/') ? 'on-demand' : 'always' })
    // A scaffold (only a heading, the rest in comments) steers nothing until it is written.
    if (guide.body.replace(/^#.*$/gm, '').trim()) guides.push(guide)
  }
  return guides
}

/** The kit's guides with a site's on top: what `createAgentRoutes({ guides })` wants. */
export async function loadGuides(dir: string): Promise<Guide[]> {
  return mergeGuides(globalGuides, await loadSiteGuides(dir))
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(path)))
    else if (entry.name.endsWith('.md')) out.push(path)
  }
  return out
}
