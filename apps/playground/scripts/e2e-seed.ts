import { getPayload } from 'payload'

/**
 * What the admin suite (e2e/) signs in with and looks at: an admin account, plus the demo
 * page and the review demo (run those scripts too; see playwright.config.ts). Idempotent.
 *
 *   bun scripts/e2e-seed.ts
 */
export const E2E_USER = { email: 'e2e@sitekick.test', password: process.env.E2E_PASSWORD || 'e2e-admin-password', name: 'E2E Admin' }

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: E2E_USER.email } }, limit: 1, overrideAccess: true })
  if (docs[0]) await payload.update({ collection: 'users', id: docs[0].id, data: { password: E2E_USER.password, roles: ['admin'] } as never, overrideAccess: true })
  else await payload.create({ collection: 'users', data: { ...E2E_USER, roles: ['admin'] } as never, overrideAccess: true })
  payload.logger.info(`E2E admin ready: ${E2E_USER.email}`)
} finally {
  await payload.destroy()
}
process.exit(0)
