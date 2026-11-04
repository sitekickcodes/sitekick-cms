import type { CollectionSlug, PayloadRequest } from 'payload'

import { canSendEmail } from '../email'
import type { SiteIdentity, SitekickCMSOptions } from '../types'

/**
 * Account emails: the invite an admin sends a new editor, and the branded
 * version of Payload's password-reset email. One template for both, so an
 * editor never meets a bare "Reset your password" link from a sender they
 * don't recognise. Branding comes from `options.site` (name, logo, accent).
 *
 * The invite rides Payload's own reset machinery: `forgotPassword` with
 * `disableEmail` hands back a reset token (and stores it on the user), and
 * the invite links to the stock /admin/reset/<token> page, where the person
 * picks their password and lands signed in. Nothing custom guards the token.
 *
 * Invite links last a week; a self-service reset keeps Payload's one hour.
 * That only works while the users collection sets no
 * `auth.forgotPassword.expiration`: the collection value beats the per-call
 * one. augmentUsers never sets it; neither should a client config.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Where links in account email point. `site.url`, else the config's
 * `serverURL`, else the host the admin was opened at (a branch preview).
 */
export function adminOrigin(req: PayloadRequest, site: SiteIdentity): string {
  if (site.url) return site.url.replace(/\/$/, '')
  const { serverURL } = req.payload.config
  if (serverURL) return serverURL.replace(/\/$/, '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

/** `${origin}${routes.admin}${path}`, e.g. `/admin/reset/<token>`. */
export function adminURL(req: PayloadRequest, site: SiteIdentity, path: string): string {
  const { routes } = req.payload.config
  return `${adminOrigin(req, site)}${routes.admin}${path}`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type AccountEmail = {
  site: SiteIdentity
  origin: string
  heading: string
  /** Plain-text paragraphs; escaped for the HTML part. */
  paragraphs: string[]
  button: { label: string; url: string }
  /** Small print under the button. */
  footnote: string
}

/**
 * The shared layout: a table-based, inline-styled card that holds up in
 * Gmail and Outlook, plus a plain-text twin. System fonts only; brand faces
 * don't load in mail clients. The logo rides along when `site.logo` is set
 * (a path is made absolute against `origin`); the button takes the accent.
 */
export function renderAccountEmail({ site, origin, heading, paragraphs, button, footnote }: AccountEmail) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
  const accent = site.accent ?? '#0f766e'
  const logoSrc = site.logo ? (/^https?:\/\//.test(site.logo) ? site.logo : `${origin}${site.logo}`) : null
  const mark = logoSrc
    ? `<img src="${esc(logoSrc)}" height="36" alt="${esc(site.name)}" style="display:block;height:36px;width:auto;max-width:200px;">`
    : `<span style="display:inline-block;font-family:${font};font-size:20px;font-weight:600;color:#1f1f1e;">${esc(site.name)}</span>`
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f2ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;">
<tr><td style="padding:32px 32px 8px;">
${mark}
</td></tr>
<tr><td style="padding:16px 32px 0;font-family:${font};color:#242423;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;">${esc(p)}</p>`).join('\n')}
</td></tr>
<tr><td style="padding:12px 32px 8px;">
<a href="${esc(button.url)}" style="display:inline-block;background:${esc(accent)};color:#ffffff;font-family:${font};font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px;">${esc(button.label)}</a>
</td></tr>
<tr><td style="padding:16px 32px 32px;font-family:${font};font-size:13px;line-height:1.5;color:#6b6a66;">
${esc(footnote)}<br>
<span style="word-break:break-all;">${esc(button.url)}</span>
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:${font};font-size:12px;color:#8a8984;">${esc(site.name)} · ${esc(origin.replace(/^https?:\/\//, ''))}</p>
</td></tr>
</table>
</body></html>`
  const text = [heading, '', ...paragraphs.flatMap((p) => [p, '']), `${button.label}: ${button.url}`, '', footnote].join(
    '\n',
  )
  return { html, text }
}

type InviteUser = {
  id: number | string
  email: string
  roles?: string[] | null
}

/**
 * Email `userId` a link to set their password and sign in, and stamp
 * `invitedAt`. Safe to repeat: each send issues a fresh link and the older
 * one stops working. Throws if the mail relay refuses the message.
 */
export async function sendInvite(
  req: PayloadRequest,
  options: SitekickCMSOptions,
  userId: number | string,
): Promise<{ email: string; invitedAt: string; emailed: boolean; link?: string }> {
  const { payload } = req
  const { site } = options
  const collection = options.usersSlug ?? 'users'
  const user = (await payload.findByID({ collection: collection as CollectionSlug, id: userId, depth: 0, req })) as unknown as InviteUser

  const token = await payload.forgotPassword({
    collection: collection as CollectionSlug,
    data: { email: user.email },
    disableEmail: true,
    expiration: INVITE_TTL_MS,
    req,
  })
  if (!token) throw new Error(`Couldn't issue a sign-in link for ${user.email}.`)

  const origin = adminOrigin(req, site)
  const admin = user.roles?.includes('admin')
  const inviter = req.user && 'email' in req.user ? String(req.user.email) : null
  const what = admin
    ? `as an admin on the ${site.name} website. You can edit everything and manage who else has access.`
    : `as an editor on the ${site.name} website. You can edit pages and content.`

  const link = adminURL(req, site, `${req.payload.config.admin.routes.reset}/${token}`)
  const { html, text } = renderAccountEmail({
    site,
    origin,
    heading: `You're invited to the ${site.name} website`,
    paragraphs: [
      `${inviter ? `${inviter} added you` : "You've been added"} ${what}`,
      `Choose a password to finish setting up your account. You'll sign in with this email address, ${user.email}.`,
    ],
    button: { label: 'Set your password', url: link },
    footnote: `This link works for 7 days. If it expires, get a new one at ${adminURL(req, site, req.payload.config.admin.routes.forgot)}.`,
  })

  // No mail provider yet: the admin gets the link to pass on instead of an email nobody receives.
  const emailed = canSendEmail(payload)
  if (emailed) await payload.sendEmail({ to: user.email, subject: `Set up your ${site.name} website account`, html, text })

  const invitedAt = new Date().toISOString()
  await payload.update({ collection: collection as CollectionSlug, id: userId, data: { invitedAt }, req, overrideAccess: true })
  return emailed ? { email: user.email, invitedAt, emailed } : { email: user.email, invitedAt, emailed, link }
}

/** Payload's forgot-password email, in the same layout as the invite. */
export const passwordResetEmail = (options: SitekickCMSOptions) => {
  const { site } = options
  return {
    generateEmailSubject: () => `Reset your ${site.name} website password`,
    generateEmailHTML: (args?: { req?: PayloadRequest; token?: string }) => {
      const origin = args?.req ? adminOrigin(args.req, site) : (site.url ?? '')
      const resetPath = args?.req?.payload.config.admin.routes.reset ?? '/reset'
      const adminRoute = args?.req?.payload.config.routes.admin ?? '/admin'
      return renderAccountEmail({
        site,
        origin,
        heading: 'Reset your password',
        paragraphs: [
          `Someone asked to reset the password for your ${site.name} website account. If it was you, choose a new one below.`,
          "If it wasn't, you can ignore this email; your password stays the same.",
        ],
        button: { label: 'Choose a new password', url: `${origin}${adminRoute}${resetPath}/${args?.token ?? ''}` },
        footnote: 'This link works for one hour.',
      }).html
    },
  }
}
