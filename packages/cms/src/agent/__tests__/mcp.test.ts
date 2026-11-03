import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import type { Config, PayloadRequest } from 'payload'

import {
  API_KEYS_SLUG, apiKeysCollectionOverride, COLLECTION_TOOLS, contractPlugin, GLOBAL_TOOLS, keyAllows, makeAuthorizeMCP,
  mcpConfigFromContract, mcpPluginOptions,
} from '../mcp'
import { contractCatalog } from '../contract'
import { sampleConfig } from './fixture'

const site = { name: 'Demo Co.' }

describe('mcpConfigFromContract', () => {
  const mcp = mcpConfigFromContract(sampleConfig(), { site })
  test('delete is disabled everywhere; writable collections keep create/update', () => {
    expect(mcp.collections?.posts?.tools).toEqual({ delete: false })
    expect(mcp.collections?.posts?.description).toContain('Writable by agents: title, excerpt, body. Everything else is read-only.')
    expect(mcp.collections?.posts?.description).toContain('Writes land as proposals for review.')
    expect(mcp.collections?.posts?.description).toContain('Never publish.')
  })
  test('read-only collections lose every write tool', () => {
    expect(mcp.collections?.people?.tools).toEqual({ delete: false, create: false, update: false, duplicate: false, restoreVersion: false, getUploadInstructions: false })
    expect(mcp.collections?.people?.description).toContain('Read-only to agents.')
  })
  test('private collections have every built-in tool switched off and no description', () => {
    expect(Object.keys(mcp.collections?.inbox?.tools ?? {})).toEqual([...COLLECTION_TOOLS])
    expect(Object.values(mcp.collections?.inbox?.tools ?? {}).every((v) => v === false)).toBe(true)
    expect(mcp.collections?.inbox?.description).toBeUndefined()
  })
  test('globals: writable keeps update, review none says nothing about proposals', () => {
    expect(mcp.globals?.['site-settings']?.tools).toEqual({})
    expect(mcp.globals?.['site-settings']?.description).not.toContain('proposals')
    expect(GLOBAL_TOOLS).toContain('restoreGlobalVersion')
  })
})

describe('apiKeysCollectionOverride', () => {
  const keys = apiKeysCollectionOverride('users')
  test('is the API Keys collection under Admin with four permissions defaulting on', () => {
    expect(keys.slug).toBe(API_KEYS_SLUG)
    expect(keys.labels).toEqual({ singular: 'API Key', plural: 'API Keys' })
    expect(keys.admin?.group).toBe('Admin')
    const row = keys.fields.find((f) => f.type === 'row')
    const boxes = row && 'fields' in row ? row.fields.map((f) => ('name' in f ? f.name : '')) : []
    expect(boxes).toEqual(['allowRead', 'allowCreate', 'allowEdit', 'allowDelete'])
    expect(keys.custom).toEqual({ sitekick: { private: true } })
  })
})

