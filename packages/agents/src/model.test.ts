import { describe, expect, test } from 'bun:test'

import { DEFAULT_MODELS, costFromResult, resolveModel } from './model'

describe('resolveModel', () => {
  test('defaults per purpose, with a gateway fallback chain', () => {
    const r = resolveModel({ purpose: 'judge', env: {} })
    expect(r.model).toBe(DEFAULT_MODELS.judge)
    expect(r.source).toBe('default')
    expect(r.providerOptions.gateway.models).toEqual(r.fallbacks)
    expect(r.fallbacks).not.toContain(r.model)
  })
  test('env override wins when allowlisted', () => {
    const r = resolveModel({ purpose: 'actions', env: { SITEKICK_MODEL_ACTIONS: 'anthropic/claude-haiku-5-5' } })
    expect(r.model).toBe('anthropic/claude-haiku-5-5')
    expect(r.source).toBe('env')
  })
  test('explicit override beats env', () => {
    const r = resolveModel({ purpose: 'actions', override: 'openai/gpt-6-mini', env: { SITEKICK_MODEL_ACTIONS: 'anthropic/claude-haiku-5-5' } })
    expect(r.model).toBe('openai/gpt-6-mini')
    expect(r.source).toBe('override')
  })
  test('a model outside the allowlist falls back to the default and is reported', () => {
    const r = resolveModel({ purpose: 'research', override: 'someone/mystery-9000', env: {} })
    expect(r.model).toBe(DEFAULT_MODELS.research)
    expect(r.rejected).toBe('someone/mystery-9000')
  })
  test('SITEKICK_MODEL_ALLOWLIST extends the allowlist; SITEKICK_MODEL_FALLBACKS replaces the chain', () => {
    const r = resolveModel({ purpose: 'research', override: 'acme/custom', env: { SITEKICK_MODEL_ALLOWLIST: 'acme/custom', SITEKICK_MODEL_FALLBACKS: 'anthropic/claude-haiku-5-5' } })
    expect(r.model).toBe('acme/custom')
    expect(r.fallbacks).toEqual(['anthropic/claude-haiku-5-5'])
  })
})

describe('costFromResult', () => {
  test('sums gateway cost strings across steps', () => {
    expect(costFromResult({ steps: [{ providerMetadata: { gateway: { cost: '0.0012' } } }, { providerMetadata: { gateway: { cost: 0.002 } } }] })).toBeCloseTo(0.0032, 6)
  })
  test('falls back to the top-level metadata, else null', () => {
    expect(costFromResult({ providerMetadata: { gateway: { cost: '0.5' } } })).toBe(0.5)
    expect(costFromResult({ providerMetadata: { anthropic: { cacheCreationInputTokens: 1 } } })).toBeNull()
    expect(costFromResult({})).toBeNull()
  })
})
