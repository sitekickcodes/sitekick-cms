import type { CollectionConfig, Config, Field, Plugin } from 'payload'

import type { AgentAction, SitekickCMSOptions } from '../types'
import { sitekickCustom } from './contract'

/**
 * Agent buttons in the admin, placed from each collection's contract
 * (`custom.sitekick.agent.actions`) once the host sets the `agents` option:
 *
 * - `enrich` → "Find details" in the edit view's document controls
 * - `edit` → "Edit with words" there too
 * - `draft` → "Draft from notes" beside Create new (also `?draft=1`, which the
 *   command palette links to)
 * - an upload collection's top-level `alt` text field → "Describe image"
 * - the SEO tab's overview → "Write with AI" (reads `admin.custom` itself)
 *
 * The client reads `admin.custom.sitekick.agents` for the base path and the
 * per-collection actions; nothing here calls a model.
 */
export const AGENT_COMPONENTS = {
  enrich: '@sitekick/cms/admin#EnrichButton',
  draft: '@sitekick/cms/admin#DraftButton',
  edit: '@sitekick/cms/admin#EditButton',
  altText: '@sitekick/cms/admin#AltTextButton',
  translate: '@sitekick/cms/admin#TranslateButton',
} as const

export type AgentsClientConfig = {
  basePath: string
  enrich: string[]
  draft: string[]
  edit: string[]
  /** Collections with a Translate button: set by the localisation recipe, which runs after this. */
  translate?: string[]
}

const actionsOf = (collection: CollectionConfig): AgentAction[] => sitekickCustom(collection).agent?.actions ?? []

const withAltAction = (fields: Field[]): Field[] =>
  fields.map((field) => {
    if (field.type !== 'text' || field.name !== 'alt') return field
    const afterInput = [...(field.admin?.components?.afterInput ?? []), AGENT_COMPONENTS.altText]
    return { ...field, admin: { ...field.admin, components: { ...field.admin?.components, afterInput } } }
  })

export const agentUIPlugin =
  (options: Pick<SitekickCMSOptions, 'agents'>): Plugin =>
  (config: Config): Config => {
    if (!options.agents) return config
    const client: AgentsClientConfig = { basePath: options.agents.basePath ?? '/api/agents', enrich: [], draft: [], edit: [] }

    const collections = (config.collections ?? []).map((collection) => {
      const actions = actionsOf(collection)
      let next = collection
      const controls = (['enrich', 'edit'] as const).filter((a) => actions.includes(a))
      if (controls.length) {
        for (const a of controls) client[a].push(collection.slug)
        const edit = next.admin?.components?.edit
        next = {
          ...next,
          admin: {
            ...next.admin,
            components: { ...next.admin?.components, edit: { ...edit, beforeDocumentControls: [...(edit?.beforeDocumentControls ?? []), ...controls.map((a) => AGENT_COMPONENTS[a])] } },
          },
        }
      }
      if (actions.includes('draft')) {
        client.draft.push(collection.slug)
        const views = next.admin?.components?.views
        next = {
          ...next,
          admin: {
            ...next.admin,
            components: { ...next.admin?.components, views: { ...views, list: { ...views?.list, actions: [...(views?.list?.actions ?? []), { path: AGENT_COMPONENTS.draft, clientProps: { collection: collection.slug } }] } } },
          },
        }
      }
      if (next.upload) next = { ...next, fields: withAltAction(next.fields) }
      return next
    })

    const custom = (config.admin?.custom ?? {}) as { sitekick?: Record<string, unknown> }
    return {
      ...config,
      collections,
      admin: { ...config.admin, custom: { ...custom, sitekick: { ...custom.sitekick, agents: client } } },
    }
  }
