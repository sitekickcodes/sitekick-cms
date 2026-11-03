/**
 * Browser-side helpers for admin buttons (no React here; @sitekick/cms wraps
 * them). Plain fetch with the session cookie, against the routes
 * `createAgentRoutes` serves. Base path defaults to `/api/agents`.
 */
export type RequestAgentArgs =
  | { agent: 'enrich'; input: { targetCollection: string; targetId: string | number } }
  | { agent: 'draft'; input: { targetCollection: string; notes?: string; url?: string; transcript?: string; title?: string } }

export type RunActionArgs =
  | { action: 'altText'; input: { mediaId: string | number; collection?: string } }
  | { action: 'seo'; input: { collection: string; id: string | number } }
  | { action: 'rewrite'; input: { text: string; instruction: string; target?: ActionTarget } }
  | { action: 'shorten'; input: { text: string; maxChars?: number; target?: ActionTarget } }
  | { action: 'translate'; input: { text: string; to: string; target?: ActionTarget } }

export type ActionTarget = { collection: string; id?: string | number; field: string }

export type RunStatusView = {
  id: string | number
  title: string
  kind: string
  status: 'queued' | 'running' | 'waiting' | 'done' | 'failed' | 'cancelled'
  stage?: string
  now?: string
  steps?: Array<{ label: string; status: string; detail?: string; at: string }>
  question?: { text: string; options: string[] } | null
  costUsd?: number
  proposal?: string | number | null
  error?: string
}

export type AdminOptions = { basePath?: string; fetchImpl?: typeof fetch }

async function post<T>(path: string, body: unknown, { basePath = '/api/agents', fetchImpl = fetch }: AdminOptions): Promise<T> {
  const res = await fetchImpl(`${basePath}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `${path} failed (${res.status})`)
  return data
}

/** Start a run; resolves with the run id to poll with `runStatus`. */
export const requestAgent = (args: RequestAgentArgs, opts: AdminOptions = {}) => post<{ runId: string | number }>('enqueue', args, opts)

/** Run a field action inline; resolves with the value to put in the field. */
export const runAction = <V = string>(args: RunActionArgs, opts: AdminOptions = {}) => post<{ value: V; costUsd: number | null; proposalId: string | number | null }>('action', args, opts)

export async function runStatus(runId: string | number, { basePath = '/api/agents', fetchImpl = fetch }: AdminOptions = {}): Promise<RunStatusView> {
  const res = await fetchImpl(`${basePath}/status?run=${encodeURIComponent(String(runId))}`, { credentials: 'include' })
  const data = (await res.json()) as RunStatusView & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `status failed (${res.status})`)
  return data
}
