import { execSync } from 'node:child_process'

/** Seed before the tests (and after the server is up): `bun run e2e:seed`, idempotent. */
export default function globalSetup() {
  execSync('bun run e2e:seed', { stdio: process.env.CI ? 'inherit' : 'ignore' })
}
