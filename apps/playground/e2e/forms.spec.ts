import { expect, test } from '@playwright/test'

import { api, unique, watchErrors } from './helpers'

test('a visitor sends a form; the submission waits in the admin', async ({ page, request, browser }) => {
  const errors = watchErrors(page)
  const rest = api(request)
  const name = unique('E2E Visitor')
  const form = await rest.post<{ doc: { id: number } }>('/forms', {
    title: unique('E2E Contact'),
    fields: [
      { blockType: 'text', label: 'Your name', required: true },
      { blockType: 'email', label: 'Email', required: true },
      { blockType: 'textarea', label: 'Message' },
    ],
    submitLabel: 'Send message',
    confirmation: 'Thanks, we got it.',
  })
  const slug = unique('e2e-contact')
  const contact = await rest.post<{ doc: { id: number } }>('/pages?draft=false', {
    title: 'E2E Contact page',
    slug,
    _status: 'published',
    layout: [{ blockType: 'formBlock', form: form.doc.id, heading: 'Write to us' }],
  })
  try {
    const visitor = await (await browser.newContext({ storageState: undefined })).newPage()
    const visitorErrors = watchErrors(visitor)
    await visitor.goto(`/${slug}`)
    await visitor.getByRole('button', { name: 'Send message' }).click()
    await expect(visitor.getByText('Please fill in the fields marked below.')).toBeVisible()
    await visitor.getByLabel('Your name').fill(name)
    await visitor.getByLabel('Email').fill('visitor@example.com')
    await visitor.getByLabel('Message').fill('Hello from the admin suite.')
    // The server turns away anything sent faster than a person could.
    await visitor.waitForTimeout(2_100)
    await visitor.getByRole('button', { name: 'Send message' }).click()
    await expect(visitor.getByRole('status')).toHaveText('Thanks, we got it.')
    expect(visitorErrors).toEqual([])
    await visitor.context().close()

    await page.goto('/admin/collections/form-submissions')
    await expect(page.getByText(name).first()).toBeVisible()
    await expect(page.getByText('New', { exact: true }).first()).toBeVisible()
  } finally {
    const subs = await rest.get<{ docs: { id: number }[] }>(`/form-submissions?where[form][equals]=${form.doc.id}&limit=10&depth=0`)
    for (const s of subs.docs) await rest.delete(`/form-submissions/${s.id}`)
    await rest.delete(`/pages/${contact.doc.id}`)
    await rest.delete(`/forms/${form.doc.id}`)
  }
  expect(errors).toEqual([])
})
