import { expect, test } from '@playwright/test'

import { api, unique, watchErrors } from './helpers'

type List = { totalDocs: number; docs: Array<{ id: number; slug?: string; _status?: string }> }

test('a page from Create New to live on the site', async ({ page, request }) => {
  const errors = watchErrors(page)
  const rest = api(request)
  const before = await rest.get<List>('/pages?limit=0&draft=true')
  await page.goto('/admin/collections/pages/create')
  await expect(page.getByLabel('Title')).toBeVisible()
  // Opening Create New saves nothing (drafts convention).
  await page.waitForTimeout(3_000)
  expect((await rest.get<List>('/pages?limit=0&draft=true')).totalDocs).toBe(before.totalDocs)

  const title = unique('E2E Page')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: /^Publish/ }).first().click()
  await expect(page.getByText(/published|Updated successfully/i).first()).toBeVisible()
  await page.waitForURL(/\/admin\/collections\/pages\/\d+/)
  const id = Number(page.url().match(/pages\/(\d+)/)![1])
  try {
    // Slug from the title; no API view.
    const doc = await rest.get<{ slug: string; _status: string }>(`/pages/${id}?depth=0`)
    expect(doc.slug).toBe(title.toLowerCase().replace(/\s+/g, '-'))
    expect(doc._status).toBe('published')
    await expect(page.getByRole('link', { name: 'API', exact: true })).toHaveCount(0)

    const site = await page.context().newPage()
    await site.goto(`/${doc.slug}`)
    await expect(site.getByRole('heading', { name: title })).toBeVisible()
    await site.close()
  } finally {
    await rest.delete(`/pages/${id}`)
  }
  expect(errors).toEqual([])
})

test('board view shows the three columns', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/admin/collections/pages/board')
  for (const column of ['Draft', 'Changed', 'Published']) await expect(page.getByRole('heading', { name: new RegExp(`^${column}`) }).first()).toBeVisible()
  expect(errors).toEqual([])
})
