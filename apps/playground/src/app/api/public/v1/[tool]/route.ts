import { surface } from '@/lib/agent-surface'

export const GET = async (req: Request, ctx: { params: Promise<{ tool: string }> }) => surface.rest(req, (await ctx.params).tool)
export const OPTIONS = GET
