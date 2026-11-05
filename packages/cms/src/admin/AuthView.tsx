import type { AdminViewServerProps } from 'payload'
import { getSafeRedirect } from 'payload/shared'
import React from 'react'

import type { SiteIdentity } from '../types'
import { AuthFrame } from './AuthFrame'
import { readSiteFromConfig } from './useSite'

type Props = AdminViewServerProps & { site?: SiteIdentity }

/**
 * The branded sign-in screen: one view for Payload's `login` and `forgot`
 * routes (registered by authPlugin via `admin.components.views`), so a direct
 * recovery link lands in the same frame and switching between the two never
 * reloads the brand panel.
 *
 * Server half: redirects a signed-in user away, works out the autoLogin
 * prefill, and hands the client frame what it needs. Mirrors Payload's own
 * LoginView (beta.6: `req.server.redirect`, not `next/navigation`).
 */
export function AuthView({ initPageResult, searchParams, viewType, site: fromProps }: Props) {
  const { req } = initPageResult
  const { config } = req.payload

  if (req.user) {
    const redirectTo = getSafeRedirect({
      fallbackTo: config.routes.admin,
      redirectTo: searchParams?.redirect ?? config.routes.admin,
    })
    req.server?.redirect(redirectTo)
  }

  const autoLogin =
    typeof config.admin.autoLogin === 'object' && config.admin.autoLogin.prefillOnly
      ? config.admin.autoLogin
      : undefined
  const userCollection = config.collections.find(({ slug }) => slug === config.admin.user)
  const site = fromProps ?? readSiteFromConfig(config) ?? { name: 'Sitekick' }
  // Signed-out pages get Payload's trimmed client config (no admin.custom), so the
  // googleSignIn recipe's switch travels as a prop.
  const google = (config.admin.custom as { sitekick?: { google?: { start: string } | false } } | undefined)?.sitekick?.google || undefined

  return (
    <AuthFrame
      site={site}
      initialRecovery={viewType === 'forgot'}
      google={google}
      loginEnabled={!userCollection?.auth?.disableLocalStrategy}
      prefillEmail={autoLogin?.email}
      prefillPassword={autoLogin?.password}
      prefillUsername={autoLogin?.username}
      searchParams={searchParams ?? {}}
    />
  )
}
