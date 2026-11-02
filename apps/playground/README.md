# playground

The Sitekick CMS demo client site ("Demo Co."). It is the test server for the plugin, the UX
lab, and the source the CLI generates client apps from.

- Admin: `/admin`. Frontend: `/`, `/news`, `/<page-slug>`.
- `bun run dev` (port 3100). Env comes from `bun x vercel env pull .env.local`.
- Schema changes: `bun run migrate:create <name>`, review the SQL, `bun run migrate`.
- Admin components changed: `bun run generate:importmap`. Fields changed: `bun run generate:types`.

Deployed on Vercel (project `sitekick-cms-playground`, team Sitekick) with Neon Postgres and
Vercel Blob provisioned through the marketplace.
