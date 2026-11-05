Agents do the tedious parts of content work: drafting a post from notes, rearranging a page
from a sentence, filling in someone's profile from the web. They never publish and never
change a live record on their own. Each one ends in a **proposal**: the change it would
make, field by field, with the sources it used. An editor accepts or rejects each field.

## In the admin

| Button | Where | What it does |
| --- | --- | --- |
| Draft from notes | Beside Create New | Paste notes, a link or both. The agent writes a draft (title, excerpt, body, search details) using only what you gave it. Accepting creates the document as a draft. |
| Edit with words | On a saved page | Describe the change: "add an FAQ about parking below the hero". The agent proposes the page's sections in their new order. |
| Find details | On a saved record | Searches the web for a person's or organisation's website, bio, photo and social links, and quotes the page each value came from. |
| Describe image | On an image's alt text | Writes alt text from the image. |
| Write search details | On a document | Writes the search title and description from the content. |

The single-field actions (Describe image, Write search details) fill in the field at once and
are logged. The whole-document agents run in the background. A run page shows each step as
it happens ("Searching the web for…", "Reading example.org") and its cost, and asks the
editor a question if it needs one.

## Review

Proposals land in the **Inbox** in the sidebar, with a count. A proposal shows each field
before and after, with the quotes and links behind every value. Accept or reject each one,
or all at once. A proposal for a page that changed since the agent read it can't be
accepted, so nobody overwrites newer work by accident. Proposals can also be previewed on
the real site before accepting.

## What agents may touch

Each collection declares it, in `custom.sitekick.agent`:

```ts
agent: {
  description: 'A person on the team page.',
  writable: ['bio', 'social', 'photo'],   // may be proposed
  fillEmptyOnly: ['website'],             // only when empty
  review: 'required',                     // 'optional' or 'none'
  actions: ['enrich'],                    // which buttons appear: enrich, draft, edit
  notes: 'Bios are third person, under 80 words.',
}
```

Anything not listed is read-only to agents. Every proposed value needs a source unless
`review` is `'none'`. A collection with no contract, or marked `private`, is invisible to
agents.

## Edit with words

The agent reads the page as an editor would: the current sections, the section types and
their limits, the site's other pages (for links) and the image library. It answers with
every section in order: keep this one, change these fields of that one, add a new one here.
The result is checked against the block rules, such as one hero and required fields, and
sent back to the agent to fix if needed. Facts it can't know are written as
`[placeholders]` for the editor to fill in, never invented.

## Models and cost

Every model call goes through [Vercel AI Gateway](https://vercel.com/ai-gateway), using the
project's own credential, so there are no provider keys to manage. Defaults are Claude
Sonnet 5.5 for in-admin work and Claude Opus 5.5 as the judge. A site can choose others with
`SITEKICK_MODEL_ACTIONS`, `SITEKICK_MODEL_RESEARCH` and `SITEKICK_MODEL_JUDGE`, but only from
an allowlist, so a typo can't pick an expensive or untested model. If a model is down, the
Gateway falls back down a chain.

Each agent has a step limit and a cost limit, and stops when either is reached. Every run
records what it cost. Admins see the totals under **AI usage**; see
[Evals and cost](./evals-and-cost.md). `SITEKICK_AGENTS_DISABLED=1` turns every agent off at
once.

## For AI clients outside the admin

Each site also publishes a **public, read-only** surface for AI assistants and search:
`/llms.txt`, an OpenAPI document at `/openapi.json`, a Markdown version of every page under
`/md/`, and an MCP server at `/mcp`. It only reads published content, and only from
collections that aren't private.

Editors can connect their own AI tools to the admin through Payload's MCP plugin with an API
key. Those connections respect the same agent contracts.

The full API is in [@sitekick/agents](/reference/agents).
