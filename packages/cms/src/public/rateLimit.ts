/**
 * Per-client request budget for the public surface, advertised with the IETF
 * RateLimit-Policy / RateLimit fields so agents can pace themselves. Counts
 * live in this process, so the budget is a ceiling per instance rather than a
 * global quota; it still stops one client hammering one instance.
 */

export type RateLimitOptions = {
  /** Requests per window. Default 120. */
  limit?: number
  /** Window length in seconds. Default 60. */
  windowSeconds?: number
  /** Buckets kept before stale ones are swept. Default 5000. */
  maxClients?: number
}

export type RateLimitResult = {
  limited: boolean
  headers: Record<string, string>
  retryAfter: number
}

export type RateLimiter = (clientKey: string, nowMs?: number) => RateLimitResult

export const createRateLimiter = (options: RateLimitOptions = {}): RateLimiter => {
  const limit = options.limit ?? 120
  const windowSeconds = options.windowSeconds ?? 60
  const maxClients = options.maxClients ?? 5000
  const windows = new Map<string, { start: number; count: number }>()
  return (key, nowMs = Date.now()) => {
    const now = Math.floor(nowMs / 1000)
    let entry = windows.get(key)
    if (!entry || now - entry.start >= windowSeconds) {
      entry = { start: now, count: 0 }
      windows.set(key, entry)
      // Drop stale windows so the map cannot grow without bound.
      if (windows.size > maxClients) {
        for (const [other, value] of windows) if (now - value.start >= windowSeconds) windows.delete(other)
        if (windows.size > maxClients) windows.delete(windows.keys().next().value as string)
      }
    }
    entry.count += 1
    const reset = Math.max(1, windowSeconds - (now - entry.start))
    const remaining = Math.max(0, limit - entry.count)
    const limited = entry.count > limit
    return {
      limited,
      retryAfter: reset,
      headers: {
        'RateLimit-Policy': `"public";q=${limit};w=${windowSeconds}`,
        RateLimit: `"public";r=${remaining};t=${reset}`,
        // Draft-06 compatibility fields for older clients.
        'RateLimit-Limit': String(limit),
        'RateLimit-Remaining': String(remaining),
        'RateLimit-Reset': String(reset),
        ...(limited ? { 'Retry-After': String(reset) } : {}),
      },
    }
  }
}

/** Vercel sets x-real-ip; elsewhere the first forwarded hop, else one shared bucket. */
export const clientKey = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('x-real-ip') || forwarded || 'anonymous'
}
