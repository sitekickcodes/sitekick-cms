/**
 * Model selection for every call the kit makes. A plain `provider/model` string
 * routes through Vercel AI Gateway in `ai` v7 (OIDC on Vercel, or
 * AI_GATEWAY_API_KEY elsewhere); the Gateway also runs the fallback chain in
 * `providerOptions.gateway.models` when the primary model fails.
 */
export type ModelPurpose = 'actions' | 'research' | 'judge'

export const DEFAULT_MODELS: Record<ModelPurpose, string> = {
  actions: 'anthropic/claude-sonnet-5-5',
  research: 'anthropic/claude-sonnet-5-5',
  judge: 'anthropic/claude-opus-5-5',
}

/**
 * Models a client may select by env or option. A typo in an override must not
 * pick an unmeasured or expensive model, so anything outside this list falls
 * back to the default for the purpose. Extend per deployment with
 * SITEKICK_MODEL_ALLOWLIST (comma separated).
 */
export const MODEL_ALLOWLIST: readonly string[] = [
  'anthropic/claude-sonnet-5-5',
  'anthropic/claude-opus-5-5',
  'anthropic/claude-haiku-5-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-6',
  'openai/gpt-6-mini',
  'google/gemini-3-pro',
  'google/gemini-3-flash',
]

/** Cheaper same-family model to retry on when the primary is down. */
const FALLBACKS: Record<string, string[]> = {
  'anthropic/claude-sonnet-5-5': ['anthropic/claude-sonnet-4-5', 'anthropic/claude-haiku-5-5'],
  'anthropic/claude-opus-5-5': ['anthropic/claude-sonnet-5-5'],
  'anthropic/claude-haiku-5-5': ['anthropic/claude-haiku-4-5'],
}

export type ResolvedModel = {
  model: string
  fallbacks: string[]
  /** Spread into `generateText` so the Gateway retries down the chain. */
  providerOptions: { gateway: { models: string[] } }
  /** Where the choice came from, for the run's `model` column and debugging. */
  source: 'override' | 'env' | 'default'
  rejected?: string
}

type Env = Record<string, string | undefined>

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function allowlist(env: Env = process.env): string[] {
  return [...MODEL_ALLOWLIST, ...list(env.SITEKICK_MODEL_ALLOWLIST)]
}

export function resolveModel({
  purpose,
  override,
  env = process.env,
}: {
  purpose: ModelPurpose
  override?: string
  env?: Env
}): ResolvedModel {
  const allowed = allowlist(env)
  const fromEnv = env[`SITEKICK_MODEL_${purpose.toUpperCase()}`]?.trim()
  const candidates: Array<[string | undefined, ResolvedModel['source']]> = [
    [override?.trim(), 'override'],
    [fromEnv, 'env'],
  ]
  let rejected: string | undefined
  for (const [candidate, source] of candidates) {
    if (!candidate) continue
    if (allowed.includes(candidate)) return finish(candidate, source, env, rejected)
    rejected = candidate
  }
  return finish(DEFAULT_MODELS[purpose], 'default', env, rejected)
}

function finish(model: string, source: ResolvedModel['source'], env: Env, rejected?: string): ResolvedModel {
  const custom = list(env.SITEKICK_MODEL_FALLBACKS)
  const fallbacks = (custom.length ? custom : (FALLBACKS[model] ?? [])).filter((m) => m !== model)
  return {
    model,
    fallbacks,
    providerOptions: { gateway: { models: fallbacks } },
    source,
    ...(rejected ? { rejected } : {}),
  }
}

/**
 * The Gateway reports the dollar cost of a call in `providerMetadata.gateway.cost`
 * (a decimal string). Multi-step results carry one per step; sum them. Null
 * when no step carried a cost (direct provider, or a mocked call), so a run
 * can tell "free" from "unknown".
 */
type MetaCarrier = { providerMetadata?: Record<string, Record<string, unknown> | undefined> | undefined }

const costOf = (meta: MetaCarrier['providerMetadata']): number | null => {
  const raw = meta?.gateway?.cost
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw)
  return null
}

export function costFromResult(result: MetaCarrier & { steps?: ReadonlyArray<MetaCarrier> }): number | null {
  const steps = result.steps ?? []
  if (steps.length) {
    const costs = steps.map((s) => costOf(s.providerMetadata)).filter((c): c is number => c !== null)
    if (costs.length) return costs.reduce((a, b) => a + b, 0)
  }
  return costOf(result.providerMetadata)
}
