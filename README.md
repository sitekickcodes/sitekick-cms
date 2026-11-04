# Sitekick CMS

The version of [Payload](https://payloadcms.com) that Sitekick installs on day one of every
client project: world-class editor UX, agent-ready from the first commit, and AI workflows as
part of the product.

Status: phase 2, first beta (`0.1.0-beta.0`). Read [`docs/PLAN.md`](docs/PLAN.md) first, then
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

## Start a site

```sh
bunx create-sitekick-cms my-site
```

## Releasing

All four packages share one version. Bump `version` in each `packages/*/package.json`, then:

```sh
bun run pack                       # compiles to dist and writes tarballs to .pack/
bun scripts/pack.ts --out /tmp/x   # or somewhere else
```

To try a release before publishing, point the CLI at the tarballs:

```sh
node packages/create-sitekick-cms/.pack/dist/index.js /tmp/try --packages .pack
```

Publish each tarball with `npm publish .pack/<file>.tgz --tag beta` (an npm account in the
`sitekick` org).

In the monorepo the packages export TypeScript source and the playground transpiles it. The
published packages are compiled ESM with declarations, so client apps and Payload's CLI need no
special config.

## Stack

Payload 4 · Next.js 16 · Neon Postgres · Vercel (Blob, Workflow, AI Gateway) · Tailwind 4 +
shadcn · Bun · Turborepo.

## License

MIT.
