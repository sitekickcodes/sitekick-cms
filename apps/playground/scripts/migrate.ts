import { getPayload } from 'payload'

// Migrations need a direct session even when app traffic uses the pooler.
const connection = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!connection) throw new Error('DATABASE_URL is required for migrations.')
const url = new URL(connection)
url.hostname = url.hostname.replace(/-pooler(?=\.)/, '')
process.env.DATABASE_URL = url.toString()

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const result = await payload.db.migrate({ shouldPrompt: false })
  if (result?.cancelled) throw new Error('Migration cancelled: inspect migration history before deploying.')
  payload.logger.info('Database migrations complete.')
} finally {
  await payload.destroy()
}
// Bun keeps idle sockets open after destroy; all work is done.
process.exit(0)
