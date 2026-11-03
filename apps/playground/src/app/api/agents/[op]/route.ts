import config from '@payload-config'
import { createAgentRoutes } from '@sitekick/agents'
import { getPayload } from 'payload'

/**
 * The agent kit's HTTP surface for the admin: enqueue an Enrich or Draft
 * run, run a field action (alt text, SEO, rewrite…) inline, or poll a run.
 * Every call needs a signed-in editor; agents never publish.
 */
const routes = (async () => createAgentRoutes({ payload: await getPayload({ config }) }))()

const handler = async (req: Request, { params }: { params: Promise<{ op: string }> }) => (await routes).handle(req, (await params).op)

export const POST = handler
export const GET = handler
