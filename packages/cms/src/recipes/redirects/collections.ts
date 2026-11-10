import type { CollectionAfterChangeHook, CollectionBeforeValidateHook, CollectionConfig, CollectionSlug } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../../access'
import { statusCell } from '../../fields/statusCell'
import { MISSING_SLUG, REDIRECTS_SLUG, normalizePath, normalizeTarget } from './model'

export const IMPORT_REDIRECTS = '@sitekick/cms/admin#ImportRedirects'

/** `from` and `to` stored tidy, so lookups never miss on a trailing slash or a capital. */
const tidy: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  if (typeof data.from === 'string') {
    const from = normalizePath(data.from)
    if (!from) throw new APIError('“Old address” should be a path like /about-us, or the full old URL.', 400, undefined, true)
    if (from === '/') throw new APIError('The home page can’t be redirected.', 400, undefined, true)
    data.from = from
  }
  if (typeof data.to === 'string') {
    const to = normalizeTarget(data.to)
    if (!to) throw new APIError('“Send people to” should be a path like /contact, or a full web address.', 400, undefined, true)
    if (normalizePath(to) === data.from) throw new APIError('A redirect can’t point at itself.', 400, undefined, true)
    data.to = to
  }
  return data
}

/** A missing page that has been given a redirect is fixed: no one lands on it any more. */
const closeMissing: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!req.payload.collections[MISSING_SLUG as CollectionSlug]) return doc
  await req.payload.update({
    collection: MISSING_SLUG as CollectionSlug,
    where: { path: { equals: doc.from }, status: { equals: 'open' } },
    data: { status: 'redirected', redirectTo: doc.to } as never,
    overrideAccess: true,
    req,
  })
  return doc
}

export function redirectsCollection(): CollectionConfig {
  return {
    slug: REDIRECTS_SLUG,
    labels: { singular: 'Redirect', plural: 'Redirects' },
    admin: {
      group: 'Website',
      useAsTitle: 'from',
      defaultColumns: ['from', 'to', 'permanent', 'hits', 'lastHitAt'],
      listSearchableFields: ['from', 'to', 'note'],
      description: 'Old addresses that send visitors somewhere else. Changing a page’s address adds one here for you. New and changed redirects start working within a couple of minutes.',
      components: { beforeListTable: [IMPORT_REDIRECTS] },
    },
    defaultSort: '-updatedAt',
    // A redirect is one line; its history isn't worth a table.
    versions: false,
    access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
    hooks: { beforeValidate: [tidy], afterChange: [closeMissing] },
    custom: { sitekick: { private: true } },
    fields: [
      { name: 'from', label: 'Old address', type: 'text', required: true, unique: true, index: true, admin: { description: 'The path people arrive at, e.g. /about-us. A full old URL works too.' } },
      { name: 'to', label: 'Send people to', type: 'text', required: true, admin: { description: 'A page on this site (/contact) or a full web address.' } },
      {
        name: 'permanent',
        type: 'checkbox',
        defaultValue: true,
        admin: {
          position: 'sidebar',
          description: 'On: the old address is gone for good (search engines move it over). Off: temporary, e.g. during an event.',
          components: { Cell: statusCell({ true: { label: 'Permanent', tone: 'quiet' }, false: { label: 'Temporary', tone: 'warning' } }) },
        },
      },
      { name: 'note', type: 'text', admin: { position: 'sidebar', description: 'Why it’s here. Only you see it.' } },
      {
        name: 'source',
        type: 'select',
        defaultValue: 'manual',
        options: [
          { label: 'Added by hand', value: 'manual' },
          { label: 'Address changed', value: 'slug' },
          { label: 'Imported', value: 'import' },
          { label: 'From a missing page', value: 'missing' },
        ],
        admin: { position: 'sidebar', readOnly: true },
      },
      { name: 'hits', label: 'Used', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true, description: 'Times a visitor was sent on.' } },
      { name: 'lastHitAt', label: 'Last used', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ],
  }
}

/** Typing an address on a missing page turns it into a redirect. */
const redirectFromMissing: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const to = typeof doc.redirectTo === 'string' ? doc.redirectTo : ''
  if (!to || to === previousDoc?.redirectTo || doc.status === 'ignored') return doc
  const existing = await req.payload.find({ collection: REDIRECTS_SLUG as CollectionSlug, where: { from: { equals: doc.path } }, limit: 1, depth: 0, overrideAccess: true, req })
  const data = { from: doc.path, to, source: 'missing' }
  if (existing.docs[0]) await req.payload.update({ collection: REDIRECTS_SLUG as CollectionSlug, id: existing.docs[0].id, data: data as never, overrideAccess: true, req })
  else await req.payload.create({ collection: REDIRECTS_SLUG as CollectionSlug, data: data as never, overrideAccess: true, req })
  return doc
}

/** A target given in this save: tidy it, and mark the page fixed in the same save (the editor sees it at once). */
const checkTarget: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (data && typeof data.redirectTo === 'string' && data.redirectTo.trim()) {
    const to = normalizeTarget(data.redirectTo)
    if (!to) throw new APIError('“Send people to” should be a path like /contact, or a full web address.', 400, undefined, true)
    data.redirectTo = to
    if (to !== originalDoc?.redirectTo && (data.status ?? originalDoc?.status) === 'open') data.status = 'redirected'
  }
  return data
}

export function missingPagesCollection(): CollectionConfig {
  return {
    slug: MISSING_SLUG,
    labels: { singular: 'Missing page', plural: 'Missing pages' },
    admin: {
      group: 'Website',
      useAsTitle: 'path',
      defaultColumns: ['path', 'hits', 'lastSeenAt', 'status'],
      description: 'Addresses visitors tried that don’t exist, most visited first. Open one and say where it should go, or mark it Ignored.',
    },
    defaultSort: '-hits',
    versions: false,
    // Only the site records these (recordMissing); people fix or ignore them.
    access: { read: authenticated, create: () => false, update: authenticated, delete: authenticated },
    hooks: { beforeValidate: [checkTarget], afterChange: [redirectFromMissing] },
    custom: { sitekick: { private: true } },
    fields: [
      { name: 'path', label: 'Address', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
      {
        name: 'redirectTo',
        label: 'Send people to',
        type: 'text',
        admin: { description: 'A page on this site (/contact) or a full web address. Saving adds the redirect and marks this fixed.' },
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: 'open',
        index: true,
        options: [
          { label: 'Open', value: 'open' },
          { label: 'Redirected', value: 'redirected' },
          { label: 'Ignored', value: 'ignored' },
        ],
        admin: {
          position: 'sidebar',
          description: 'Ignored stops it showing up, e.g. for an address that was never real.',
          components: { Cell: statusCell({ open: { label: 'Open', tone: 'warning' }, redirected: { label: 'Redirected', tone: 'success' }, ignored: { label: 'Ignored', tone: 'quiet' } }) },
        },
      },
      { name: 'hits', label: 'Visits', type: 'number', defaultValue: 0, index: true, admin: { position: 'sidebar', readOnly: true } },
      { name: 'lastSeenAt', label: 'Last tried', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'referrer', label: 'Linked from', type: 'text', admin: { position: 'sidebar', readOnly: true, description: 'The last page that linked here, when the browser said.' } },
    ],
  }
}