describe('keyAllows / makeAuthorizeMCP', () => {
  const catalog = contractCatalog(sampleConfig())
  const priv = new Set(['inbox'])
  test('maps the four boxes onto tool keys and hides private entities', () => {
    const key = { allowRead: true, allowCreate: false, allowEdit: true, allowDelete: false }
    expect(keyAllows(key, { type: 'collectionTool', collectionSlug: 'posts', configKey: 'find' }, priv)).toBe(true)
    expect(keyAllows(key, { type: 'collectionTool', collectionSlug: 'posts', configKey: 'create' }, priv)).toBe(false)
    expect(keyAllows(key, { type: 'collectionTool', collectionSlug: 'posts', configKey: 'update' }, priv)).toBe(true)
    expect(keyAllows(key, { type: 'collectionTool', collectionSlug: 'posts', configKey: 'delete' }, priv)).toBe(false)
    expect(keyAllows(key, { type: 'collectionTool', collectionSlug: 'inbox', configKey: 'find' }, priv)).toBe(false)
    expect(keyAllows(key, { type: 'tool', configKey: 'getConfigInfo' }, priv)).toBe(false)
  })
  test('resolves a bearer key to its user and filters items', async () => {
    const secret = 's3cret'
    const index = createHmac('sha256', secret).update('tok').digest('hex')
    const calls: unknown[] = []
    const req = {
      headers: new Headers({ Authorization: 'Bearer tok' }),
      user: undefined,
      t: (k: string) => k,
      payload: {
        secret,
        find: async (args: { where: { apiKeyIndex: { equals: string } } }) => {
          calls.push(args)
          return { docs: args.where.apiKeyIndex.equals === index ? [{ user: 7, allowRead: true, allowDelete: true }] : [] }
        },
        findByID: async () => ({ id: 7, email: 'a@b.c', roles: ['editor'] }),
      },
    } as unknown as PayloadRequest
    const authorize = makeAuthorizeMCP(catalog, { filterItems: async ({ items }) => items.filter((i) => i.configKey !== 'delete') })
    const items = [
      { type: 'collectionTool' as const, collectionSlug: 'posts', configKey: 'find' },
      { type: 'collectionTool' as const, collectionSlug: 'posts', configKey: 'delete' },
      { type: 'collectionTool' as const, collectionSlug: 'posts', configKey: 'update' },
    ]
    const result = await authorize({ req, overrideAccess: true, pluginConfig: { items } })
    expect(result.overrideAccess).toBe(false)
    expect(result.items.map((i) => i.configKey)).toEqual(['find'])
    expect(req.user).toMatchObject({ id: 7, collection: 'users', _strategy: 'mcp-api-key' })
  })
  test('rejects a missing or unknown key', async () => {
    const authorize = makeAuthorizeMCP(catalog)
    const base = { t: (k: string) => k, payload: { secret: 'x', find: async () => ({ docs: [] }) } }
    await expect(authorize({ req: { ...base, headers: new Headers() } as unknown as PayloadRequest, overrideAccess: false, pluginConfig: { items: [] } })).rejects.toThrow()
    await expect(authorize({ req: { ...base, headers: new Headers({ Authorization: 'Bearer nope' }) } as unknown as PayloadRequest, overrideAccess: false, pluginConfig: { items: [] } })).rejects.toThrow()
  })
})

describe('mcpPluginOptions / contractPlugin', () => {
  test('bundles config, authoriser and instructions with the site name', () => {
    const options = mcpPluginOptions(sampleConfig(), { site })
    expect(options.mcp.serverOptions.serverInfo.name).toBe('Demo Co. CMS')
    expect(options.mcp.serverOptions.options.instructions).toContain('Demo Co.')
    expect(typeof options.overrideGetAuthorizedMCP).toBe('function')
  })
  test('stores the catalog and mcp options on custom.sitekick and adds the keys collection', async () => {
    const config = sampleConfig() as Config
    const out = contractPlugin({ site })(config) as Config
    const sitekick = (out.custom as { sitekick: { contract: unknown[]; mcp: { collections: Record<string, unknown> } } }).sitekick
    expect(sitekick.contract.map((c) => (c as { slug: string }).slug)).toContain(API_KEYS_SLUG)
    expect(sitekick.mcp.collections[API_KEYS_SLUG]).toMatchObject({ tools: { find: false, create: false } })
    expect(out.collections?.some((c) => c.slug === API_KEYS_SLUG)).toBe(true)
    const payload = { authStrategies: [{ name: `${API_KEYS_SLUG}-api-key` }, { name: 'local-jwt' }] }
    await out.onInit?.(payload as never)
    expect(payload.authStrategies.map((s) => s.name)).toEqual(['local-jwt'])
  })
  test('apiKeys: false leaves the collection list alone', () => {
    const out = contractPlugin({ site, apiKeys: false })(sampleConfig() as Config) as Config
    expect(out.collections?.some((c) => c.slug === API_KEYS_SLUG)).toBe(false)
  })
})
