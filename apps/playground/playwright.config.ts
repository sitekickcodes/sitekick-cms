import { defineConfig, devices } from '@playwright/test'

/**
 * The admin suite: the ⚙ checks in docs/ADMIN-SIGNOFF.md, plus the recipes, against a running
 * playground. In CI (.github/workflows/ci.yml) that's a production build on an empty Postgres,
 * migrated and seeded first. Locally it uses whatever runs on :3100 (the dev server, on the
 * Neon `dev` branch).
 *
 *   bun run e2e            # all of it
 *   bun run e2e -- --ui    # watch it
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e',
  // Fresh demo data every run: the admin account, the demo page, an open proposal and a run.
  globalSetup: './e2e/global-setup.ts',
  // A dev server compiles each route on first visit; a production build is fast.
  timeout: process.env.CI ? 30_000 : 90_000,
  expect: { timeout: process.env.CI ? 10_000 : 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Payload checks the Origin of cookie-authenticated API calls.
    extraHTTPHeaders: { origin: baseURL },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'admin', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/admin.json' } },
  ],
  webServer: process.env.CI ? { command: 'bun run start -p 3100', url: `${baseURL}/admin/login`, timeout: 120_000, reuseExistingServer: false } : undefined,
})
