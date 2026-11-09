# @sitekick/agents

The agent kit of Sitekick CMS: durable runs, proposals with receipts, verifiers,
model selection through Vercel AI Gateway, and two reference agents (Enrich,
Draft) plus inline field actions. Agents propose, people approve (D6): nothing
an agent finds reaches a record without a receipt and, unless the collection's
contract says otherwise, an editor's click.

Phase 1 writes to the `proposals` and `runs` collections that `@sitekick/cms`
ships; the shared shape is `docs/REVIEW-SPEC.md`.

## Architecture

```
admin button ──▶ POST /api/agents/enqueue ──▶ runs row (queued)
                                              │
                      Runner.run(def, input, ctx)   ◀── aiSdkRunner | eveRunner (stub)
                                              │
      tools: web_search · fetch_page (receipt) · propose · finish
                                              │
                 verifiers (excerptPresent, claimsSupported, lengthWithin, urlAlive)
                                              │
       agent contract (custom.sitekick.agent: writable / fillEmptyOnly / review)
                                              │
                               proposals row (open) ──▶ review inbox
```

| Module | What it does |
|---|---|
| `src/model.ts` | `resolveModel({ purpose, override, env })`: defaults per purpose (`actions`, `research`: `anthropic/claude-sonnet-5-5`; `judge`: `anthropic/claude-opus-5-5`), env overrides, allowlist, Gateway fallback chain in `providerOptions.gateway.models`. `costFromResult()` reads `providerMetadata.gateway.cost` (sums steps) or returns `null`. |
| `src/receipts.ts` | `fetchWithReceipt(url, opts)`: public http(s) only, private ranges refused on every hop (DNS-checked), redirect and size caps, Internet Archive fallback on failure/4xx/5xx. Returns `{ receipt: { url, fetchedAt, sha256, excerpt, title }, text, html?, status, archived? }`. `excerptFor(text, quote)`, `htmlToText`, `syntheticReceipt('notes', text)`. |
| `src/verifiers.ts` | `urlAlive`, `excerptPresent(receipt, text)`, `lengthWithin`, `claimsSupported({ bio, receipts, judge })` (LLM judge via `generateObject`, sentence by sentence), `runVerifiers(patch, checks)` drops failing fields and keeps the reason. |
| `src/proposals.ts` | `createProposal(payload, …)`: applies the contract (`filterPatchByContract`, pure), writes `review: 'none'` + `fillEmptyOnly` fields directly, supersedes open proposals for the same target, writes the row with `overrideAccess: true` and `context: { sitekickAgent }`. |
| `src/runs.ts` | `startRun`, `claimRun` (conditional lease), `updateRun` (stage / now / steps), `askEditor` (question + poll), `finishRun`, `failRun`, `cancelRun`, `canTransition`, kill switch `SITEKICK_AGENTS_DISABLED`. |
| `src/runner.ts` | The `Runner` interface and `aiSdkRunner()`: a `generateText` tool loop with `stopWhen: [stepCountIs(n), finishCalled]`, every tool call logged to `runs.steps`, cost tallied per step and the loop aborted over `maxCostUsd`. |
| `src/agents/enrich.ts` | Enrich agent. `src/agents/draft.ts`: Draft agent. `src/lexical.ts`: `markdownToLexical()`. `src/fields.ts`: field-name heuristics. `src/search.ts`: web search tool. |
| `src/actions.ts` | `altText`, `seo`, `rewrite`, `shorten`, `translate`: instant, each logged to `proposals` as an accepted `field-action` row. |
| `src/http.ts` | `createAgentRoutes({ payload })` → `{ enqueue, action, status, handle }` Web-standard handlers. |
| `src/admin.ts` (`@sitekick/agents/admin`) | Browser helpers `requestAgent`, `runAction`, `runStatus`. No React. |
| `src/adapters/workflow.ts` (`@sitekick/agents/workflow`) | Vercel Workflow loop sketch, behind the optional `workflow` peer. |
| `src/adapters/eve.ts` (`@sitekick/agents/eve`) | `eveRunner()` stub (see below). |

## The Runner interface

