import type { Config, EmailAdapter, Payload, Plugin, SendEmailOptions } from 'payload'

import type { SitekickCMSOptions } from '../types'

export { emailSendsFromConfig } from './client'

/**
 * Account email (invites, password resets) through one adapter, picked from the environment:
 *
 *   RESEND_API_KEY   send through Resend.
 *   EMAIL_FROM       the sender: `hello@acme.com` or `Acme <hello@acme.com>`. The address must be on
 *                    a domain verified in Resend. Blank = Resend's test sender, which only delivers
 *                    to the Resend account's own address.
 *
 * Without a key, mail is logged instead of sent: in development the whole message (links
 * included), in production only who it was for, so reset tokens stay out of hosted logs. Invites
 * notice (`canSendEmail`) and hand the admin the link to pass on themselves.
 *
 * The plugin installs this only when the config has no `email` of its own; a site that wants
 * another provider sets `email` in buildConfig and Sitekick leaves it alone.
 */

export const LOG_ADAPTER = 'sitekick-log'
const RESEND_TEST_SENDER = 'onboarding@resend.dev'

type Env = Record<string, string | undefined>
type Address = { name: string; address: string }

export const emailPlugin =
  (options: SitekickCMSOptions): Plugin =>
  (config: Config): Config => {
    const install = !config.email && options.email !== false
    const sends = install ? Boolean(process.env.RESEND_API_KEY?.trim()) : true
    // The admin reads this to avoid promising an email that only reaches the server log.
    const admin = { ...config.admin, custom: { ...config.admin?.custom } }
    admin.custom.sitekick = { ...(admin.custom.sitekick as object | undefined), emailSends: sends }
    return { ...config, admin, ...(install ? { email: emailFromEnv(options.site.name) } : {}) }
  }

export function emailFromEnv(siteName: string, env: Env = process.env): EmailAdapter {
  const apiKey = env.RESEND_API_KEY?.trim()
  const from = parseFrom(env.EMAIL_FROM, siteName)
  if (apiKey) return resendAdapter({ apiKey, from: from ?? { name: siteName, address: RESEND_TEST_SENDER } })
  return logAdapter({ from: from ?? { name: siteName, address: 'no-reply@localhost' }, verbose: env.NODE_ENV !== 'production' })
}

/** True when account email actually leaves the building. */
export function canSendEmail(payload: Payload): boolean {
  const name = (payload.email as { name?: string } | undefined)?.name
  return Boolean(name) && name !== LOG_ADAPTER && name !== 'console'
}

/** `Acme <hello@acme.com>` or `hello@acme.com` (named after the site). Blank or malformed = none. */
export function parseFrom(value: string | undefined, siteName: string): Address | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  const named = /^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/.exec(raw)
  if (named) return { name: named[1]!.trim().replace(/^"|"$/g, '') || siteName, address: named[2]! }
  if (/^[^\s@<>]+@[^\s@<>]+$/.test(raw)) return { name: siteName, address: raw }
  return undefined
}

export function resendAdapter({ apiKey, from }: { apiKey: string; from: Address }): EmailAdapter {
  return () => ({
    name: 'resend',
    defaultFromAddress: from.address,
    defaultFromName: from.name,
    sendEmail: async (message: SendEmailOptions) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(toResend(message, from)),
      })
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }
      // Resend's message is written for people ("The acme.com domain is not verified…"); pass it on.
      if (!res.ok) throw new Error(body.message ?? `Resend answered HTTP ${res.status}`)
      return body
    },
  })
}

export function toResend(message: SendEmailOptions, from: Address) {
  const to = addresses(message.to)
  if (!to.length) throw new Error('Email has no recipient.')
  return {
    from: format(addresses(message.from)[0] ?? from),
    to: to.map(format),
    ...(message.cc ? { cc: addresses(message.cc).map(format) } : {}),
    ...(message.bcc ? { bcc: addresses(message.bcc).map(format) } : {}),
    ...(message.replyTo ? { reply_to: addresses(message.replyTo).map(format) } : {}),
    subject: String(message.subject ?? ''),
    ...(typeof message.html === 'string' ? { html: message.html } : {}),
    ...(typeof message.text === 'string' ? { text: message.text } : {}),
  }
}

function logAdapter({ from, verbose }: { from: Address; verbose: boolean }): EmailAdapter {
  return ({ payload }) => ({
    name: LOG_ADAPTER,
    defaultFromAddress: from.address,
    defaultFromName: from.name,
    sendEmail: async (message: SendEmailOptions) => {
      const to = addresses(message.to).map(format).join(', ')
      if (!verbose) {
        payload.logger.warn(`Email not sent (no RESEND_API_KEY): "${message.subject}" to ${to}.`)
        return
      }
      const body = typeof message.text === 'string' ? message.text : typeof message.html === 'string' ? textOf(message.html) : ''
      payload.logger.info(`Email (not sent; set RESEND_API_KEY to send)\nTo: ${to}\nSubject: ${message.subject}\n\n${body}`)
    },
  })
}

type AddressInput = SendEmailOptions['to']

function addresses(input: AddressInput): Address[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  return list.flatMap((item) => {
    if (typeof item === 'string') {
      return item
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => parseFrom(s, '') ?? { name: '', address: s })
    }
    return [{ name: item.name ?? '', address: item.address }]
  })
}

function format({ name, address }: Address): string {
  return name ? `${name.replace(/[<>"]/g, '')} <${address}>` : address
}

/** Enough of the HTML to read the message and its links in a terminal. */
function textOf(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
