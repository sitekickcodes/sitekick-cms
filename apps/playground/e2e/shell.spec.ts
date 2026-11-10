import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

import { watchErrors } from './helpers'

/** The sidebar: the column that holds the brand row. */
const sidebar = (page: Page) => page.locator('aside').filter({ has: page.getByRole('link', { name: 'Demo Co.: dashboard' }) })

test.describe('shell', () => {
  test('sidebar, dashboard cards and the Create menu', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/admin')
    const nav = sidebar(page)
    await expect(page.getByRole('link', { name: 'Demo Co.: dashboard' })).toBeVisible()
    for (const label of ['Search', 'Dashboard', 'Website', 'Get help']) await expect(nav.getByText(label, { exact: true }).first()).toBeVisible()
    for (const card of ['Drafts waiting', 'Recent edits', 'Collections at a glance', 'New submissions', 'Missing pages', 'Coming up']) {
      await expect(page.getByRole('heading', { name: card, level: 3 })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('menuitem', { name: /^Page$/ }).or(page.getByRole('link', { name: /^Page$/ })).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('command palette: keyboard, search, Enter, Escape', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/admin')
    await page.keyboard.press('ControlOrMeta+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
    // From the sidebar row too, then search documents and open one.
    await sidebar(page).getByText('Search', { exact: true }).first().click()
    await expect(palette).toBeVisible()
    await palette.getByPlaceholder('Jump to a page, document or action…').fill('Home')
    await expect(palette.getByText('Home', { exact: true }).first()).toBeVisible()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/admin\/collections\/pages\/\d+/)
    expect(errors).toEqual([])
  })

  test('help drawer: opens, searches, closes', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/admin')
    await page.getByText('Get help', { exact: true }).first().click()
    const search = page.getByPlaceholder('Search help')
    await expect(search).toBeVisible()
    await search.fill('Redirects')
    await expect(page.getByText('Redirects and missing pages').first()).toBeVisible()
    await page.getByRole('button', { name: 'Close help' }).click()
    await expect(search).toBeHidden()
    expect(errors).toEqual([])
  })
})
