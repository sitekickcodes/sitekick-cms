import { asAgentPayload, rewrite, runDraft, runEnrich } from '@sitekick/agents'
import { getPayload } from 'payload'

import config from '../src/payload.config'

/**
 * Exercise the agent kit against a live model through AI Gateway: one field
 * action, one Enrich run, one Draft run. Writes runs and proposals (never
 * documents) to whatever database DATABASE_URL points at.
 * Run: `bun scripts/agents-live.ts [enrich|draft|rewrite]...`
 */
const only = new Set(process.argv.slice(2))
const want = (step: string) => only.size === 0 || only.has(step)
const payload = await getPayload({ config })
const agents = asAgentPayload(payload)
const time = async <T>(label: string, work: () => Promise<T>) => {
  const started = Date.now()
  try {
    const result = await work()
    console.log(`\n✓ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`)
    return result
  } catch (err) {
    console.log(`\n✗ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`)
    console.error(err)
    process.exitCode = 1
    return null
  }
}

if (want('rewrite')) {
  const result = await time('rewrite', () =>
    rewrite({ payload: agents, text: 'We are super excited to announce that our team has been working really hard on a brand new thing.', instruction: 'Make it plain and short' }),
  )
  if (result) console.log(result)
}

if (want('enrich')) {
  const name = 'Guillermo Rauch'
  const existing = await payload.find({ collection: 'people', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
  const person = existing.docs[0] ?? (await payload.create({ collection: 'people', data: { name, slug: 'guillermo-rauch', role: 'CEO, Vercel' }, overrideAccess: true }))
  const result = await time(`enrich people/${person.id}`, () => runEnrich(agents, { targetCollection: 'people', targetId: person.id }))
  if (result) console.log(JSON.stringify(result, null, 2).slice(0, 4000))
}

if (want('draft')) {
  const notes = [
    'Volunteer day recap, Saturday Oct 25.',
    '- 40 volunteers, planted 120 trees along the river path',
    '- partnered with the parks department',
    '- next one is in spring, sign-ups open in February',
    '- thank the bakery on 3rd street for donating breakfast',
  ].join('\n')
  const result = await time('draft posts', () => runDraft(agents, { targetCollection: 'posts', notes, title: 'Volunteer day recap' }))
  if (result) console.log(JSON.stringify(result, null, 2).slice(0, 4000))
}

process.exit()
