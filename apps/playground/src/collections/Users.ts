import type { CollectionConfig } from 'payload'

/** The plugin adds name, roles, invites and sign-in stamps. Keep this file minimal. */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: { group: 'Admin' },
  auth: true,
  fields: [],
  versions: false,
}
