import type { z } from 'zod'

import { clientKey, createRateLimiter, type RateLimiter, type RateLimitOptions, type RateLimitResult } from './rateLimit'

/** Shared response helpers for the public read-only surface. */

export const problemSchema = {
  type: 'object',
  required: ['type', 'title', 'status', 'detail'],
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    detail: { type: 'string' },
  },
} as const

const TITLES: Record<number, string> = {
  400: 'Bad request',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  413: 'Request too large',
  429: 'Too many requests',
  503: 'Service unavailable',
}

export const publicHeaders = (origin: string, openapiPath: string): Record<string, string> => ({
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'RateLimit, RateLimit-Policy, Retry-After, Link',
  Link: `<${origin}${openapiPath}>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
  'X-Content-Type-Options': 'nosniff',
})

/** RFC 9457 problem details. */
export const problem = (status: number, detail: string, headers: HeadersInit = {}): Response =>
  Response.json(
    { type: 'about:blank', title: TITLES[status] ?? 'Error', status, detail },
    { status, headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' } },
  )

export const cors = (headers: Record<string, string>, methods = 'GET, HEAD, OPTIONS'): Response =>
  new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': methods, 'Access-Control-Allow-Headers': 'Accept, Content-Type' } })

export type Budget = { take: (req: Request) => RateLimitResult }

export const budgetFor = (options?: RateLimitOptions): Budget => {
  const limiter: RateLimiter = createRateLimiter(options)
  return { take: (req) => limiter(clientKey(req)) }
}

export const applyHeaders = (response: Response, headers: Record<string, string>): Response => {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

const WRAPPERS = new Set(['optional', 'default', 'nullable'])

type ZodNode = { _zod: { def: { type: string; innerType?: unknown } } }

/** Zod 4 wraps optional/default around the real type; `_zod.def` is the public internals. */
const innermostType = (schema: unknown): string | undefined => {
  let current = schema as ZodNode | undefined
  while (current && WRAPPERS.has(current._zod.def.type)) current = current._zod.def.innerType as ZodNode | undefined
  return current?._zod.def.type
}

/** Query string → object, coercing numbers and booleans where the schema says so. */
export const queryToInput = (params: URLSearchParams, input: z.ZodObject<z.ZodRawShape>): Record<string, unknown> => {
  const values: Record<string, unknown> = {}
  for (const [key, raw] of params) {
    const inner = innermostType(input.shape[key])
    if (inner === 'number' || inner === 'int') values[key] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
    else if (inner === 'boolean') values[key] = raw === 'true' ? true : raw === 'false' ? false : raw
    else values[key] = raw
  }
  return values
}

export const issuesText = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; ')
