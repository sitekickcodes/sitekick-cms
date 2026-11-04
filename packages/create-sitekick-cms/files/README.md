# Sitekick CMS site

Payload 4 and Next.js 16 with the Sitekick CMS packages: the admin shell and review inbox
(`@sitekick/cms`), the block library (`@sitekick/blocks`) and the agent kit (`@sitekick/agents`).
Made with `create-sitekick-cms`.

## Run it

1. Put a Postgres connection string in `.env` as `DATABASE_URL` (a Neon branch works well).
2. `bun run migrate` creates the tables.
3. `bun run dev`, then open http://localhost:3000/admin and create the first user.

Agents (Find details, Draft from notes, Edit with words, field actions) call models through
Vercel AI Gateway. Link the project (`bunx vercel link`) and run `bunx vercel env pull .env.local`
to give local dev the project's OIDC token.

## Email

Invites and password resets go through [Resend](https://resend.com). Set `RESEND_API_KEY` and
`EMAIL_FROM` (an address on a domain you've verified in Resend, e.g. `Acme <hello@acme.com>`).
Until then nothing is emailed: inviting someone shows you their set-password link to send
yourself, and in development the full message is printed in the server log.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/site.ts` | Site name, description, URL and brand colour |
| `src/payload.config.ts` | Collections, sidebar arrangement, storage, plugins |
| `src/collections/` | Pages (blocks), Posts, Media, Users, and People if you kept it |
| `src/app/(frontend)/` | The public site; `globals.css` holds its design tokens |
| `src/app/(payload)/custom.css` | Admin theme overrides |
| `DESIGN.md` | The visual rules the blocks and pages follow |
| `src/migrations/` | Database migrations; `bun run migrate:create <name>` after schema changes |

## Changing the schema

Edit a collection, then:

```sh
bun run generate:types
bun run generate:importmap   # when admin components change
bun run migrate:create describe-the-change
bun run migrate
```

Deploys run `bun run vercel-build`, which migrates before building.

## Upgrading

Bump `@sitekick/cms`, `@sitekick/blocks` and `@sitekick/agents` together, then regenerate the
import map. Release notes: https://github.com/sitekickcodes/sitekick-cms
