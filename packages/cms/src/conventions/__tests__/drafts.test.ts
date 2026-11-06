import { expect, test } from 'bun:test'
import type { CollectionConfig } from 'payload'

import { withDraftValidation } from '../drafts'

const c = (versions: CollectionConfig['versions']): CollectionConfig => ({ slug: 'x', fields: [], versions })

test('autosave collections validate drafts unless they chose otherwise', () => {
  expect(withDraftValidation(c({ drafts: { autosave: { interval: 1000 } } })).versions).toEqual({ drafts: { autosave: { interval: 1000 }, validate: true } })
  expect(withDraftValidation(c({ drafts: { autosave: true, validate: false } })).versions).toEqual({ drafts: { autosave: true, validate: false } })
  // No autosave: Payload doesn't save on open, nothing to change.
  const plain = c({ drafts: true })
  expect(withDraftValidation(plain)).toBe(plain)
  const none = c(undefined)
  expect(withDraftValidation(none)).toBe(none)
})
