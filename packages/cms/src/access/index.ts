import type { Access, FieldAccess } from 'payload'

/**
 * Role helpers. Two roles drive everything:
 *   - admin:  manages users, settings and every collection.
 *   - editor: edits content; cannot manage users or roles.
 *
 * Roles live on `users.roles` (hasMany, saveToJWT). They are read structurally
 * (the param is `unknown`) because callers hand over different shapes: the
 * server `req.user`, the admin's client user, and plugin user args.
 */
export type Role = 'admin' | 'editor'

export const ROLES: readonly Role[] = ['admin', 'editor']

/**
 * A signed-in account from the users collection. Auth strategies (an API key
 * collection, an MCP key) can put other collections' documents on `req.user`;
 * access that means "a signed-in person" checks this, not mere presence.
 */
export const isUserAccount = (user: unknown, usersSlug = 'users'): boolean =>
  (user as { collection?: unknown } | null | undefined)?.collection === usersSlug

/** Whether `user.roles` includes `role`. */
export const hasRole = (user: unknown, role: Role): boolean => {
  const roles = (user as { roles?: unknown } | null | undefined)?.roles
  return Array.isArray(roles) && roles.includes(role)
}

export const isAdmin = (user: unknown): boolean => hasRole(user, 'admin')

/**
 * Collection access: admins only. For everyone else this returns `false`, so
 * Payload drops the collection from their nav and blocks the API.
 */
export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

/** Collection access: any signed-in account from the users collection. */
export const authenticated: Access = ({ req }) =>
  isUserAccount(req.user, req.payload.config.admin.user)

/** Field access: only admins may write this field (roles, ownership, locks). */
export const adminOnlyField: FieldAccess = ({ req: { user } }) => isAdmin(user)
