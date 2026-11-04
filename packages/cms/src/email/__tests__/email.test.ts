import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Config, Payload } from 'payload'

import { canSendEmail, emailFromEnv, emailPlugin, LOG_ADAPTER, parseFrom, resendAdapter, toResend } from '../index'
import { emailSendsFromConfig } from '../client'

const run = (plugin: ReturnType<typeof emailPlugin>, config: Config) => plugin(config) as Config

const logger = { info: mock(), warn: mock() }
const payload = { logger } as unknown as Payload
const site = { name: 'Acme' }

describe('parseFrom', () => {
  test('named, bare and malformed senders', () => {
    expect(parseFrom('Acme Team <hello@acme.com>', 'Site')).toEqual({ name: 'Acme Team', address: 'hello@acme.com' })
    expect(parseFrom('"Acme" <hello@acme.com>', 'Site')).toEqual({ name: 'Acme', address: 'hello@acme.com' })
    expect(parseFrom('hello@acme.com', 'Site')).toEqual({ name: 'Site', address: 'hello@acme.com' })
    expect(parseFrom('<hello@acme.com>', 'Site')).toEqual({ name: 'Site', address: 'hello@acme.com' })
    expect(parseFrom('not an address', 'Site')).toBeUndefined()
    expect(parseFrom('  ', 'Site')).toBeUndefined()
  })
})

describe('emailFromEnv', () => {
  test('Resend when there is a key, with EMAIL_FROM as the sender', () => {
    const adapter = emailFromEnv('Acme', { RESEND_API_KEY: 're_x', EMAIL_FROM: 'hello@acme.com' })({ payload })
    expect(adapter.name).toBe('resend')
    expect(adapter.defaultFromAddress).toBe('hello@acme.com')
    expect(adapter.defaultFromName).toBe('Acme')
  })

  test("Resend's test sender when EMAIL_FROM is blank", () => {
    expect(emailFromEnv('Acme', { RESEND_API_KEY: 're_x' })({ payload }).defaultFromAddress).toBe('onboarding@resend.dev')
  })

  test('without a key, logs the whole message in development', async () => {
    logger.info.mockClear()
    const adapter = emailFromEnv('Acme', { NODE_ENV: 'development' })({ payload })
    expect(adapter.name).toBe(LOG_ADAPTER)
    await adapter.sendEmail({ to: 'a@b.co', subject: 'Hi', html: '<p>Go <a href="https://x.co/reset/t0k">here</a></p>' })
    const line = String(logger.info.mock.calls[0]?.[0])
    expect(line).toContain('To: a@b.co')
    expect(line).toContain('here (https://x.co/reset/t0k)')
  })

  test('without a key in production, logs who it was for but never the body', async () => {
    logger.warn.mockClear()
    const adapter = emailFromEnv('Acme', { NODE_ENV: 'production' })({ payload })
    await adapter.sendEmail({ to: 'a@b.co', subject: 'Reset', text: 'https://x.co/reset/secret' })
    const line = String(logger.warn.mock.calls[0]?.[0])
    expect(line).toContain('a@b.co')
    expect(line).not.toContain('secret')
  })
})

describe('resend', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('maps a Payload message onto the Resend API', () => {
    const body = toResend(
      { to: [{ name: 'Ann', address: 'ann@x.co' }, 'bo@x.co'], replyTo: 'help@acme.com', subject: 'S', html: '<p>h</p>', text: 't' },
      { name: 'Acme', address: 'hello@acme.com' },
    )
    expect(body).toEqual({
      from: 'Acme <hello@acme.com>',
      to: ['Ann <ann@x.co>', 'bo@x.co'],
      reply_to: ['help@acme.com'],
      subject: 'S',
      html: '<p>h</p>',
      text: 't',
    })
  })

  test("passes Resend's own error message on", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ name: 'validation_error', message: 'The acme.com domain is not verified.' }, { status: 403 }),
    ) as unknown as typeof fetch
    const adapter = resendAdapter({ apiKey: 're_x', from: { name: 'Acme', address: 'hello@acme.com' } })({ payload })
    expect(adapter.sendEmail({ to: 'a@b.co', subject: 'S', text: 't' })).rejects.toThrow('The acme.com domain is not verified.')
  })

  test('sends with the key as a bearer token', async () => {
    const calls: [string, RequestInit][] = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return Response.json({ id: 'em_1' })
    }) as unknown as typeof fetch
    const adapter = resendAdapter({ apiKey: 're_x', from: { name: 'Acme', address: 'hello@acme.com' } })({ payload })
    expect(await adapter.sendEmail({ to: 'a@b.co', subject: 'S', text: 't' })).toEqual({ id: 'em_1' })
    expect(calls[0]?.[0]).toBe('https://api.resend.com/emails')
    expect((calls[0]?.[1].headers as Record<string, string>).Authorization).toBe('Bearer re_x')
  })
})

describe('emailPlugin', () => {
  const env = process.env.RESEND_API_KEY
  afterEach(() => {
    if (env === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = env
  })

  test('installs the env adapter and tells the admin whether mail sends', () => {
    delete process.env.RESEND_API_KEY
    const config = run(emailPlugin({ site }), {} as Config)
    expect(typeof config.email).toBe('function')
    expect(emailSendsFromConfig(config)).toBe(false)
    process.env.RESEND_API_KEY = 're_x'
    expect(emailSendsFromConfig(run(emailPlugin({ site }), {} as Config))).toBe(true)
  })

  test("leaves a site's own adapter alone, and trusts it to send", () => {
    const own = (() => ({})) as unknown as Config['email']
    const config = run(emailPlugin({ site }), { email: own } as Config)
    expect(config.email).toBe(own)
    expect(emailSendsFromConfig(config)).toBe(true)
  })

  test('email: false keeps Payload’s default', () => {
    expect(run(emailPlugin({ site, email: false }), {} as Config).email).toBeUndefined()
  })
})

test('canSendEmail', () => {
  expect(canSendEmail({ email: { name: 'resend' } } as unknown as Payload)).toBe(true)
  expect(canSendEmail({ email: { name: LOG_ADAPTER } } as unknown as Payload)).toBe(false)
  expect(canSendEmail({ email: { name: 'console' } } as unknown as Payload)).toBe(false)
})
