import { expect, test } from '@playwright/test'

import { api, unique, watchErrors } from './helpers'

test('a redirect sends visitors on; a missing page becomes one', async ({ page, request }) => {
  // The proxy keeps the table for REDIRECTS_TTL_MS (CI: half a second; a dev server: a minute).
  test.setTimeout(process.env.CI ? 60_000 : 180_000)
  const errors = watchErrors(page)
  const rest = api(request)
  const from = `/${unique('e2e-old')}`
  const missing = `/${unique('e2e-missing')}`
  const redirect = await rest.post<{ doc: { id: number } }>('/redirects', { from, to: '/news' })
  try {
    await expect
      .poll(async () => (await request.fetch(`${from}?utm_source=e2e`, { maxRedirects: 0 })).headers().location ?? '', { timeout: process.env.CI ? 20_000 : 150_000, intervals: [1_000] })
      .toMatch(/\/news\?utm_source=e2e$/)

    const visitor = await page.context().newPage()
    const res = await visitor.goto(missing)
    expect(res?.status()).toBe(404)
    await expect(visitor.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible()
    await visitor.close()

    await page.goto('/admin/collections/missing-pages')
    await page.getByRole('link', { name: missing }).first().click()
    await page.waitForURL(/\/missing-pages\/\d+/)
    await page.getByRole('textbox', { name: 'Send people to' }).fill('/news')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Marked fixed in the same save, so the editor sees it without reloading.
    await expect(page.getByText('Redirected', { exact: true }).first()).toBeVisible()
    const made = await rest.get<{ totalDocs: number }>(`/redirects?where[from][equals]=${encodeURIComponent(missing)}&limit=0`)
    expect(made.totalDocs).toBe(1)
  } finally {
    await rest.delete(`/redirects/${redirect.doc.id}`)
    const made = await rest.get<{ docs: { id: number }[] }>(`/redirects?where[from][equals]=${encodeURIComponent(missing)}&depth=0`)
    for (const r of made.docs) await rest.delete(`/redirects/${r.id}`)
    const m = await rest.get<{ docs: { id: number }[] }>(`/missing-pages?where[path][equals]=${encodeURIComponent(missing)}&depth=0`)
    for (const r of m.docs) await rest.delete(`/missing-pages/${r.id}`)
  }
  expect(errors).toEqual([])
})
