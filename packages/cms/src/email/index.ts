import type { Config, EmailAdapter, Payload, Plugin, SendEmailOptions } from 'payload'

import type { SitekickCMSOptions } from '../types'

export { emailSendsFromConfig } from './client'

/**
 * Account email (invites, password resets) through AutoSend, configured from the environment:
 *
 *   AUTOSEND_API_KEY  an AutoSend API key.
 *   EMAIL_FROM        the sender: `hello@acme.com` or `Acme <hello@acme.com>`, on a domain
 *                     verified in AutoSend. A bare address is sent under the site name.
 *
 * Until both are set, mail is logged instead of sent: in development the whole message (links
 * included), in production only who it was for, so reset tokens stay out of hosted logs. Invites
 * notice (`canSendEmail`) and hand the admin the link to pass on themselves.
 *
 * The plugin installs this only when the config has no `email` of its own; a site that wants
 * another provider sets `email` in buildConfig and Sitekick leaves it alone.
 */

export const LOG_ADAPTER = 'sitekick-log'
const AUTOSEND_URL = 'https://api.autosend.com/v1/mails/send'

type Env = Record<string, string | undefined>
type Address = { name: string; address: string }

export const emailPlugin =
  (options: SitekickCMSOptions): Plugin =>
  (config: Config): Config => {
    const install = !config.email && options.email !== false
    const sends = install ? !missingSetting(process.env) : true
    // The admin reads this to avoid promising an email that only reaches the server log.
    const admin = { ...config.admin, custom: { ...config.admin?.custom } }
    admin.custom.sitekick = { ...(admin.custom.sitekick as object | undefined), emailSends: sends }
    return { ...config, admin, ...(install ? { email: emailFromEnv(options.site.name) } : {}) }
  }

export function emailFromEnv(siteName: string, env: Env = process.env): EmailAdapter {
  const apiKey = env.AUTOSEND_API_KEY?.trim()
  const from = parseFrom(env.EMAIL_FROM, siteName)
  const missing = missingSetting(env)
  if (!missing && apiKey && from) return autosendAdapter({ apiKey, from })
  return logAdapter({ from: from ?? { name: siteName, address: 'no-reply@localhost' }, verbose: env.NODE_ENV !== 'production', missing: missing ?? 'EMAIL_FROM' })
}

/** The first setting email still needs, or undefined when it can send. */
export function missingSetting(env: Env): 'AUTOSEND_API_KEY' | 'EMAIL_FROM' | undefined {
  if (!env.AUTOSEND_API_KEY?.trim()) return 'AUTOSEND_API_KEY'
  if (!parseFrom(env.EMAIL_FROM, 'site')) return 'EMAIL_FROM'
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

export function autosendAdapter({ apiKey, from }: { apiKey: string; from: Address }): EmailAdapter {
  return () => ({
    name: 'autosend',
    defaultFromAddress: from.address,
    defaultFromName: from.name,
    sendEmail: async (message: SendEmailOptions) => {
      // AutoSend takes one `to` per request; account email has one, but don't drop any.
      const results = []
      for (const body of toAutoSend(message, from)) {
        const res = await fetch(AUTOSEND_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = (await res.json().catch(() => ({}))) as AutoSendResponse
        if (!res.ok || json.success === false) throw new Error(errorOf(json) ?? `AutoSend answered HTTP ${res.status}`)
        results.push(json.data)
      }
      return results.length === 1 ? results[0] : results
    },
  })
}

type AutoSendAddress = { email: string; name?: string }
type AutoSendResponse = {
  success?: boolean
  data?: { emailId?: string }
  message?: string
  error?: string | { message?: string }
  errors?: { message?: string }[]
}

export function toAutoSend(message: SendEmailOptions, from: Address) {
  const to = addresses(message.to)
  if (!to.length) throw new Error('Email has no recipient.')
  const cc = addresses(message.cc).map(autosendAddress)
  const bcc = addresses(message.bcc).map(autosendAddress)
  const replyTo = addresses(message.replyTo)[0]
  return to.map((recipient) => ({
    from: autosendAddress(addresses(message.from)[0] ?? from),
    to: autosendAddress(recipient),
    ...(cc.length ? { cc } : {}),
    ...(bcc.length ? { bcc } : {}),
    ...(replyTo ? { replyTo: autosendAddress(replyTo) } : {}),
    subject: String(message.subject ?? ''),
    // AutoSend renders html and text as Handlebars; the message is final, so no `{{` may reach it.
    ...(typeof message.html === 'string' ? { html: message.html.replaceAll('{{', '&#123;&#123;') } : {}),
    ...(typeof message.text === 'string' ? { text: message.text.replaceAll('{{', '{\u200b{') } : {}),
  }))
}

function autosendAddress({ name, address }: Address): AutoSendAddress {
  return name ? { email: address, name } : { email: address }
}

/** AutoSend doesn't document its error shape; take the first readable message it gives. */
function errorOf(json: AutoSendResponse): string | undefined {
  if (typeof json.error === 'string') return json.error
  return json.error?.message ?? json.errors?.[0]?.message ?? json.message
}

function logAdapter({ from, verbose, missing }: { from: Address; verbose: boolean; missing: string }): EmailAdapter {
  return ({ payload }) => ({
    name: LOG_ADAPTER,
    defaultFromAddress: from.address,
    defaultFromName: from.name,
    sendEmail: async (message: SendEmailOptions) => {
      const to = addresses(message.to).map(format).join(', ')
      if (!verbose) {
        payload.logger.warn(`Email not sent (${missing} is not set): "${message.subject}" to ${to}.`)
        return
      }
      const body = typeof message.text === 'string' ? message.text : typeof message.html === 'string' ? textOf(message.html) : ''
      payload.logger.info(`Email (not sent; set ${missing} to send)\nTo: ${to}\nSubject: ${message.subject}\n\n${body}`)
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
