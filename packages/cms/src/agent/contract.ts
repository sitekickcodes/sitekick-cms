import type { CollectionConfig, Config, Field, GlobalConfig } from 'payload'

import type { AgentContract, Entity, SitekickCustom } from '../types'

/** One top-level field as an agent sees it. Layout-only fields are flattened away. */
export type ContractField = {
  name: string
  type: Field['type']
  required: boolean
}

/** A collection's or global's agent contract with every default applied. */
export type ResolvedContract = {
  slug: string
  kind: 'collection' | 'global'
  /** Plural label (collections) or label (globals); the slug when neither is set. */
  label: string
  /** Admin-ish one-liner for the LLM. Ends with " Drafts-enabled." when drafts are on. */
  description: string
  /** Fields agents may write. Empty = read-only to agents (the default). */
  writable: string[]
  fillEmptyOnly: string[]
  review: NonNullable<AgentContract['review']>
  notes?: string
  /** Hidden from agents and the public catalog entirely. */
  private: boolean
  drafts: boolean
  /** Field the admin shows as the title (`admin.useAsTitle`), if any. */
  titleField?: string
  /** Public path prefix from `custom.sitekick.seo.pathPrefix`, else `/<slug>`. */
  pathPrefix: string
  fields: ContractField[]
}

export type ContractConfig = Pick<Config, 'collections' | 'globals'>

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

export const sitekickCustom = (entity: Entity): NonNullable<SitekickCustom['sitekick']> =>
  ((entity.custom as SitekickCustom | undefined)?.sitekick ?? {}) as NonNullable<SitekickCustom['sitekick']>

export type EntityKind = ResolvedContract['kind']

/** Collections carry `labels`, globals `label`; a bare entity is taken as a collection. */
const inferKind = (entity: Entity): EntityKind => ('labels' in entity ? 'collection' : 'label' in entity ? 'global' : 'collection')

const labelOf = (entity: Entity, kind: EntityKind): string =>
  kind === 'collection'
    ? (text((entity as CollectionConfig).labels?.plural) ?? entity.slug)
    : (text((entity as GlobalConfig).label) ?? entity.slug)

const hasDrafts = (entity: Entity): boolean => {
  const versions = entity.versions
  return typeof versions === 'object' && versions !== null && 'drafts' in versions && Boolean(versions.drafts)
}

const isHidden = (field: Field): boolean => {
  // `admin.hidden` is not on every member of the Field union; read it structurally.
  const admin = field.admin as { hidden?: boolean; disabled?: boolean } | undefined
  return ('hidden' in field && field.hidden === true) || admin?.hidden === true || admin?.disabled === true
}

/** Named fields at the top level, looking through rows, collapsibles and unnamed tabs. */
export const topLevelFields = (fields: Field[]): ContractField[] => {
  const out: ContractField[] = []
  const walk = (list: Field[]) => {
    for (const field of list) {
      if (isHidden(field) || field.type === 'ui') continue
      if (field.type === 'row' || field.type === 'collapsible') {
        walk(field.fields)
      } else if (field.type === 'tabs') {
        for (const tab of field.tabs) {
          if ('name' in tab && tab.name) out.push({ name: tab.name, type: 'group', required: false })
          else walk(tab.fields)
        }
      } else if ('name' in field && field.name) {
        out.push({ name: field.name, type: field.type, required: 'required' in field && field.required === true })
      }
    }
  }
  walk(fields)
  return out
}

/** The contract with defaults: no contract = read-only to agents, review required. */
export const readContract = (entity: Entity, kind: EntityKind = inferKind(entity)): ResolvedContract => {
  const custom = sitekickCustom(entity)
  const contract = custom.agent ?? {}
  const collection = kind === 'collection'
  const drafts = hasDrafts(entity)
  const seo = custom.seo
  const label = labelOf(entity, kind)
  const base = contract.description ?? text(entity.admin?.description) ?? label
  return {
    slug: entity.slug,
    kind,
    label,
    description: `${base}${drafts ? ' Drafts-enabled.' : ''}`,
    writable: [...(contract.writable ?? [])],
    fillEmptyOnly: [...(contract.fillEmptyOnly ?? [])],
    review: contract.review ?? 'required',
    ...(contract.notes ? { notes: contract.notes } : {}),
    private: custom.private === true,
    drafts,
    ...(collection && text((entity as CollectionConfig).admin?.useAsTitle)
      ? { titleField: text((entity as CollectionConfig).admin?.useAsTitle) }
      : {}),
    pathPrefix: (seo && typeof seo === 'object' && text(seo.pathPrefix)) || `/${entity.slug}`,
    fields: topLevelFields(entity.fields),
  }
}

/** Every collection and global, private ones included (readers decide what to hide). */
export const contractCatalog = (config: ContractConfig): ResolvedContract[] => [
  ...(config.collections ?? []).map((c) => readContract(c, 'collection')),
  ...(config.globals ?? []).map((g) => readContract(g, 'global')),
]

/** The catalog `contractPlugin` stored on `config.custom.sitekick.contract`, else computed. */
export const contractFromConfig = (config: ContractConfig & Pick<Config, 'custom'>): ResolvedContract[] => {
  const stored = (config.custom as { sitekick?: { contract?: unknown } } | undefined)?.sitekick?.contract
  return Array.isArray(stored) ? (stored as ResolvedContract[]) : contractCatalog(config)
}
