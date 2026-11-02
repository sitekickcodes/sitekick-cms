import type { CollectionAfterLoginHook, CollectionBeforeChangeHook, CollectionConfig, CollectionSlug, Config, Endpoint, Field } from 'payload'

import { adminOnly, adminOnlyField, hasRole, isUserAccount, ROLES } from '../access'
import type { SitekickCMSOptions } from '../types'
import { passwordResetEmail, sendInvite } from './invite'

/**
 * Users: admin accounts. Two roles drive everything (access/index.ts):
 *   - admin:  edits everything and manages users.
 *   - editor: edits content; sees only their own account.
 *
 * `augmentUsers` finds the client's users collection (`options.usersSlug`,
 * default `users`) and adds what the Yimby admin proved out:
 *   - `name` (optional, email stays the title), `roles` (saveToJWT, admins
 *     only may change it; the first account ever created becomes admin),
 *     `invitedAt` and `lastLoginAt` stamps (read-only, sidebar);
 *   - the stampLastLogin afterLogin hook;
 *   - invites: "Invite someone" above the list (POST /api/<users>/invite:
 *     account + role + email in one step), "Send invite" in a user's sidebar
 *     (POST /api/<users>/:id/invite), and the branded reset email;
 *   - the SetPassword controls under the account card;
 *   - access: admins manage everyone, everyone else only their own record.
 * Anything the collection already defines (a field of the same name, an
 * access function, a forgotPassword email) is left alone.
 */

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

