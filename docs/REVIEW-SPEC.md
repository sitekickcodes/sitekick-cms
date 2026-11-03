# Proposals and runs — shared shape

The contract between `@sitekick/cms` (which ships the collections and the review UI) and
`@sitekick/agents` (which writes to them). Both sides code against this file. Phase 1.

## Collection `proposals` (slug `proposals`, group "Inbox")

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | Human label, e.g. "Enrich: Jane Doe" |
| `kind` | select `enrich \| draft \| edit \| field-action` | |
| `status` | select `open \| accepted \| partial \| rejected \| superseded`, default `open` | |
| `targetCollection` | text, required | Collection slug |
| `targetId` | text | Document id. Empty when the proposal creates a new document (Draft agent) |
| `patch` | json, required | `Record<fieldPath, ProposedField>` (below) |
| `decisions` | json | `Record<fieldPath, 'accepted' \| 'rejected'>`, written by the review UI |
| `summary` | textarea | One paragraph from the agent: what it found, what it could not |
| `run` | relationship → `runs` | |
| `agent` | text | Agent id, e.g. `enrich@1` |
| `reviewedBy` | relationship → users | |
| `reviewedAt` | date | |

```ts
type ProposedField = {
  value: unknown                      // the full proposed value for that field path
  current?: unknown                   // snapshot of the value when proposed (for the diff)
  receipts?: Receipt[]                // provenance; required unless the agent contract says review: 'none'
  note?: string                       // one line: why this value
}
type Receipt = { url: string; fetchedAt: string; sha256: string; excerpt: string; title?: string }
```

Accepting a field writes `{ [path]: value }` through `payload.update` with the reviewing
editor's `req` (so versions, hooks and authorship behave as for a human) and
`context: { sitekickAgent: 'review' }` so the outbox hooks do not re-enqueue. When every
accepted/rejected decision is in, status becomes `accepted` (all accepted), `partial` or
`rejected`. A new proposal for the same target supersedes open ones for it.

## Collection `runs` (slug `runs`, group "Inbox")

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | e.g. "Enrich: Jane Doe" |
| `kind` | text, required | Agent id |
| `status` | select `queued \| running \| waiting \| done \| failed \| cancelled`, default `queued` | `waiting` = a question for the editor is open |
| `targetCollection` | text | |
| `targetId` | text | |
| `input` | json | What triggered it (notes, URL, options) |
| `stage` | text | Short current stage, e.g. "Reading the website" |
| `now` | text | The "Now:" activity line, updated often |
| `steps` | json | `Array<{ label: string; status: 'running' \| 'done' \| 'failed' \| 'skipped'; detail?: string; at: string }>` |
| `question` | json | `{ text: string; options: string[] } \| null` |
| `answer` | text | The editor's answer |
| `costUsd` | number | |
| `attempts` | number, default 0 | |
| `leaseUntil` | date | |
| `session` | text | Adapter session id |
| `model` | text | |
| `error` | textarea | |
| `triggeredBy` | relationship → users | |
| `proposal` | relationship → proposals | Set when the run produced one |

## Inbox view

`/admin/inbox` lists open proposals and runs that are queued, running or waiting. Sidebar
link `view:inbox` with a badge = open proposals + waiting runs. Both collections stay
visible under "More" too.

## Hook loop guard

Any write made by an agent or the review UI passes `context.sitekickAgent` (a string naming
who wrote). Outbox hooks skip when it is set.
