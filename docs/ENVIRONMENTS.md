# Environments

How the playground is hosted, and the convention every client project follows.

## Playground

| Thing | Where |
|---|---|
| Vercel project | `sitekick-cms-playground` on the Sitekick team, root directory `apps/playground`, Node 24, Fluid compute |
| Git | Connected to `sitekickcodes/sitekick-cms`. Pushes to `main` deploy production; other branches get previews |
| Database | Neon through the Vercel marketplace (resource `sitekick-cms-playground`, free plan). The integration sets `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `PG*`/`POSTGRES_*` per environment and creates a `preview/<branch>` Neon branch per preview deployment |
| Media | Vercel Blob store `sitekick-cms-playground` (public, iad1). `BLOB_READ_WRITE_TOKEN` is set by the store link |
| Secrets | `PAYLOAD_SECRET` on production, preview and development |

## Local development

```sh
bun install
cd apps/playground
bun x vercel env pull .env.local        # development env: blob token, secret, DATABASE_URL
bun run dev                              # http://localhost:3100, admin at /admin
```

**Local development uses the Neon `dev` branch** (created 2026-11-09 from `main`; endpoint
`ep-dawn-block-…`). The Vercel integration shares one set of database variables across
Production, Preview and Development, so `vercel env pull` alone would point local work at
production. `.env.development.local` overrides them: Next, the Payload CLI and Bun all read it
before `.env.local`, `vercel env pull` never touches it, and it's gitignored. `next dev` lists
it first under "Environments". To set it up on a new machine:

```sh
neonctl connection-string dev --project-id <NEON_PROJECT_ID> --pooled   # DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL
neonctl connection-string dev --project-id <NEON_PROJECT_ID>            # DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING
```

and put them in `apps/playground/.env.development.local`, with `PGHOST`/`PGHOST_UNPOOLED` set
to their hosts. Migrations made locally run on `dev`; production gets them from
`vercel-build` on deploy. To start `dev` over from production's content, use **Reset from
parent** on the branch in the Neon console.

Schema changes: edit a collection, then `bun run migrate:create <name>`, read the SQL,
`bun run migrate`. Migrations run over the unpooled connection (`scripts/migrate.ts`).
Admin components added or removed: `bun run generate:importmap` (runtime generation is off).
Fields changed: `bun run generate:types`.

## Deploy

`vercel.json` sets `buildCommand: bun run vercel-build`, which runs migrate, generate
importmap, then `payload build`. Install runs at the monorepo root with a frozen lockfile.

## Convention for client projects

One Vercel project, one Neon project and one Blob store per client, provisioned the same
way (`vercel integration add neon`, `vercel blob create-store`). Production is Neon's default
branch; previews get their own branch; local dev uses a `dev` branch through
`.env.development.local` (see Local development).
