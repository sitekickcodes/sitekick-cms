import type { Config, Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import { augmentUsers } from './users'

export { augmentUsers } from './users'
export { adminOrigin, adminURL, INVITE_TTL_MS, passwordResetEmail, renderAccountEmail, sendInvite } from './invite'

/**
 * Sign-in and user management: augments the users collection (auth/users.ts)
 * and registers the auth admin components. Import-map paths are
 * `@sitekick/cms/admin#<Name>`; see auth/components.manifest.ts.
 *
 * `options.site` is stored at `admin.custom.sitekick.site` (sent to the
 * client config, so Logo/Icon/AuthView can read it wherever Payload renders
 * them) and also passed as `clientProps` to the slots that take it.
 */
export const authPlugin =
  (options: SitekickCMSOptions): Plugin =>
  (incoming: Config): Config => {
    const config = augmentUsers(options)(incoming)
    const admin = (config.admin ??= {})
    const custom = (admin.custom ??= {})
    custom.sitekick = { ...(custom.sitekick as object | undefined), site: options.site }

    const components = (admin.components ??= {})
    const clientProps = { site: options.site }

    components.graphics = {
      Logo: { path: '@sitekick/cms/admin#Logo', clientProps },
      Icon: { path: '@sitekick/cms/admin#Icon', clientProps },
      ...components.graphics,
    }
    // For anyone who swaps the login view back to Payload's: the overlay
    // still rides after the stock form. AuthView renders it itself.
    components.afterLogin = [...(components.afterLogin ?? []), '@sitekick/cms/admin#SigningIn']
    components.views = {
      login: { Component: { path: '@sitekick/cms/admin#AuthView', serverProps: clientProps } },
      forgot: { Component: { path: '@sitekick/cms/admin#AuthView', serverProps: clientProps } },
      ...components.views,
    }

    // The login button and tab title say "Sign in" (Payload's "Login").
    const i18n = (config.i18n ??= {})
    const translations = (i18n.translations ??= {})
    const en = (translations.en ??= {}) as Record<string, Record<string, string>>
    en.authentication = { login: 'Sign in', ...en.authentication }

    return config
  }