```ts
type AgentDefinition<Input> = {
  id: string                      // 'enrich@1'
  description: string
  instructions: string | ((input, ctx) => string)
  tools: Record<string, Tool> | ((ctx: RunContext, input: Input) => Record<string, Tool>)
  model: 'actions' | 'research' | 'judge'
  limits: { maxSteps: number; maxCostUsd: number }
  prompt?: (input, ctx) => string // default: JSON of the input
  finishTools?: string[]          // default ['finish']
}
type RunContext = { payload: AgentPayload; run: string | number; target?: { collection; id? }; log(step): Promise<void>; model?: string; signal?: AbortSignal }
type RunResult = { text; costUsd: number | null; steps; finishReason; finished: boolean; model }
type Runner = { name: string; run<I>(def: AgentDefinition<I>, input: I, ctx: RunContext): Promise<RunResult> }
```

Tools are AI SDK `tool({ inputSchema, execute })` definitions and may close over
per-run state (that is why `tools` can be a factory). The runner wraps each
`execute` so the call lands in `runs.steps` and a thrown error goes back to the
model as `{ error }` instead of ending the loop.

`aiSdkRunner({ generate })` takes an optional `generate` for tests; production
uses `generateText` from `ai`.

## Wiring the playground

`apps/playground/src/app/api/agents/[op]/route.ts`:

```ts
import config from '@payload-config'
import { createAgentRoutes } from '@sitekick/agents'
import { getPayload } from 'payload'

const routes = (async () => createAgentRoutes({ payload: await getPayload({ config }) }))()

const handler = async (req: Request, { params }: { params: Promise<{ op: string }> }) => (await routes).handle(req, (await params).op)

export const maxDuration = 300
export const POST = handler
export const GET = handler
```

The admin buttons (Find details, Draft from notes, Describe image, Write with AI) come from
`@sitekick/cms`: pass `agents: { basePath: '/api/agents' }` to `sitekickCMS()` and list
`actions: ['enrich']` or `['draft']` in a collection's agent contract.

To try the agents against a live model without the admin, `bun scripts/agents-live.ts
[rewrite|enrich|draft]` in the playground (needs `vercel env pull` for the Gateway's OIDC
token; writes runs and proposals, never documents).

Handlers (all take a Web `Request`, return a `Response`, JSON bodies):

| Op | Method | Body / query | Response |
|---|---|---|---|
| `enqueue` | POST | `{ agent: 'enrich', input: { targetCollection, targetId } }` or `{ agent: 'draft', input: { targetCollection, notes?, url?, transcript?, title? } }` | `202 { runId }` |
| `action` | POST | `{ action: 'altText', input: { mediaId, collection? } }` · `{ action: 'seo', input: { collection, id } }` · `{ action: 'rewrite', input: { text, instruction, target? } }` · `{ action: 'shorten', input: { text, maxChars?, target? } }` · `{ action: 'translate', input: { text, to, target? } }` (`target = { collection, id?, field }`) | `200 { value, costUsd, proposalId }` |
| `status` | GET | `?run=<id>` | `200 { id, title, kind, status, stage, now, steps, question, costUsd, proposal, error, updatedAt }` |

Auth is Payload's session: `payload.auth({ headers })` must return a user, else
`401`. `503` when the kill switch is on. `enqueue` creates the run, answers,
then runs the agent in the background: `waitUntil` from `@vercel/functions`
when the app has it installed (the playground does), else fire-and-forget. A
single Vercel function invocation is the limit of that path; for runs that must
survive a redeploy or outlive one function, use the workflow adapter.

From the browser (`@sitekick/agents/admin`):

```ts
import { requestAgent, runAction, runStatus } from '@sitekick/agents/admin'
const { runId } = await requestAgent({ agent: 'enrich', input: { targetCollection: 'people', targetId } })
const run = await runStatus(runId)
const { value } = await runAction({ action: 'altText', input: { mediaId } })
```

### Local API (scripts, tests, a Payload job)

