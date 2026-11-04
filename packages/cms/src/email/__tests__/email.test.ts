import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Config, Payload } from 'payload'

import { autosendAdapter, canSendEmail, emailFromEnv, emailPlugin, LOG_ADAPTER, missingSetting, parseFrom, toAutoSend } from '../index'
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
  test('AutoSend when there is a key and a sender', () => {
    const adapter = emailFromEnv('Acme', { AUTOSEND_API_KEY: 'as_x', EMAIL_FROM: 'hello@acme.com' })({ payload })
    expect(adapter.name).toBe('autosend')
    expect(adapter.defaultFromAddress).toBe('hello@acme.com')
    expect(adapter.defaultFromName).toBe('Acme')
  })

  test('a key without a sender is not enough (AutoSend has no test sender)', () => {
    expect(emailFromEnv('Acme', { AUTOSEND_API_KEY: 'as_x' })({ payload }).name).toBe(LOG_ADAPTER)
    expect(missingSetting({ AUTOSEND_API_KEY: 'as_x' })).toBe('EMAIL_FROM')
    expect(missingSetting({ EMAIL_FROM: 'hello@acme.com' })).toBe('AUTOSEND_API_KEY')
    expect(missingSetting({ AUTOSEND_API_KEY: 'as_x', EMAIL_FROM: 'hello@acme.com' })).toBeUndefined()
  })

  test('without a key, logs the whole message in development', async () => {
    logger.info.mockClear()
    const adapter = emailFromEnv('Acme', { NODE_ENV: 'development' })({ payload })
    expect(adapter.name).toBe(LOG_ADAPTER)
    await adapter.sendEmail({ to: 'a@b.co', subject: 'Hi', html: '<p>Go <a href="https://x.co/reset/t0k">here</a></p>' })
    const line = String(logger.info.mock.calls[0]?.[0])
    expect(line).toContain('AUTOSEND_API_KEY')
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

describe('autosend', () => {
  const realFetch = globalThis.fetch
  const from = { name: 'Acme', address: 'hello@acme.com' }
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('maps a Payload message onto the AutoSend API, one request per recipient', () => {
    const bodies = toAutoSend(
      { to: [{ name: 'Ann', address: 'ann@x.co' }, 'bo@x.co'], cc: 'cc@x.co', replyTo: 'help@acme.com', subject: 'S', html: '<p>h</p>', text: 't' },
      from,
    )
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toEqual({
      from: { email: 'hello@acme.com', name: 'Acme' },
      to: { email: 'ann@x.co', name: 'Ann' },
      cc: [{ email: 'cc@x.co' }],
      replyTo: { email: 'help@acme.com' },
      subject: 'S',
      html: '<p>h</p>',
      text: 't',
    })
    expect(bodies[1]?.to).toEqual({ email: 'bo@x.co' })
  })

  test('nothing in the message is read as a Handlebars tag', () => {
    const [body] = toAutoSend({ to: 'a@b.co', subject: 'S', html: '<p>{{name}}</p>', text: 'Hi {{name}}' }, from)
    expect(body?.html).toBe('<p>&#123;&#123;name}}</p>')
    expect(body?.text).not.toContain('{{')
  })

  test('passes AutoSend\'s error message on', async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ success: false, error: { message: 'Domain acme.com is not verified.' } }, { status: 400 }),
    ) as unknown as typeof fetch
    const adapter = autosendAdapter({ apiKey: 'as_x', from })({ payload })
    expect(adapter.sendEmail({ to: 'a@b.co', subject: 'S', text: 't' })).rejects.toThrow('Domain acme.com is not verified.')
  })

  test('sends with the key as a bearer token', async () => {
    const calls: [string, RequestInit][] = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return Response.json({ success: true, data: { emailId: 'em_1', message: 'Email queued successfully.', totalRecipients: 1 } })
    }) as unknown as typeof fetch
    const adapter = autosendAdapter({ apiKey: 'as_x', from })({ payload })
    expect(await adapter.sendEmail({ to: 'a@b.co', subject: 'S', text: 't' })).toMatchObject({ emailId: 'em_1' })
    expect(calls[0]?.[0]).toBe('https://api.autosend.com/v1/mails/send')
    expect((calls[0]?.[1].headers as Record<string, string>).Authorization).toBe('Bearer as_x')
  })
})

describe('emailPlugin', () => {
  const saved = { key: process.env.AUTOSEND_API_KEY, from: process.env.EMAIL_FROM }
  afterEach(() => {
    for (const [name, value] of [['AUTOSEND_API_KEY', saved.key], ['EMAIL_FROM', saved.from]] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  test('installs the env adapter and tells the admin whether mail sends', () => {
    delete process.env.AUTOSEND_API_KEY
    const config = run(emailPlugin({ site }), {} as Config)
    expect(typeof config.email).toBe('function')
    expect(emailSendsFromConfig(config)).toBe(false)
    process.env.AUTOSEND_API_KEY = 'as_x'
    process.env.EMAIL_FROM = 'Acme <hello@acme.com>'
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
  expect(canSendEmail({ email: { name: 'autosend' } } as unknown as Payload)).toBe(true)
  expect(canSendEmail({ email: { name: LOG_ADAPTER } } as unknown as Payload)).toBe(false)
  expect(canSendEmail({ email: { name: 'console' } } as unknown as Payload)).toBe(false)
})
