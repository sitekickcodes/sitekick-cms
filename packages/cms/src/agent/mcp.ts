import type { CollectionSlug } from 'payload'
import { createHmac } from 'node:crypto'
import type { CollectionConfig, Config, Field, PayloadRequest, Plugin } from 'payload'
import { UnauthorizedError } from 'payload'

import { adminOnly } from '../access'
import type { SiteIdentity } from '../types'
import { contractCatalog, type ContractConfig, type ResolvedContract } from './contract'

/**
 * Agent-facing MCP for editors and their agents: `@payloadcms/plugin-mcp`
 * configured from the contract instead of by hand. Every tool call is a
 * Local API operation with `overrideAccess: false` as the key's bound user,
 * so Payload access, hooks and versions behave exactly as for an editor.
 *
 * The plugin's types are mirrored structurally here (`MCPConfigShape`)
 * because `@payloadcms/plugin-mcp` is the app's dependency, not this
 * package's: `mcpPlugin(mcpPluginOptions(config, { site }))` type-checks in
 * the app without this package importing the plugin.
 */

/** Built-in collection tool keys (plugin-mcp `COLLECTION_BUILTINS`). */
export const COLLECTION_TOOLS = [
  'count', 'countVersions', 'create', 'delete', 'duplicate', 'find', 'findDistinct', 'findVersionByID',
  'findVersions', 'getCollectionSchema', 'getUploadInstructions', 'restoreVersion', 'update',
] as const
/** Built-in global tool keys (plugin-mcp `GLOBAL_BUILTINS`). */
export const GLOBAL_TOOLS = [
  'countGlobalVersions', 'find', 'findGlobalVersionByID', 'findGlobalVersions', 'getGlobalSchema', 'restoreGlobalVersion', 'update',
] as const

export type CollectionToolKey = (typeof COLLECTION_TOOLS)[number]
export type GlobalToolKey = (typeof GLOBAL_TOOLS)[number]

/** Tool keys a `writable: []` contract loses. `delete` is never granted: the contract has no delete grant. */
export const COLLECTION_WRITE_TOOLS: readonly CollectionToolKey[] = ['create', 'update', 'duplicate', 'restoreVersion', 'getUploadInstructions']
export const GLOBAL_WRITE_TOOLS: readonly GlobalToolKey[] = ['update', 'restoreGlobalVersion']

export type MCPEntityConfig<Key extends string> = {
  description?: string
  tools?: Partial<Record<Key, false>>
}

/** The subset of plugin-mcp's `MCPPluginConfig` this package produces. */
export type MCPConfigShape = {
  collections?: Record<string, MCPEntityConfig<CollectionToolKey>>
  globals?: Record<string, MCPEntityConfig<GlobalToolKey>>
}

/** plugin-mcp's sanitized item, structurally. */
export type MCPItemShape =
  | { type: 'collectionTool'; collectionSlug: string; configKey: string }
  | { type: 'globalTool'; globalSlug: string; configKey: string }
  | { type: 'tool' | 'prompt' | 'resource'; configKey: string }

export type FilterMCPItems = <Item extends MCPItemShape>(args: {
  items: Item[]
  overrideAccess: boolean
  req: PayloadRequest
}) => Promise<Item[]>

export type AuthorizeMCP = <Item extends MCPItemShape>(args: {
  overrideAccess: boolean
  pluginConfig: { items: Item[] }
  req: PayloadRequest
}) => Promise<{ items: Item[]; overrideAccess: boolean }>

export type MCPOptions = {
  site: Pick<SiteIdentity, 'name'>
  /** Users collection slug. Default `users`. */
  usersSlug?: string
  /** Extra sentences for the server `instructions`. */
  instructions?: string[]
  /**
   * `filterMCPItems` from `@payloadcms/plugin-mcp/internal`. Prunes advertised
   * tools to what the key's user may access. Without it every non-private
   * tool is advertised and Payload refuses forbidden calls at operation time.
   */
  filterItems?: FilterMCPItems
}

export const API_KEYS_SLUG = 'payload-mcp-api-keys'

const sentence = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** Tool description: contract description, notes, then exactly what the agent may write. */
export const describeForAgents = (contract: ResolvedContract): string => {
  const parts = [sentence(contract.description), sentence(contract.notes)]
  if (contract.writable.length) {
    parts.push(`Writable by agents: ${contract.writable.join(', ')}. Everything else is read-only.`)
    if (contract.fillEmptyOnly.length) parts.push(`Fill only when empty: ${contract.fillEmptyOnly.join(', ')}.`)
    if (contract.review !== 'none') parts.push('Writes land as proposals for review.')
  } else {
    parts.push('Read-only to agents.')
  }
  parts.push('Deleting is not available to agents.')
  return parts.filter(Boolean).join(' ')
}

