import { generateText, stepCountIs } from 'ai'
import type { StopCondition, Tool, ToolSet } from 'ai'

import { costFromResult, resolveModel } from './model'
import type { ModelPurpose } from './model'
import type { AgentPayload } from './payload'
import type { RunStep } from './runs'

/**
 * The runner interface. An agent is a definition (instructions, tools,
 * limits, which model purpose); a runner executes it against a run row.
 * Two adapters ship: `aiSdkRunner` (a generateText tool loop, no extra
 * infrastructure) and `eveRunner` (adapters/eve.ts). Keeping the surface
 * this small is what lets eve stay optional (D5).
 */
export type RunContext = {
  payload: AgentPayload
  /** The `runs` document id. */
  run: string | number
  target?: { collection: string; id?: string | number }
  /** Append a step to the run (and update the "Now:" line). */
  log(step: Omit<RunStep, 'at'> & { at?: string }): Promise<void>
  /** Optional model override from the request or the client config. */
  model?: string
  signal?: AbortSignal
}

export type AgentDefinition<Input = unknown> = {
  id: string
  description: string
  instructions: string | ((input: Input, ctx: RunContext) => string)
  /** Tools may close over per-run state, hence the factory form. */
  tools: Record<string, Tool> | ((ctx: RunContext, input: Input) => Record<string, Tool>)
  model: ModelPurpose
  limits: { maxSteps: number; maxCostUsd: number }
  /** The user message; defaults to the JSON of the input. */
  prompt?: (input: Input, ctx: RunContext) => string
  /** Tool names that end the loop when called (default: `finish`). */
  finishTools?: string[]
}

export type RunResult = {
  text: string
  costUsd: number | null
  steps: number
  finishReason: string
  /** True when a finish tool was called; false when the step or cost limit ended the loop. */
  finished: boolean
  model: string
}

export type Runner = {
  readonly name: string
  run<Input>(def: AgentDefinition<Input>, input: Input, ctx: RunContext): Promise<RunResult>
}

/** Subset of `generateText` the runner relies on; injectable so tests run without a model. */
export type GenerateFn = (args: {
  model: string
  system: string
  prompt: string
  tools: ToolSet
  stopWhen: StopCondition<ToolSet>[]
  providerOptions: { gateway: { models: string[] } }
  abortSignal?: AbortSignal
  onStepFinish?: (step: { providerMetadata?: Record<string, Record<string, unknown> | undefined> }) => void | Promise<void>
}) => Promise<{
  text: string
  finishReason: string
  steps: ReadonlyArray<{ providerMetadata?: Record<string, Record<string, unknown> | undefined>; toolCalls: ReadonlyArray<{ toolName: string }> }>
  providerMetadata?: Record<string, Record<string, unknown> | undefined>
}>

export class CostLimitError extends Error {
  constructor(public readonly costUsd: number, public readonly limit: number) {
    super(`Run stopped: $${costUsd.toFixed(3)} spent, limit $${limit}`)
    this.name = 'CostLimitError'
  }
}

const toolsOf = <I>(def: AgentDefinition<I>, ctx: RunContext, input: I): Record<string, Tool> =>
  typeof def.tools === 'function' ? def.tools(ctx, input) : def.tools

/**
 * Wrap each tool so every call lands in `runs.steps` with its label, and a
 * thrown error is reported to the model as a result instead of killing the
 * loop (the model can try another source).
 */
export function instrumentTools(tools: Record<string, Tool>, ctx: RunContext): ToolSet {
  const out: ToolSet = {}
  for (const [name, t] of Object.entries(tools)) {
    const original = t.execute
    if (!original) {
      // Provider-executed tools (Gateway search) have no execute; nothing to wrap.
      out[name] = t
      continue
    }
    out[name] = {
      ...t,
      execute: async (input: unknown, options: Parameters<NonNullable<Tool['execute']>>[1]) => {
        const label = labelFor(name, input)
        await ctx.log({ label, status: 'running' })
        try {
          const result = await original(input as never, options)
          await ctx.log({ label, status: 'done' })
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await ctx.log({ label, status: 'failed', detail: message.slice(0, 200) })
          return { error: message }
        }
      },
    } as Tool
  }
  return out
}

/** A step as the editor reads it in the run view: "Read leerob.com", not "fetch_page: …". */
export function labelFor(toolName: string, input: unknown): string {
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : undefined)
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url.slice(0, 60)
    }
  }
  const url = str('url')
  if (toolName === 'web_search' && str('query')) return `Search the web for “${str('query')!.slice(0, 60)}”`
  if (toolName === 'fetch_page' && url) return `Read ${host(url)}`
  if (toolName === 'propose' && str('slot')) return `Propose ${str('slot')}`
  if (toolName === 'finish') return str('result') === 'incomplete' ? 'Wrap up (some details not found)' : 'Wrap up'
  const pretty = toolName.replace(/_/g, ' ')
  const hint = url ? host(url) : (str('query') ?? str('field'))?.slice(0, 60)
  return hint ? `${pretty}: ${hint}` : pretty
}

export function aiSdkRunner({ generate }: { generate?: GenerateFn } = {}): Runner {
  const gen: GenerateFn = generate ?? ((args) => generateText(args))
  return {
    name: 'ai-sdk',
    async run(def, input, ctx) {
      const resolved = resolveModel({ purpose: def.model, override: ctx.model })
      const finishTools = def.finishTools ?? ['finish']
      const controller = new AbortController()
      ctx.signal?.addEventListener('abort', () => controller.abort(ctx.signal?.reason))
      let spent = 0
      let overBudget: CostLimitError | null = null
      const finished: StopCondition<ToolSet> = ({ steps }) => (steps[steps.length - 1]?.toolCalls ?? []).some((c) => finishTools.includes(c.toolName))
      let result: Awaited<ReturnType<GenerateFn>>
      try {
        result = await gen({
          model: resolved.model,
          system: typeof def.instructions === 'function' ? def.instructions(input, ctx) : def.instructions,
          prompt: def.prompt ? def.prompt(input, ctx) : JSON.stringify(input),
          tools: instrumentTools(toolsOf(def, ctx, input), ctx),
          stopWhen: [stepCountIs(def.limits.maxSteps), finished],
          providerOptions: resolved.providerOptions,
          abortSignal: controller.signal,
          onStepFinish: (step) => {
            spent += costFromResult({ providerMetadata: step.providerMetadata }) ?? 0
            if (spent > def.limits.maxCostUsd) {
              // Abort rather than throw: the SDK surfaces throws from callbacks inconsistently.
              overBudget = new CostLimitError(spent, def.limits.maxCostUsd)
              controller.abort(overBudget)
            }
          },
        })
      } catch (err) {
        if (overBudget) throw overBudget
        throw err
      }
      const costUsd = costFromResult(result)
      return {
        text: result.text,
        costUsd: costUsd ?? (spent || null),
        steps: result.steps.length,
        finishReason: result.finishReason,
        finished: result.steps.some((s) => s.toolCalls.some((c) => finishTools.includes(c.toolName))),
        model: resolved.model,
      }
    },
  }
}
