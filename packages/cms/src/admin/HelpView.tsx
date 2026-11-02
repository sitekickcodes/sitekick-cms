import type { AdminViewServerProps } from 'payload'

import { HELP_PARAM } from '../help/shared'

/**
 * `/admin/help[?article=<id>]`: a stable address for links in emails and
 * docs. It redirects to `/admin?help=<id>`, which the provider opens as the
 * drawer over the dashboard. Signed-out people go through login and back.
 */
export function HelpView({ initPageResult, payload, searchParams, server }: AdminViewServerProps) {
  const adminRoute = payload.config.routes.admin
  const article = typeof searchParams?.article === 'string' ? searchParams.article : 'all'
  const destination = `${adminRoute}?${HELP_PARAM}=${encodeURIComponent(article)}`
  if (!initPageResult.req.user) {
    server.redirect(`${adminRoute}/login?redirect=${encodeURIComponent(destination)}`)
  }
  server.redirect(destination)
  return null
}