const denyUnlessAdmin = (req: Parameters<Endpoint['handler']>[0]) => {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** Send (or resend) the invite to an existing account. */
const resendInviteEndpoint = (options: SitekickCMSOptions): Endpoint => ({
  path: '/:id/invite',
  method: 'post',
  handler: async (req) => {
    const denied = denyUnlessAdmin(req)
    if (denied) return denied
    const id = req.routeParams?.id
    if (typeof id !== 'string' && typeof id !== 'number') {
      return Response.json({ error: 'Unknown user' }, { status: 404 })
    }
    try {
      return Response.json(await sendInvite(req, options, id))
    } catch (err) {
      return Response.json({ error: errorText(err) }, { status: 500 })
    }
  },
})

/**
 * Create an account with the chosen role and email the invite. An address
 * that already has an account is not touched: the answer points at it so the
 * admin can resend from there.
 */
const inviteEndpoint = (options: SitekickCMSOptions): Endpoint => ({
  path: '/invite',
  method: 'post',
  handler: async (req) => {
    const denied = denyUnlessAdmin(req)
    if (denied) return denied
    const collection = options.usersSlug ?? 'users'
    const body = (await req.json?.()) as { email?: string; role?: string } | undefined
    const email = body?.email?.trim().toLowerCase() ?? ''
    const role = body?.role === 'admin' ? 'admin' : 'editor'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const { payload } = req
    const existing = await payload.find({ collection: collection as CollectionSlug, where: { email: { equals: email } }, limit: 1, depth: 0, req })
    if (existing.docs[0]) {
      return Response.json(
        { error: `${email} already has an account. Open it to resend the invite.`, id: existing.docs[0].id },
        { status: 409 },
      )
    }

    const user = await payload.create({
      collection: collection as CollectionSlug,
      // Never shown or stored anywhere else; the invite link replaces it.
      data: { email, password: crypto.randomUUID() + crypto.randomUUID(), roles: [role] },
      req,
      overrideAccess: true,
    })

    try {
      return Response.json({ ...(await sendInvite(req, options, user.id)), id: user.id })
    } catch (err) {
      return Response.json(
        { error: `Account created, but the email didn't send (${errorText(err)}). Open it to resend.`, id: user.id },
        { status: 502 },
      )
    }
  },
})

/** "Last signed in" on the user and the list; also how an invite shows as accepted. */
const stampLastLogin =
  (collection: string): CollectionAfterLoginHook =>
  async ({ req, user }) => {
    await req.payload.db.updateOne({
      collection: collection as CollectionSlug,
      id: user.id,
      data: { lastLoginAt: new Date().toISOString() },
      req,
      returning: false,
    })
    return user
  }

/** The first account ever created is an admin; nobody else could grant it. */
const firstUserIsAdmin =
  (collection: string): CollectionBeforeChangeHook =>
  async ({ data, operation, req }) => {
    if (operation === 'create') {
      const { totalDocs } = await req.payload.count({ collection: collection as CollectionSlug, overrideAccess: true, req })
      if (totalDocs === 0) data.roles = ['admin']
    }
    return data
  }

const fieldNames = (fields: Field[]): Set<string> => {
  const names = new Set<string>()
  for (const field of fields) {
    if ('name' in field && typeof field.name === 'string') names.add(field.name)
    if ('fields' in field && Array.isArray(field.fields) && !('name' in field)) {
      for (const n of fieldNames(field.fields)) names.add(n)
    }
  }
  return names
}

export const augmentUsers =
  (options: SitekickCMSOptions) =>
  (config: Config): Config => {
    const slug = options.usersSlug ?? 'users'
    const invites = options.invites ?? true
    const users = config.collections?.find((c) => c.slug === slug)
    if (!users) return config

    const auth = typeof users.auth === 'object' ? users.auth : {}
    users.auth = {
      ...auth,
      // No forgotPassword.expiration here: it would override the invite's 7 days.
      forgotPassword: { ...passwordResetEmail(options), ...auth.forgotPassword },
    }

    const admin = (users.admin ??= {})
    admin.useAsTitle ??= 'email'
    admin.defaultColumns ??= ['name', 'email', 'roles', 'lastLoginAt']
    if (invites) {
      const components = (admin.components ??= {})
      components.beforeListTable = [...(components.beforeListTable ?? []), '@sitekick/cms/admin#InviteUser']
    }

    const have = fieldNames(users.fields)
    const added: Field[] = []
    const add = (field: Field) => {
      if ('name' in field && typeof field.name === 'string' && have.has(field.name)) return
      added.push(field)
    }

    add({
      // Optional: the sidebar's account row and the users list show it,
      // falling back to the email. Email stays the title: a blank title
      // shows as an id in relationship pickers.
      name: 'name',
      type: 'text',
      admin: { description: "How you're shown in the admin. Leave blank to use your email." },
    })
    add({
      // Set password on Create user, Send reset email on someone else's
      // account (admin/SetPassword). No column: a ui field.
      name: 'passwordControls',
      type: 'ui',
      admin: { components: { Field: '@sitekick/cms/admin#SetPassword' }, disabled: { column: true } },
    })
    add({
      name: 'roles',
      type: 'select',
      hasMany: true,
      saveToJWT: true,
      required: true,
      defaultValue: ['editor'],
      options: ROLES.map((role) => ({ label: role === 'admin' ? 'Admin' : 'Editor', value: role })),
      admin: { description: 'Admins can edit everything and manage users. Editors can edit content.' },
      // Only admins can grant or change roles.
      access: { create: adminOnlyField, update: adminOnlyField },
    })
    if (invites) {
      add({
        name: 'invite',
        type: 'ui',
        admin: { position: 'sidebar', components: { Field: '@sitekick/cms/admin#InviteButton' } },
      })
    }
    add({
      name: 'invitedAt',
      label: 'Invited',
      type: 'date',
      // Written by sendInvite (overrideAccess) only.
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    })
    add({
      name: 'lastLoginAt',
      label: 'Last signed in',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    })
    // The controls sit under the account card, so they lead the field list.
    users.fields = [...added.filter((f) => 'name' in f && f.name === 'passwordControls'), ...users.fields, ...added.filter((f) => !('name' in f && f.name === 'passwordControls'))]

    if (invites) {
      users.endpoints = [...(users.endpoints === false ? [] : (users.endpoints ?? [])), inviteEndpoint(options), resendInviteEndpoint(options)]
    }

    const hooks = (users.hooks ??= {})
    hooks.afterLogin = [...(hooks.afterLogin ?? []), stampLastLogin(slug)]
    hooks.beforeChange = [firstUserIsAdmin(slug), ...(hooks.beforeChange ?? [])]

    const self: CollectionConfig['access'] = {
      create: adminOnly,
      delete: adminOnly,
      // Admins see all users; everyone else only their own record.
      read: ({ req: { user } }) => {
        if (!user || !isUserAccount(user, slug)) return false
        if (hasRole(user, 'admin')) return true
        return { id: { equals: user.id } }
      },
      update: ({ req: { user } }) => {
        if (!user || !isUserAccount(user, slug)) return false
        if (hasRole(user, 'admin')) return true
        return { id: { equals: user.id } }
      },
    }
    users.access = { ...self, ...users.access }

    return config
  }
