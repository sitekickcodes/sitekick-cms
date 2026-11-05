Sitekick CMS is how Sitekick builds client websites: [Payload 4](https://payloadcms.com) and
Next.js 16, with an admin that non-technical editors find calm, and agents that do the
tedious parts of content work without ever publishing on their own.

It is three packages and a CLI:

| Package | What it is |
| --- | --- |
| `@sitekick/cms` | A Payload plugin. One call in `payload.config.ts` gives the admin its sidebar, home, command palette, list polish, board view, invites, help drawer, automatic SEO and the review inbox. |
| `@sitekick/blocks` | The page builder: eight section blocks, one rich-text editor, and React renderers styled by design tokens. |
| `@sitekick/agents` | The agent kit: durable runs, proposals with receipts, verifiers, model selection through Vercel AI Gateway, the Draft, Edit and Enrich agents, and an evals harness. |
| `create-sitekick-cms` | `bunx create-sitekick-cms my-site` makes a new client site from all of the above. |

## What it believes

- **Editors first.** Every screen is written for someone who edits a website a few times a
  month. Plain words, no jargon, nothing that can lose their work.
- **Agents propose, people decide.** An agent never writes a live record. It proposes a
  change with the sources it used, and an editor accepts or rejects each field. Nothing goes
  live until they do.
- **One Payload per client.** Each client has its own Vercel project, Postgres database and
  domain. They own their stack at handoff.
- **Conventions, not configuration.** Slugs, SEO, row labels, relationship cells and image
  previews work on every collection without per-collection wiring.

## Where to go next

- [Getting started](./getting-started.md): create a site and deploy it.
- [The admin](./editing.md): what editors get.
- [Agents](./agents.md): what the agents do and how review works.
- [Configuration](./configuration.md): every option.