const off = <Key extends string>(keys: readonly Key[]): Partial<Record<Key, false>> =>
  Object.fromEntries(keys.map((key) => [key, false])) as Partial<Record<Key, false>>

/** Per-entity `description` and `tools` for plugin-mcp, from the contract. */
export const mcpConfigFromContract = (config: ContractConfig, _options?: Pick<MCPOptions, 'site'>): MCPConfigShape => {
  const collections: MCPConfigShape['collections'] = {}
  const globals: MCPConfigShape['globals'] = {}
  for (const contract of contractCatalog(config)) {
    if (contract.kind === 'collection') {
      // Not an allowlist in plugin-mcp: private means every tool switched off.
      collections[contract.slug] = contract.private
        ? { tools: off(COLLECTION_TOOLS) }
        : {
            description: describeForAgents(contract),
            tools: off(contract.writable.length ? ['delete'] : ['delete', ...COLLECTION_WRITE_TOOLS]),
          }
    } else {
      globals[contract.slug] = contract.private
        ? { tools: off(GLOBAL_TOOLS) }
        : { description: describeForAgents(contract), tools: contract.writable.length ? {} : off(GLOBAL_WRITE_TOOLS) }
    }
  }
  return { collections, globals }
}

const permission = (name: string, label: string, description: string): Field => ({
  name,
  type: 'checkbox',
  label,
  defaultValue: true,
  admin: { description },
})

/**
 * The key collection: "API Keys" under Admin, admins only. A key acts as the
 * user it is bound to and carries four permissions that cover every entity,
 * so a collection added later needs no migration. Keys only work through
 * `/api/mcp`: `dropApiKeyLogin` removes the login strategy Payload would
 * otherwise register for this auth collection.
 */
export const apiKeysCollectionOverride = (usersSlug = 'users'): CollectionConfig => ({
  slug: API_KEYS_SLUG,
  labels: { singular: 'API Key', plural: 'API Keys' },
  auth: { disableLocalStrategy: true, useAPIKey: true },
  versions: false,
  admin: {
    useAsTitle: 'label',
    group: 'Admin',
    description: 'Connect Claude Code or another MCP client to the content.',
    defaultColumns: ['label', 'user', 'updatedAt'],
  },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly, unlock: adminOnly },
  custom: { sitekick: { private: true } },
  fields: [
    {
      name: 'label',
      type: 'text',
      label: 'Name',
      required: true,
      admin: { description: 'Who uses this key, e.g. "Claude Code, Sam\'s laptop".' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: usersSlug as CollectionSlug,
      required: true,
      admin: { description: 'The key acts as this user, so it can never do more than they can.' },
    },
    {
      type: 'row',
      fields: [
        permission('allowRead', 'Read', 'Find content, inspect its fields, and view saved history.'),
        permission('allowCreate', 'Create', 'Add content, duplicate documents, and upload media.'),
        permission('allowEdit', 'Edit', 'Update content and settings, publish changes, and restore history.'),
        permission('allowDelete', 'Delete', 'Delete content the linked user has permission to remove.'),
      ],
    },
  ],
})

/** Call from `onInit` (`contractPlugin` does): Payload builds its strategies before `onInit`. */
export const dropApiKeyLogin = (payload: { authStrategies: { name: string }[] }): void => {
  payload.authStrategies = payload.authStrategies.filter((s) => s.name !== `${API_KEYS_SLUG}-api-key`)
}

const READ_TOOLS = new Set([
  'find', 'count', 'findDistinct', 'getCollectionSchema', 'getGlobalSchema', 'findVersions', 'findVersionByID',
  'countVersions', 'findGlobalVersions', 'findGlobalVersionByID', 'countGlobalVersions',
])
const CREATE_TOOLS = new Set(['create', 'duplicate', 'getUploadInstructions'])
const EDIT_TOOLS = new Set(['update', 'restoreVersion', 'restoreGlobalVersion'])

type KeyDoc = {
  user?: string | number | { id: string | number }
  allowRead?: boolean
  allowCreate?: boolean
  allowEdit?: boolean
  allowDelete?: boolean
}

/** Whether the key's four boxes allow this tool. Private entities and non-content items never pass. */
export const keyAllows = (key: KeyDoc, item: MCPItemShape, privateSlugs: ReadonlySet<string>): boolean => {
  if (item.type !== 'collectionTool' && item.type !== 'globalTool') return false
  const slug = item.type === 'collectionTool' ? item.collectionSlug : item.globalSlug
  if (privateSlugs.has(slug)) return false
  if (READ_TOOLS.has(item.configKey)) return key.allowRead === true
  if (CREATE_TOOLS.has(item.configKey)) return key.allowCreate === true
  if (EDIT_TOOLS.has(item.configKey)) return key.allowEdit === true
  if (item.configKey === 'delete') return key.allowDelete === true
  return false
}

