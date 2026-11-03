# Sitekick CMS

The version of [Payload](https://payloadcms.com) that Sitekick installs on day one of every
client project: world-class editor UX, agent-ready from the first commit, and AI workflows as
part of the product.

Status: phase 1 prototype. Read [`docs/PLAN.md`](docs/PLAN.md) first, then
[`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/REVIEW-SPEC.md`](docs/REVIEW-SPEC.md) and
[`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md). Demo: https://sitekick-cms-playground.vercel.app

## What it is

- `@sitekick/cms` — a Payload 4 plugin. One line in `payload.config.ts` gives you the Sitekick
  admin shell (sidebar, home, command palette, inbox, help), the editing conventions (slugs,
  SEO, link fields, row labels), a theme, invites, an agent contract per collection, MCP, and
  a review inbox for agent proposals.
- `@sitekick/blocks` — block schemas and React renderers on Tailwind + shadcn, with live
  preview.
- `@sitekick/agents` — the agent kit: durable runs on Vercel Workflow, proposals with
  receipts, verifiers, AI Gateway model selection, an eve adapter, and an eval harness.
- `create-sitekick-cms` — generates a client app from the playground.
- `apps/playground` — the demo client site used to build and test everything, deployed on
  Vercel + Neon.

## Stack

Payload 4 · Next.js 16 · Neon Postgres · Vercel (Blob, Workflow, AI Gateway) · Tailwind 4 +
shadcn · Bun · Turborepo.

## License

MIT.
