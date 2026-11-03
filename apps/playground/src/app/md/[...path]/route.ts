import { surface } from '@/lib/agent-surface'

export const GET = async (req: Request, ctx: { params: Promise<{ path: string[] }> }) => surface.markdown(req, (await ctx.params).path)
