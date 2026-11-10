import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers'

/** Uses the review demo (scripts/seed-review.ts): a proposal for Jane Doe and a run with a question. */
test('inbox, a proposal decided per field, and a run waiting on a question', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/admin/inbox')
  await expect(page.getByRole('heading', { name: 'To review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()

  await page.getByRole('link', { name: 'Enrich: Jane Doe', exact: true }).first().click()
  await page.waitForURL(/\/collections\/proposals\/\d+/)
  await expect(page.getByText('To review').first()).toBeVisible()
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  const fields = await accept.count()
  expect(fields).toBeGreaterThan(1)
  await accept.first().click()
  await expect(page.getByText(/accepted|saved/i).first()).toBeVisible()
  await page.getByRole('button', { name: 'Reject all' }).click()
  await expect(page.getByText(/Partly accepted|Partial/i).first()).toBeVisible()

  await page.goto('/admin/inbox')
  await page.getByRole('link', { name: 'Enrich: Jane Doe (demo run)' }).first().click()
  await page.waitForURL(/\/collections\/runs\/\d+/)
  await expect(page.getByText(/Now/).first()).toBeVisible()
  expect(errors).toEqual([])
})
