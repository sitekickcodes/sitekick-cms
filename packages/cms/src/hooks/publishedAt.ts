import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Stamps `publishedAt` the first time a document goes public, whoever
 * published it, so "New" badges and a `-publishedAt` default sort work
 * without anyone filling the date in. A date already set (typed, or the
 * field's defaultValue) is kept; a later re-publish doesn't move it.
 *
 *   hooks: { beforeChange: [publishedAt()] }
 */
export const publishedAt =
  ({ field = 'publishedAt' }: { field?: string } = {}): CollectionBeforeChangeHook =>
  ({ data, originalDoc }) => {
    const record = data as Record<string, unknown>
    const original = (originalDoc ?? {}) as Record<string, unknown>
    if (record._status === 'published' && !original[field] && !record[field]) {
      return { ...record, [field]: new Date().toISOString() }
    }
    return data
  }
