import { asAgentPayload, createProposal } from '@sitekick/agents'
import { getPayload } from 'payload'

import config from '../src/payload.config'

/**
 * Demo data for the review inbox: a person with an empty profile, a
 * proposal to fill it (with receipts), and a run waiting on a question.
 * Idempotent by name. Run: `bun scripts/seed-review.ts`.
 */
const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'people', where: { name: { equals: 'Jane Doe' } }, limit: 1, overrideAccess: true })
const person =
  existing.docs[0] ??
  (await payload.create({ collection: 'people', data: { name: 'Jane Doe', slug: 'jane-doe', role: 'Head of Partnerships' }, overrideAccess: true }))

const receipt = {
  url: 'https://example.com/team/jane-doe',
  fetchedAt: new Date().toISOString(),
  sha256: 'demo-'.padEnd(64, '0'),
  title: 'Jane Doe — Example Co.',
  excerpt: 'Jane Doe leads partnerships at Example Co., where she has worked with regional nonprofits since 2019.',
}
const result = await createProposal(asAgentPayload(payload), {
  targetCollection: 'people',
  targetId: person.id,
  kind: 'enrich',
  title: `Enrich: ${person.name}`,
  agent: 'enrich@demo',
  summary: 'Found an official profile page and a public bio. No headshot with a usable licence.',
  patch: {
    bio: { value: 'Jane Doe leads partnerships at Example Co., working with regional nonprofits since 2019.', receipts: [receipt], note: 'Paraphrased from the team page.' },
    website: { value: 'https://example.com/team/jane-doe', receipts: [receipt] },
  },
})
console.log('proposal', result)

const runs = await payload.find({ collection: 'runs', where: { title: { equals: 'Enrich: Jane Doe (demo run)' } }, limit: 1, overrideAccess: true })
if (!runs.docs[0]) {
  await payload.create({
    collection: 'runs',
    overrideAccess: true,
    data: {
      title: 'Enrich: Jane Doe (demo run)',
      kind: 'enrich',
      status: 'waiting',
      targetCollection: 'people',
      targetId: String(person.id),
      stage: 'Checking the headshot',
      now: 'Two photos found; one is from a conference, one from the team page.',
      model: 'anthropic/claude-sonnet-5-5',
      costUsd: 0.04,
      attempts: 1,
      steps: [
        { label: 'Read the website', status: 'done', detail: 'example.com/team/jane-doe', at: new Date(Date.now() - 60000).toISOString() },
        { label: 'Searched for social profiles', status: 'done', detail: 'LinkedIn found', at: new Date(Date.now() - 40000).toISOString() },
        { label: 'Picking a headshot', status: 'running', at: new Date().toISOString() },
      ],
      question: { text: 'Which photo should be the headshot?', options: ['Team page photo', 'Conference photo', 'Skip the photo'] },
    } as never,
  })
  console.log('run created')
}
process.exit(0)
