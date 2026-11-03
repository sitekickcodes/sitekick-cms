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

**Known gap (2026-11-03):** the Neon marketplace resource was created with the Vercel
"development" environment pointing at the **same branch as production**. Until a `dev`
branch is created in the Neon dashboard (Branches → New branch from `main`) and the
development env vars are switched to it in the integration's settings, a local
`bun run migrate` or seed writes to production. The playground has no real content, so this
is tolerable today and must be fixed before any client project copies this setup.

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
branch; previews get their own branch; local dev pulls the development environment.
