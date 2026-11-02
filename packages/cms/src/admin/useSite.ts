'use client'

import { useConfig } from '@payloadcms/ui'

import type { SiteIdentity } from '../types'

/**
 * The client identity, for admin components. `authPlugin` stores it at
 * `admin.custom.sitekick.site` (sent to the client config) and also passes it
 * as `clientProps.site` where a component slot allows; a prop wins.
 */
export function readSiteFromConfig(config: unknown): SiteIdentity | undefined {
  const custom = (config as { admin?: { custom?: { sitekick?: { site?: SiteIdentity } } } } | undefined)
    ?.admin?.custom
  return custom?.sitekick?.site
}

export function useSite(fromProps?: SiteIdentity): SiteIdentity {
  const { config } = useConfig()
  return fromProps ?? readSiteFromConfig(config) ?? { name: 'Sitekick' }
}
