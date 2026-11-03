import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, Config } from 'payload'

import { AGENT_COMPONENTS, agentUIPlugin } from '../ui'

const people: CollectionConfig = { slug: 'people', fields: [{ name: 'name', type: 'text' }], custom: { sitekick: { agent: { writable: ['bio'], actions: ['enrich'] } } } }
const posts: CollectionConfig = {
  slug: 'posts',
  fields: [{ name: 'title', type: 'text' }],
  admin: { components: { views: { list: { actions: ['./Existing#Action'] } } } },
  custom: { sitekick: { agent: { writable: ['title'], actions: ['draft'] } } },
}
const media: CollectionConfig = { slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }, { name: 'caption', type: 'text' }] }
const config = { collections: [people, posts, media] } as Config

describe('agentUIPlugin', () => {
  test('does nothing without the agents option', () => {
    expect(agentUIPlugin({})(config)).toBe(config)
  })

  test('places buttons from the contract and publishes the client config', () => {
    const out = agentUIPlugin({ agents: {} })(config) as Config
    const [p, n, m] = out.collections!
    expect(p.admin?.components?.edit?.beforeDocumentControls).toEqual([AGENT_COMPONENTS.enrich])
    expect(n.admin?.components?.views?.list?.actions).toEqual(['./Existing#Action', { path: AGENT_COMPONENTS.draft, clientProps: { collection: 'posts' } }])
    const [alt, caption] = m.fields as Array<{ admin?: { components?: { afterInput?: unknown[] } } }>
    expect(alt.admin?.components?.afterInput).toEqual([AGENT_COMPONENTS.altText])
    expect(caption.admin).toBeUndefined()
    expect((out.admin?.custom as { sitekick: { agents: unknown } }).sitekick.agents).toEqual({ basePath: '/api/agents', enrich: ['people'], draft: ['posts'] })
  })
})
