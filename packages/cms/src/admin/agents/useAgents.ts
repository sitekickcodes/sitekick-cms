'use client'

import { useConfig } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useCallback } from 'react'

import type { AgentsClientConfig } from '../../agent/ui'
import { RUNS_SLUG } from '../../review/shared'

/**
 * The agent routes as the admin buttons see them: null when the host has not
 * set the `agents` option (no buttons render), else a JSON poster that turns
 * error bodies into thrown messages, and the admin URL of a run.
 */
export function useAgents() {
  const { config } = useConfig()
  const agents = (config.admin as { custom?: { sitekick?: { agents?: AgentsClientConfig } } }).custom?.sitekick?.agents ?? null
  const basePath = agents?.basePath ?? ''

  const post = useCallback(
    async <T>(op: 'enqueue' | 'action', body: unknown): Promise<T> => {
      const res = await fetch(`${basePath}/${op}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as T & { error?: string }
      if (!res.ok) throw new Error(json.error ?? `The agent did not answer (HTTP ${res.status})`)
      return json
    },
    [basePath],
  )

  const runURL = useCallback((id: string | number) => formatAdminURL({ adminRoute: config.routes.admin, path: `/collections/${RUNS_SLUG}/${id}` }), [config.routes.admin])

  return agents ? { ...agents, post, runURL } : null
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
