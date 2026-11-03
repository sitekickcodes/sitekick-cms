import { describe, expect, test } from 'bun:test'

import { altText, seo, shorten, translate } from './actions'
import type { GenerateArgs } from './actions'
import { markdownToLexical } from './lexical'
import { stubPayload } from './testing/stub-payload'

describe('field actions', () => {
  test('altText sends the absolute image URL as an image part and clips to 125 chars', async () => {
    const payload = stubPayload({ collections: [{ slug: 'media', fields: [], upload: true }] })
    const media = await payload.create({ collection: 'media', data: { url: '/api/media/file/cat.jpg', filename: 'cat.jpg' } })
    let seen: GenerateArgs | null = null
    const result = await altText({
      payload,
      mediaId: media.id,
      generate: async (args) => {
        seen = args
        return { text: `"${'A tabby cat asleep on a sunny windowsill '.repeat(5)}"` }
      },
    })
    const content = seen!.messages?.[0]?.content as Array<{ type: string; image?: URL }>
    expect(content[1]).toMatchObject({ type: 'image' })
    expect(String(content[1]?.image)).toBe('http://localhost:3100/api/media/file/cat.jpg')
    expect(result.value.length).toBeLessThanOrEqual(125)
    expect(result.value.startsWith('A tabby cat')).toBe(true)
    expect(result.costUsd).toBeNull()
    expect(await payload.findByID({ collection: 'proposals', id: result.proposalId! })).toMatchObject({ targetCollection: 'media', targetId: String(media.id), status: 'accepted' })
  })
  test('seo parses the two lines from the document text', async () => {
    const payload = stubPayload({ collections: [{ slug: 'posts', fields: [] }] })
    const post = await payload.create({ collection: 'posts', data: { title: 'Parking', content: markdownToLexical('The car park closes in May.') } })
    let prompt = ''
    const result = await seo({
      payload,
      collection: 'posts',
      id: post.id,
      generate: async (args) => {
        prompt = args.prompt ?? ''
        return { text: 'Title: Town hall parking changes\nDescription: The north car park closes for resurfacing from May.' }
      },
    })
    expect(prompt).toContain('The car park closes in May.')
    expect(result.value).toEqual({ title: 'Town hall parking changes', description: 'The north car park closes for resurfacing from May.' })
  })
  test('shorten and translate return the model text; no payload means no audit row', async () => {
    const short = await shorten({ text: 'A rather long sentence that goes on.', maxChars: 12, generate: async () => ({ text: 'A long one that still goes on' }) })
    expect(short.value.length).toBeLessThanOrEqual(12)
    expect(short.proposalId).toBeNull()
    const t = await translate({ text: 'Hello', to: 'French', generate: async (args) => ({ text: args.system?.includes('French') ? 'Bonjour' : '?' }) })
    expect(t.value).toBe('Bonjour')
  })
})