```ts
import { runEnrich, runDraft, altText, seo } from '@sitekick/agents'
import { asAgentPayload } from '@sitekick/agents'

const agentPayload = asAgentPayload(payload)

// Enrich a person
await runEnrich(agentPayload, { targetCollection: 'people', targetId: 42 }, { triggeredBy: user.id })

// Draft a post from a URL and notes
await runDraft(agentPayload, { targetCollection: 'posts', url: 'https://example.org/press', notes: 'Lead with the date.' })

// Field actions
await altText({ payload: agentPayload, mediaId: 7 })
await seo({ payload: agentPayload, collection: 'posts', id: 3 })
```

Both agents return `{ runId, proposalId, dropped, costUsd }`; `proposalId` is
`null` when the contract or the verifiers refused every field (the run still
says why in `now`/`summary`).

## The agent contract

Each collection declares, at `custom.sitekick.agent` (type `AgentContract` in
`@sitekick/cms`):

```ts
{ writable: ['bio', 'social', 'photo'], fillEmptyOnly: ['website'], review: 'required' }
```

- Only `writable` or `fillEmptyOnly` fields can be proposed; others are dropped with "field is not writable by agents".
- `fillEmptyOnly` fields are dropped when the target already has a value.
- Every proposed value needs at least one receipt unless `review === 'none'`.
- `review: 'none'` + `fillEmptyOnly`: written directly (`payload.update`, `context.sitekickAgent`), no proposal.
- No contract, or `custom.sitekick.private`: nothing is proposed.

## Enrich

Input `{ targetCollection, targetId }`. Reads the record, maps its fields to
four slots by name (`website|url|site|homepage`, `bio|description|summary|about`,
`photo|logo|image|avatar|headshot`, `social|socials|socialLinks|profiles`); pass
`fieldMap: { bio: 'about' }` to override per collection. Only slots that map to
a field are offered to the model.

Tools: `web_search`, `fetch_page` (receipt), `propose({ slot, value, sourceUrl, quote })`,
`finish`. `propose` refuses a source that was not fetched in this run and a
quote that is not on the page, so a receipt can only come from read text.
After the loop: `excerptPresent` on every receipt, `lengthWithin` and the
`claimsSupported` judge on the bio, `urlAlive` on the website, then the contract
and `createProposal`.

Image slot: an upload field cannot take a URL, so the proposal's value is
`{ sourceUrl, credit }` with a note; the review side imports it into media on
accept. Social: the whole array
`[{ platform, url }]`.

## Draft

Input `{ targetCollection, notes?, url?, transcript?, title? }`. The URL is
fetched with a receipt; notes and transcript become synthetic receipts
(`{ url: 'notes:' | 'transcript:', … }`). The model calls `finish` with
`{ title, excerpt (≤160), bodyMarkdown, metaTitle (≤60), metaDescription (≤160), coverSearchPhrase }`;
the body goes through `markdownToLexical()` (headings, paragraphs, bold, italic,
code, links, bullet and numbered lists, quotes). Field map: `title`, `excerpt|summary|description`,
`content|body|richText`, `meta.title`, `meta.description`. Always a proposal
without `targetId`; accepting creates the document. The cover phrase is in the
proposal summary.

## Edit with words

Input `{ targetCollection, targetId, instruction }`, e.g. "add a FAQ about parking below
the hero, three questions". The collection needs a top-level blocks field in its
contract's `writable` (`layout` on Pages). The agent reads the latest draft:

- the current sections, numbered, as the model reads them (`rowToModel`: rich text as
  Markdown, uploads and relationships as ids, no row ids or blank values)
- the block catalogue (`describeBlocks`: fields, types, options, limits, descriptions)
- the site's pages for links, and `search_media` for images

It calls `propose_sections` with every section in its new order:
`{ keep: n }`, `{ edit: n, set: { …changed fields } }` or `{ add: { blockType, … } }`.
`applySectionPlan` builds the layout: kept rows byte for byte, edits merged into the
row, additions without an id. Then it validates the layout with the block schemas,
including Payload's own field validators and the blocks field's `validate` (one hero).
Problems go back to the model as `{ retry: true, problems }`; a finish tool that returns
`retry: true` does not end the loop (`wantsRetry` in the runner). Ids must already be on
the page, in the page list, or found by `search_media`. Copy the agent cannot know is
written as a `[placeholder]`, never invented.

