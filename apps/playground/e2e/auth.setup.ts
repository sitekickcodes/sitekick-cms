import { expect, test as setup } from '@playwright/test'

import { ADMIN, watchErrors } from './helpers'

/** Sign in once through the real form; every other test reuses the session. */
setup('sign in', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/admin/login')
  // The frame names the site, and nothing grabs focus (1Password fills cleanly).
  await expect(page.getByText('Demo Co.').first()).toBeVisible()
  const email = page.locator('input[name="email"]')
  await expect(email).toBeVisible()
  await expect(email).not.toBeFocused()
  await email.fill(ADMIN.email)
  await page.locator('input[name="password"]').fill(ADMIN.password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/admin\/?(\?.*)?$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/)
  expect(errors).toEqual([])
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