/**
 * Bearer key → bound user → tools the four boxes allow. Payload access still
 * runs as that user (`overrideAccess: false`), so a key never exceeds them.
 */
export const makeAuthorizeMCP = (
  catalog: ResolvedContract[],
  options: Pick<MCPOptions, 'usersSlug' | 'filterItems'> = {},
): AuthorizeMCP => {
  const privateSlugs = new Set(catalog.filter((c) => c.private).map((c) => c.slug))
  const usersSlug = options.usersSlug ?? 'users'
  return async ({ req, pluginConfig }) => {
    req.user = null
    const header = req.headers.get('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) throw new UnauthorizedError(req.t)
    const apiKeyIndex = createHmac('sha256', req.payload.secret).update(token).digest('hex')
    const { docs } = await req.payload.find({
      collection: API_KEYS_SLUG,
      where: { apiKeyIndex: { equals: apiKeyIndex } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    })
    const key = docs[0] as KeyDoc | undefined
    const userId = typeof key?.user === 'object' ? key.user.id : key?.user
    if (!key || userId === undefined || userId === null) throw new UnauthorizedError(req.t)
    const user = await req.payload.findByID({ collection: usersSlug as CollectionSlug, id: userId, depth: 0, overrideAccess: true, req })
    req.user = { ...user, collection: usersSlug, _strategy: 'mcp-api-key' } as PayloadRequest['user']
    const items = pluginConfig.items.filter((item) => keyAllows(key, item, privateSlugs))
    return {
      items: options.filterItems ? await options.filterItems({ items, overrideAccess: false, req }) : items,
      overrideAccess: false,
    }
  }
}

export type MCPPluginOptionsShape = MCPConfigShape & {
  overrideGetAuthorizedMCP: AuthorizeMCP
  mcp: { serverOptions: { serverInfo: { name: string; version: string }; options: { instructions: string } } }
}

const DEFAULT_INSTRUCTIONS = [
  'Find before you change: read the document (and what references it) first.',
  'Writes publish to the public site and run every collection hook unless the collection says writes land as proposals.',
  'On drafts-enabled collections, update with draft=false publishes (and replaces an editor\'s unpublished draft); check _status and pass draft=true to leave a published page alone.',
  'Prefer id over a where clause for update; a where clause changes every match.',
  'Only the fields each tool description lists as writable may be changed; nothing can be deleted.',
]

/** Everything to spread into `mcpPlugin({...})`: `mcpPlugin(mcpPluginOptions(config, { site }))`. */
export const mcpPluginOptions = (config: ContractConfig, options: MCPOptions): MCPPluginOptionsShape => ({
  ...mcpConfigFromContract(config, options),
  overrideGetAuthorizedMCP: makeAuthorizeMCP(contractCatalog(config), options),
  mcp: {
    serverOptions: {
      serverInfo: { name: `${options.site.name} CMS`, version: '1.0.0' },
      options: {
        instructions: [`This is the ${options.site.name} CMS (Payload).`, ...DEFAULT_INSTRUCTIONS, ...(options.instructions ?? [])].join(' '),
      },
    },
  },
})

export type ContractPluginOptions = MCPOptions & {
  /** Add the API Keys collection and drop its login strategy. Default on. */
  apiKeys?: boolean
}

/**
 * Stores the resolved catalog on `config.custom.sitekick.contract` and the
 * plugin-mcp options on `config.custom.sitekick.mcp`, adds the API Keys
 * collection, and makes sure a key can never become `req.user` outside MCP.
 * Runs inside `sitekickCMS`, so `mcpPlugin` placed after it can read both.
 */
export const contractPlugin =
  (options: ContractPluginOptions): Plugin =>
  (config: Config): Config => {
    const usersSlug = options.usersSlug ?? config.admin?.user ?? 'users'
    const withKeys = options.apiKeys !== false && !(config.collections ?? []).some((c) => c.slug === API_KEYS_SLUG)
    const collections = withKeys ? [...(config.collections ?? []), apiKeysCollectionOverride(usersSlug)] : config.collections
    const next: Config = { ...config, collections }
    const custom = (next.custom ?? {}) as { sitekick?: Record<string, unknown> }
    next.custom = {
      ...custom,
      sitekick: {
        ...custom.sitekick,
        contract: contractCatalog(next),
        mcp: mcpPluginOptions(next, { ...options, usersSlug }),
      },
    }
    if (options.apiKeys !== false) {
      const previous = config.onInit
      next.onInit = async (payload) => {
        dropApiKeyLogin(payload)
        if (previous) await previous(payload)
      }
    }
    return next
  }