The proposal is the whole blocks field with `current` = the layout it worked from, and
the instruction as an `editor:` receipt. A plan that keeps everything in order finishes
the run without a proposal. Accepting is refused (409) if the sections changed since
(see docs/REVIEW-SPEC.md).

## Translate

Input `{ targetCollection, targetId, locale, mode? }` on a site with more than one language
(`config.localization`, the localisation recipe in `@sitekick/cms`). It reads the document in
the default locale and in `locale` with `fallbackLocale: false`, so an untranslated field reads
as empty. Then:

- `translatableFields`: top-level fields holding localised words (text, textarea, rich text,
  inside groups, arrays and blocks too)
- `collectPieces`: every string to translate, in page order. Rich text gives one piece per
  text node, so formatting survives. With `mode: 'missing'` (the default), only pieces that
  are empty in `locale` are collected.
- one model call (purpose `actions`, batches of 120), answered as a JSON object keyed by
  piece number. Missing keys are asked for once more, then the run fails.
- `applyPieces`: the source's structure (row ids, shared values) with the translations in
  place and existing translations kept

The proposal carries `locale`. Each field's `current` is the value in that language, and the
receipt is the original text. The contract is replaced by "every translatable field, review
required": translating adds no facts. Private collections are still refused. A French
proposal only supersedes open French proposals for the same document. Accepting writes with
`locale`, as a draft.

## Field actions

