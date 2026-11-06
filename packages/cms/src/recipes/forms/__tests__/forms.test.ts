import { describe, expect, test } from 'bun:test'

import { checkAnswers, nameFor, notificationOf, summaryOf, type FormDefinition } from '../model'
import { forms } from '../index'
import { RATE, submitEndpoint } from '../submit'

const form: FormDefinition = {
  id: 1,
  title: 'Contact',
  confirmation: 'Thanks!',
  fields: [
    { blockType: 'text', key: 'your-name', label: 'Your name', required: true },
    { blockType: 'email', key: 'email', label: 'Email', required: true },
    { blockType: 'select', key: 'topic', label: 'Topic', options: [{ label: 'Volunteering' }, { label: 'Press' }] },
    { blockType: 'textarea', key: 'message', label: 'Message' },
    { blockType: 'checkbox', key: 'updates', label: 'Send me updates' },
  ],
}

describe('form rules', () => {
  test('names come from labels and stay unique', () => {
    const taken = new Set<string>()
    expect([nameFor('Your email', taken), nameFor('Your email', taken), nameFor('Café?', taken), nameFor('!!!', taken)]).toEqual(['your-email', 'your-email-2', 'cafe', 'field'])
  })

  test('answers are checked against the form, in its order, with labels kept', () => {
    expect(checkAnswers(form, { email: 'nope', topic: 'Other' })).toEqual({
      errors: { 'your-name': 'Please fill in your name.', email: 'Please enter an email address like name@example.com.', topic: 'Please choose one of the options.' },
    })
    const ok = checkAnswers(form, { 'your-name': ' Ana ', email: 'ana@example.com', topic: 'press', updates: true, extra: 'ignored' })
    expect(ok).toEqual({
      answers: [
        { key: 'your-name', label: 'Your name', value: 'Ana' },
        { key: 'email', label: 'Email', value: 'ana@example.com' },
        { key: 'topic', label: 'Topic', value: 'Press' },
        { key: 'message', label: 'Message', value: '' },
        { key: 'updates', label: 'Send me updates', value: 'Yes' },
      ],
    })
    if ('answers' in ok) {
      expect(summaryOf(ok.answers, form.fields!)).toBe('Ana · ana@example.com')
      const mail = notificationOf({ form, answers: ok.answers, site: 'Acme', url: 'https://acme.test/admin/x' })
      expect(mail.subject).toBe('New Contact submission')
      expect(mail.text).toContain('Topic:\nPress')
      expect(notificationOf({ form, answers: [{ key: 'q', label: 'Why?', value: 'x' }], site: 'Demo Co.', url: 'u' }).text).toBe('Someone filled in "Contact" on Demo Co.\n\nWhy?\nx\n\nSee it in the admin: u')
      expect(mail.html).not.toContain('Message')
    }
  })

  test('a recipe module: two private collections, a section, a card, help', () => {
    const m = forms()
    expect(m.collections!.map((c) => c.slug)).toEqual(['forms', 'form-submissions'])
    expect(m.collections!.every((c) => (c.custom as { sitekick: { private: boolean } }).sitekick.private)).toBe(true)
    expect(m.blocks!.map((b) => b.slug)).toEqual(['formBlock'])
    expect(m.help![0]!.topic).toBe('Forms')
  })
})

describe('submit endpoint', () => {
  const setup = ({ recent = 0, failEmail = false } = {}) => {
    const created: Record<string, unknown>[] = []
    const sent: Record<string, unknown>[] = []
    const payload = {
      secret: 's',
      config: { routes: { admin: '/admin' }, serverURL: 'https://acme.test', admin: { custom: { sitekick: { site: { name: 'Acme' } } } } },
      findByID: async () => ({ ...form, notify: [{ email: 'team@acme.test' }] }),
      count: async () => ({ totalDocs: recent }),
      create: async ({ data }: { data: Record<string, unknown> }) => (created.push(data), { id: 9, ...data }),
      sendEmail: async (m: Record<string, unknown>) => {
        if (failEmail) throw new Error('smtp down')
        sent.push(m)
      },
      logger: { error: () => {} },
    }
    const post = (body: unknown) =>
      submitEndpoint().handler({ routeParams: { id: '1' }, json: async () => body, headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }), payload } as never) as Promise<Response>
    return { post, created, sent }
  }
  const good = { answers: { 'your-name': 'Ana', email: 'ana@example.com' }, startedAt: Date.now() - 10_000, page: '/contact' }

  test('a person’s submission is saved and emailed, replying to them', async () => {
    const { post, created, sent } = setup()
    const res = await post(good)
    expect(await res.json()).toEqual({ ok: true, message: 'Thanks!' })
    expect(created[0]).toMatchObject({ form: 1, status: 'new', summary: 'Ana · ana@example.com', page: '/contact' })
    expect(String(created[0]!.sender)).toHaveLength(32)
    expect(sent[0]).toMatchObject({ to: ['team@acme.test'], replyTo: 'ana@example.com', subject: 'New Contact submission' })
  })

  test('bots get a quiet "thanks" and nothing is saved', async () => {
    for (const body of [{ ...good, website: 'http://spam' }, { ...good, startedAt: Date.now() }]) {
      const { post, created } = setup()
      expect((await post(body)).status).toBe(200)
      expect(created).toHaveLength(0)
    }
  })

  test('too many from one sender, or bad answers, are refused with a reason', async () => {
    expect((await setup({ recent: RATE.max }).post(good)).status).toBe(429)
    const res = await setup().post({ ...good, answers: { email: 'x' } })
    expect(res.status).toBe(400)
    expect(Object.keys(((await res.json()) as { errors: object }).errors)).toEqual(['your-name', 'email'])
  })

  test('a failed email never loses the submission', async () => {
    const { post, created } = setup({ failEmail: true })
    expect((await post(good)).status).toBe(200)
    expect(created).toHaveLength(1)
  })
})
