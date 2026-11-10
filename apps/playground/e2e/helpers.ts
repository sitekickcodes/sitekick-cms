import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const ADMIN = { email: 'e2e@sitekick.test', password: process.env.E2E_PASSWORD || 'e2e-admin-password' }

/** The four widths in docs/ADMIN-SIGNOFF.md. */
export const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small phone', width: 320, height: 640 },
] as const

/** Console errors and uncaught exceptions on a page, minus noise that isn't ours. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  const noise = [/favicon/i, /Download the React DevTools/i, /\[Fast Refresh\]/i, /webpack-hmr|turbopack-hmr/i]
  page.on('console', (m) => {
    if (m.type() === 'error' && !noise.some((n) => n.test(m.text()))) errors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`))
  return errors
}

/** The page never scrolls sideways (a few pixels of rounding allowed). */
export async function expectNoSidewaysScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${where} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(2)
}

/** Payload's REST API as the signed-in admin (the context carries the cookie). */
export function api(request: APIRequestContext) {
  const call = async <T>(method: string, path: string, data?: unknown): Promise<T> => {
    const res = await request.fetch(`/api${path}`, { method, data, headers: { 'content-type': 'application/json' } })
    if (!res.ok()) throw new Error(`${method} /api${path} → ${res.status()}: ${(await res.text()).slice(0, 300)}`)
    return (await res.json()) as T
  }
  return {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, data: unknown) => call<T>('POST', path, data),
    patch: <T>(path: string, data: unknown) => call<T>('PATCH', path, data),
    delete: <T>(path: string) => call<T>('DELETE', path),
  }
}

/** A name no other run will have, so tests clean up after themselves without clashing. */
export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Lexical rich text from paragraphs. */
export const richText = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: paragraphs.map((text) => ({ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, textStyle: '', children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }] })),
  },
})