`altText` (vision call on the media URL, ≤125 chars), `seo` (meta title ≤60,
description ≤160 from the document's text), `rewrite`, `shorten`, `translate`.
Each returns `{ value, costUsd, proposalId }` and logs a `proposals` row with
`kind: 'field-action'`, `status: 'accepted'`, `decisions` all `accepted`,
`agent: 'field-action'`, so the audit trail is one table. Pass `target` so the
row names the record and field.

## Models and the Gateway

All calls go through Vercel AI Gateway by passing a model string to the AI SDK.

| Env | Meaning |
|---|---|
| `VERCEL_OIDC_TOKEN` | Provided on Vercel; locally `vercel env pull` writes it to `.env.local`. |
| `AI_GATEWAY_API_KEY` | Alternative to OIDC (CI, a non-Vercel host). |
| `SITEKICK_MODEL_ACTIONS` / `_RESEARCH` / `_JUDGE` | Override a purpose's model. Must be on the allowlist. |
| `SITEKICK_MODEL_ALLOWLIST` | Comma-separated additions to the allowlist. |
| `SITEKICK_MODEL_FALLBACKS` | Comma-separated chain replacing the built-in one. |
| `SITEKICK_AGENTS_DISABLED` | Kill switch: `1`/`true` stops new runs, claims and routes (503). |
| `SITEKICK_SEARCH` | `exa` (default) · `perplexity` · `parallel`: which Gateway-executed search tool. |
| `SITEKICK_SEARCH_URL` | Your own search endpoint (`?q=` → `{ results: [{ title, url, snippet }] }`); replaces the Gateway tool. |

Web search is provider-executed by the Gateway (`gateway.tools.exaSearch` and
friends run server-side for any model with the same credential), so nothing
beyond the Gateway credential is needed. Searches are leads only; `propose`
only accepts pages the agent fetched.

Cost: the Gateway returns `providerMetadata.gateway.cost` per call; the runner
sums it into `runs.costUsd` and checks it against the agent's cost limit. With
bring-your-own-key credentials `cost` is `"0"` and the provider's charge is in
`marketCost`, so the larger of the two counts. Without the Gateway the cost is
`null` ("unknown"), never `0`.

## Durable runs: the workflow adapter

`@sitekick/agents/workflow` sketches the loop that replaced Yimby's sweep cron:

```ts
import { registerPayloadLoader, runAgentWorkflow } from '@sitekick/agents/workflow'
import { start } from 'workflow/api'

registerPayloadLoader(() => getPayload({ config }).then(asAgentPayload))
await start(runAgentWorkflow, [{ agent: 'enrich', input, runId: run.id }])
```

`runAgentWorkflow` is a `'use workflow'` function; `advanceAgentRun` is a
`'use step'` that claims the run (lease), runs the agent, and tells the loop
when to look again (lease expiry + grace, a retry pause). It needs the
`workflow` package and its build plugin in the app; this package lists it as an
optional peer. `askEditor` today polls in-process; a durable wait would replace
the poll with a workflow hook on the run id and resume the agent with the
answer, which is the next step for this adapter.

## eve adapter

`eveRunner()` is a stub that throws `eve adapter not available`. eve 1.0.0-rc.2
is a filesystem-first runtime: an agent is an `agent/` directory (`agent.ts`
with `defineAgent`, `tools/*.ts` with `defineTool`, `hooks/*.ts`), built and
served by `eve dev`, deployed as its own service, with sessions started over
HTTP under a per-request token (Yimby's `civic.<id>.<hmac>`). There is no
in-process "run this definition" call, so the adapter could not fit the
small-mapping budget. The mapping, when it is worth doing:

- `AgentDefinition.instructions` → `agent/instructions.md`; `limits` → `defineAgent({ limits: { maxTokenCostUsdPerSession } })`; `model` → `defineDynamic` on `session.started` from `resolveModel()`.
- Each tool → `defineTool` whose `execute` POSTs to the app's `/api/agents/action` with the session's bound run token, so writes stay app-side and Zod-validated (Yimby's `callApp`).
- `ctx.log` → the `actions.requested` hook posting the "Now:" line; `askEditor` → `defineWorkflowTool` with `ctx.ask`.
- `Runner.run` → start a session over eve's HTTP API, wait for `turn.completed` / `finish`, read the collected patch back from the app.

## Evals

`@sitekick/agents/evals` runs the agents on fixed cases, once per model, and keeps a
ledger, so a model or prompt change is measured against the last run instead of judged by
feel.

```ts
import { draftCase, editCase, runEvals, summarize, formatSummary } from '@sitekick/agents/evals'

const cases = [
  draftCase({
    id: 'draft/closure-notice',
    collections,                                   // the site's sanitized collection configs
    input: { targetCollection: 'posts', notes: 'Closed Nov 27–28. Back Dec 1.' },
    expect: { excerpt: (v) => String(v).length <= 160 || 'excerpt too long', title: /clos/i },
    forbid: ['author'],
    judge: 'States the closed days and reopening correctly; invents nothing.',
  }),
]
const results = await runEvals({ cases, models: ['anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5'], ledger: 'evals/ledger.jsonl' })
console.log(formatSummary(summarize(results)))
```

- **Isolation.** Each case runs on its own in-memory Payload (the test stub), seeded with
  the case's documents and given the site's real collection configs and agent contracts.
  That stands in for a database branch per model: nothing is written anywhere.
- **Grading.** `expect` checks proposed values exactly: a value, a RegExp, or a function
  returning `true` or the reason it failed. Nested paths such as `meta.title` work. `forbid`
  lists fields that must not be proposed. `judge` is a rubric for an LLM judge (the `judge`
  model, Claude Opus by default) that scores 1 to 5 with a reason. A case passes when every
  check passes and the judge gives 4 or more.
- **Ledger.** Each result is a JSONL line: case, model, pass, checks, judge score and reason,
  cost (agent plus judge), time and git commit. `summarize` gives each model's pass count,
  mean score, cost and mean time.
- `draftCase`, `enrichCase` and `editCase` wrap the three agents. A custom case supplies
  its own `run(payload, { model, runner })`.

A site runs its suite with `bun run evals` (playground: `scripts/evals.ts` and
`evals/cases.ts`; new sites get both from the CLI). Enrich cases fetch the live web, so the
playground suite leaves them out to stay repeatable.

## Tests

`bun test src` (no network, `ai` never called). Coverage: receipts guard
(private IPs, localhost, schemes, redirects, size cap), sha256 stability,
archive fallback, excerpts; `markdownToLexical` fixtures; contract filtering
(writable, fillEmptyOnly, missing receipt, review none, supersede); verifiers;
run status machine, lease claim, askEditor; model resolution, allowlist and
cost; the runner's instrumentation and cost abort; Enrich and Draft end to end
against an in-memory Payload stub with a scripted runner; HTTP auth, validation,
enqueue, kill switch; field actions; the evals harness (grading, isolation, ledger,
summary) with a scripted runner and judge.
