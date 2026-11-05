/**
 * The board's columns and the moves between them, kept free of React and Payload so the
 * rules are tested on their own.
 *
 *   draft      never published
 *   changed    published, with a newer draft that isn't live yet
 *   published  what the site shows
 *
 * Moving to Published publishes the latest draft (Payload's own "Publish": PATCH with
 * `?draft=true` and `_status: published`, which saves the newest version live). Moving to
 * Draft unpublishes, taking the page off the site. Nothing moves into Changed: that column
 * only exists because someone is still editing.
 */
export type Column = 'draft' | 'changed' | 'published'

export const COLUMNS: { key: Column; label: string; hint: string }[] = [
  { key: 'draft', label: 'Draft', hint: 'Not on the site yet.' },
  { key: 'changed', label: 'Changed', hint: 'Live, with edits that aren’t published.' },
  { key: 'published', label: 'Published', hint: 'Live on the site.' },
]

export type Card = {
  id: number | string
  title: string
  column: Column
  updatedAt?: string
  href: string
  image?: string
}

export type Move = 'publish' | 'unpublish'

/** What moving a card from one column to another does, or null when it can't go there. */
export function moveOf(from: Column, to: Column): Move | null {
  if (from === to) return null
  if (to === 'published') return 'publish'
  if (to === 'draft') return 'unpublish'
  return null
}

/** The REST request for a move, relative to the API route. */
export function requestOf(collection: string, id: number | string, move: Move): { path: `/${string}`; body: { _status: 'draft' | 'published' } } {
  const path: `/${string}` = `/${collection}/${encodeURIComponent(String(id))}?depth=0${move === 'publish' ? '&draft=true' : ''}`
  return { path, body: { _status: move === 'publish' ? 'published' : 'draft' } }
}

/** The confirmation an editor reads before a move. */
export function confirmOf(move: Move, title: string, column: Column, singular: string): { heading: string; body: string; action: string } {
  if (move === 'publish') {
    return {
      heading: column === 'changed' ? `Publish the changes to “${title}”?` : `Publish “${title}”?`,
      body: column === 'changed' ? `The latest edits go live on the site.` : `The ${singular} goes live on the site.`,
      action: 'Publish',
    }
  }
  return {
    heading: `Unpublish “${title}”?`,
    body: `The ${singular} comes off the site and becomes a draft. Its content is kept.`,
    action: 'Unpublish',
  }
}

/** Split latest-version docs into columns; `hasPublished` holds ids the site shows now. */
export function columnOf(status: unknown, id: number | string, hasPublished: Set<number | string>): Column {
  if (status === 'published') return 'published'
  return hasPublished.has(id) ? 'changed' : 'draft'
}

/** Payload's first error message from a failed REST write, readable for an editor. */
export function errorOf(json: unknown, status: number): string {
  const errors = (json as { errors?: { message?: string; data?: { errors?: { label?: string; message?: string; path?: string }[] } }[] } | null)?.errors
  const first = errors?.[0]
  // Labels come nested ("Post > Body"); the editor needs the field's own name.
  const fields = first?.data?.errors?.map((e) => (e.label ?? e.path)?.split(' > ').at(-1)).filter(Boolean)
  if (fields?.length) return `Open it and fix ${fields.join(', ')} first.`
  return first?.message ?? `The server answered HTTP ${status}.`
}
