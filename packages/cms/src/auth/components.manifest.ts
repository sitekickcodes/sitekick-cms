/**
 * Admin components the auth module references by import-map path
 * (`@sitekick/cms/admin#<Name>`). Each must be exported from admin/index.ts
 * under the same name:
 *
 *   export { AuthView } from './AuthView'
 *   export { Icon } from './Icon'
 *   export { InviteButton } from './InviteButton'
 *   export { InviteUser } from './InviteUser'
 *   export { Logo } from './Logo'
 *   export { SetPassword } from './SetPassword'
 *   export { SigningIn } from './SigningIn'
 */
export const authAdminComponents = [
  'AuthView',
  'Icon',
  'InviteButton',
  'InviteUser',
  'Logo',
  'SetPassword',
  'SigningIn',
] as const

export type AuthAdminComponent = (typeof authAdminComponents)[number]
