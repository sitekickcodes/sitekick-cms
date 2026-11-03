import { describe, expect, test } from 'bun:test'

import { agentContractFor, createProposal, filterPatchByContract, patchToData } from './proposals'
import type { Receipt } from './receipts'
import { stubPayload } from './testing/stub-payload'

const receipt: Receipt = { url: 'https://example.org/', fetchedAt: '2026-11-03T00:00:00Z', sha256: 'abc', excerpt: 'Jane is director.' }

const people = {
  slug: 'people',
  fields: [{ name: 'name', type: 'text' }, { name: 'website', type: 'text' }, { name: 'bio', type: 'textarea' }, { name: 'email', type: 'email' }],
  custom: { sitekick: { agent: { writable: ['bio', 'social'], fillEmptyOnly: ['website'], review: 'required' } } },
}

describe('filterPatchByContract', () => {
  const contract = agentContractFor({ config: { collections: [people] } }, 'people')
  test('keeps writable fields with receipts, drops the rest with reasons', () => {
    const out = filterPatchByContract({
      contract,
      patch: {
        bio: { value: 'Jane is director.', receipts: [receipt] },
        email: { value: 'jane@example.org', receipts: [receipt] },
        social: { value: [{ platform: 'x', url: 'https://x.com/j' }] },
        website: { value: 'https://example.org', receipts: [receipt] },
        'meta.title': { value: 'x', receipts: [receipt] },
      },
      current: { id: 1, name: 'Jane', website: 'https://already.example' },
    })
    expect(Object.keys(out.propose)).toEqual(['bio'])
    expect(out.direct).toEqual({})
    expect(out.dropped).toEqual({
      email: 'field is not writable by agents',
      social: 'no receipt',
      website: 'field already has a value (fillEmptyOnly)',
      'meta.title': 'field is not writable by agents',
    })
  })
  test('fillEmptyOnly passes when empty and snapshots current', () => {
    const out = filterPatchByContract({ contract, patch: { website: { value: 'https://example.org', receipts: [receipt] } }, current: { id: 1, website: '' } })
    expect(out.propose.website).toMatchObject({ value: 'https://example.org', current: '' })
  })
  test('review none: receipts optional, fillEmptyOnly fields go direct', () => {
    const none = { writable: ['bio'], fillEmptyOnly: ['website'], review: 'none' as const }
    const out = filterPatchByContract({ contract: none, patch: { website: { value: 'https://e.org' }, bio: { value: 'Bio text' } }, current: { id: 1 } })
    expect(Object.keys(out.direct)).toEqual(['website'])
    expect(Object.keys(out.propose)).toEqual(['bio'])
  })
  test('no contract or a private collection refuses everything', () => {
    expect(filterPatchByContract({ contract: null, patch: { bio: { value: 'x', receipts: [receipt] } }, current: null }).dropped).toEqual({ bio: 'collection has no agent contract' })
    expect(agentContractFor({ config: { collections: [{ slug: 'secrets', fields: [], custom: { sitekick: { private: true, agent: { writable: ['x'] } } } }] } }, 'secrets')).toBeNull()
  })
  test('patchToData nests dotted paths', () => {
    expect(patchToData({ 'meta.title': { value: 'T' }, 'meta.description': { value: 'D' }, name: { value: 'N' } })).toEqual({ meta: { title: 'T', description: 'D' }, name: 'N' })
  })
})

describe('createProposal', () => {
  test('writes the spec shape, supersedes open proposals for the target, passes the loop guard', async () => {
    const payload = stubPayload({ collections: [people] })
    const jane = await payload.create({ collection: 'people', data: { name: 'Jane', website: '' } })
    const old = await payload.create({ collection: 'proposals', data: { title: 'old', status: 'open', targetCollection: 'people', targetId: String(jane.id), patch: {} } })
    const other = await payload.create({ collection: 'proposals', data: { title: 'other', status: 'open', targetCollection: 'people', targetId: 'someone-else', patch: {} } })
    const setupWrites = payload.writes.length
    const result = await createProposal(payload, {
      targetCollection: 'people',
      targetId: jane.id,
      kind: 'enrich',
      title: 'Enrich: Jane',
      agent: 'enrich@1',
      runId: 'r1',
      summary: 'Found the site.',
      patch: { bio: { value: 'Jane is director.', receipts: [receipt] }, website: { value: 'https://example.org', receipts: [receipt] }, email: { value: 'x', receipts: [receipt] } },
    })
    expect(result.id).not.toBeNull()
    expect(Object.keys(result.proposed).sort()).toEqual(['bio', 'website'])
    expect(result.dropped).toEqual({ email: 'field is not writable by agents' })
    const doc = (await payload.findByID({ collection: 'proposals', id: result.id! }))!
    expect(doc).toMatchObject({ title: 'Enrich: Jane', kind: 'enrich', status: 'open', targetCollection: 'people', targetId: String(jane.id), run: 'r1', agent: 'enrich@1' })
    expect(String(doc.summary)).toContain('Found the site.')
    expect(String(doc.summary)).toContain('email: field is not writable')
    expect((await payload.findByID({ collection: 'proposals', id: old.id }))?.status).toBe('superseded')
    expect((await payload.findByID({ collection: 'proposals', id: other.id }))?.status).toBe('open')
    expect(payload.writes.slice(setupWrites).every((w) => w.context?.sitekickAgent === 'enrich@1')).toBe(true)
    expect(payload.writes.slice(setupWrites)).toHaveLength(2)
  })
  test('review none + fillEmptyOnly writes directly and creates no proposal', async () => {
    const venues = { slug: 'venues', fields: [{ name: 'website', type: 'text' }], custom: { sitekick: { agent: { fillEmptyOnly: ['website'], review: 'none' } } } }
    const payload = stubPayload({ collections: [venues] })
    const hall = await payload.create({ collection: 'venues', data: { name: 'Hall' } })
    const result = await createProposal(payload, { targetCollection: 'venues', targetId: hall.id, kind: 'enrich', title: 'x', agent: 'enrich@1', patch: { website: { value: 'https://hall.example' } } })
    expect(result.id).toBeNull()
    expect(result.direct.website?.value).toBe('https://hall.example')
    expect((await payload.findByID({ collection: 'venues', id: hall.id }))?.website).toBe('https://hall.example')
    expect(payload.store.get('proposals') ?? []).toHaveLength(0)
  })
  test('a draft proposal has no targetId and supersedes nothing', async () => {
    const posts = { slug: 'posts', fields: [{ name: 'title', type: 'text' }], custom: { sitekick: { agent: { writable: ['title'], review: 'required' } } } }
    const payload = stubPayload({ collections: [posts] })
    const result = await createProposal(payload, { targetCollection: 'posts', kind: 'draft', title: 'Draft: x', agent: 'draft@1', patch: { title: { value: 'Hello', receipts: [receipt] } } })
    const doc = (await payload.findByID({ collection: 'proposals', id: result.id! }))!
    expect(doc.targetId).toBeUndefined()
    expect(payload.writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })
})
