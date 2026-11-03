import { describe, expect, test } from 'bun:test'

import { altText, seo, shorten, translate } from './actions'
import type { GenerateArgs } from './actions'
import { markdownToLexical } from './lexical'
import { stubPayload } from './testing/stub-payload'

describe('field actions', () => {
  test('altText reads the image bytes from the request origin, sends them inline and clips to 125 chars', async () => {
    const payload = stubPayload({ collections: [{ slug: 'media', fields: [], upload: true }] })
    const media = await payload.create({ collection: 'media', data: { url: '/api/media/file/cat.jpg', filename: 'cat.jpg', mimeType: 'image/jpeg' } })
    let fetched = ''
    let seen: GenerateArgs | null = null
    const result = await altText({
      payload,
      mediaId: media.id,
      origin: 'https://cms.example',
      fetchImpl: (async (url: string) => {
        fetched = String(url)
        return new Response(new Uint8Array([255, 216, 255]), { headers: { 'content-type': 'image/jpeg' } })
      }) as unknown as typeof fetch,
      generate: async (args) => {
        seen = args
        return { text: `"${'A tabby cat asleep on a sunny windowsill '.repeat(5)}"` }
      },
    })
    expect(fetched).toBe('https://cms.example/api/media/file/cat.jpg')
    const content = seen!.messages?.[0]?.content as Array<{ type: string; image?: Uint8Array; mediaType?: string }>
    expect(content[1]).toMatchObject({ type: 'image', mediaType: 'image/jpeg' })
    expect(content[1]?.image?.byteLength).toBe(3)
    expect(result.value.length).toBeLessThanOrEqual(125)
    expect(result.value.startsWith('A tabby cat')).toBe(true)
    expect(result.costUsd).toBeNull()
    expect(await payload.findByID({ collection: 'proposals', id: result.proposalId! })).toMatchObject({ targetCollection: 'media', targetId: String(media.id), status: 'accepted' })
  })
  test('altText refuses files that are not images', async () => {
    const payload = stubPayload({ collections: [{ slug: 'media', fields: [], upload: true }] })
    const pdf = await payload.create({ collection: 'media', data: { url: '/api/media/file/a.pdf', filename: 'a.pdf', mimeType: 'application/pdf' } })
    await expect(altText({ payload, mediaId: pdf.id, generate: async () => ({ text: 'x' }) })).rejects.toThrow('Only images')
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
