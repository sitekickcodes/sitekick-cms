import type { CollectionConfig, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'

/**
 * No empty drafts. With autosave on, Payload saves a blank document the moment someone
 * opens "Create New" (so autosave has something to save to), and every create screen
 * opened and left leaves an untitled draft in the list. Validating drafts turns that off:
 * the document is saved when its required fields are filled and the editor saves it, and
 * from then on autosave and live preview work as before. A collection that sets
 * `drafts.validate` itself keeps its choice.
 */
export function withDraftValidation(collection: CollectionConfig): CollectionConfig {
  const versions = collection.versions
  if (!versions || typeof versions !== 'object' || !versions.drafts || typeof versions.drafts !== 'object') return collection
  if (!versions.drafts.autosave || versions.drafts.validate !== undefined) return collection
  return { ...collection, versions: { ...versions, drafts: { ...versions.drafts, validate: true } } }
}

export const draftsConvention =
  (_options: SitekickCMSOptions): Plugin =>
  (config) => ({ ...config, collections: (config.collections ?? []).map(withDraftValidation) })
