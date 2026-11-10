import { expect, test } from '@playwright/test'

import { WIDTHS, api, expectNoSidewaysScroll, watchErrors } from './helpers'

/** Every main screen at the four widths: no console errors, no sideways scroll. */
test('main screens at every width', async ({ page, request }) => {
  test.setTimeout(process.env.CI ? 120_000 : 600_000)
  const home = await api(request).get<{ docs: { id: number }[] }>('/pages?where[slug][equals]=home&limit=1&depth=0')
  const screens = [
    '/admin',
    '/admin/collections/pages',
    `/admin/collections/pages/${home.docs[0]?.id}`,
    '/admin/collections/pages/board',
    '/admin/inbox',
    '/admin/collections/redirects',
    '/admin/collections/form-submissions',
    '/',
  ]
  const errors = watchErrors(page)
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height })
    for (const path of screens) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expectNoSidewaysScroll(page, `${path} at ${size.name} (${size.width}px)`)
    }
  }
  expect(errors).toEqual([])
})
