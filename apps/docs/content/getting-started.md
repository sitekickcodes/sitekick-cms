## Create a site

You need [Bun](https://bun.sh) and Node 24.

```sh
bunx create-sitekick-cms my-site
```

It asks for the site's name, one sentence about it, a brand colour, and whether to include
the People collection (team, authors, partners). Then it installs everything, generates the
types, the admin import map and the first database migration, and makes the first commit.
`--yes` takes the defaults; `--help` lists every option.

The new site has Pages (built from sections), News, optionally People, a Library for images,
Site settings, and a starter frontend that renders all of it.

## Run it

Set `DATABASE_URL` in `.env` to a Postgres database. A [Neon](https://neon.tech) branch works
well. Then:

```sh
cd my-site
bun run migrate   # create the tables
bun run dev       # http://localhost:3000/admin
```

The first visit to `/admin` asks you to create the first user, who becomes an admin.

## Deploy on Vercel

```sh
bunx vercel link                       # create the project
bunx vercel integration add neon       # Postgres; sets DATABASE_URL
bunx vercel blob store add media       # image storage; sets BLOB_READ_WRITE_TOKEN
bunx vercel env add PAYLOAD_SECRET     # copy it from .env
bunx vercel env add AUTOSEND_API_KEY   # and EMAIL_FROM, so invites are emailed
bunx vercel --prod
```

Each deploy runs the migrations before it builds. The agents call models through Vercel AI
Gateway with the project's own credentials, so there are no model API keys to manage. To use
them locally, run `bunx vercel env pull .env.local` after linking.

## Environment

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Postgres. The Neon integration sets it on Vercel. |
| `PAYLOAD_SECRET` | Signs sessions and API keys. The deployed site needs the same value as `.env`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for images. Without it, images are stored on local disk (development only). |
| `AUTOSEND_API_KEY`, `EMAIL_FROM` | Account email. See [Email](./email.md). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. See [Google sign-in](./recipes/google-sign-in.md). |
| `SITEKICK_AI_BUDGET_USD` | Optional monthly AI budget shown on the AI usage page. |
| `SITEKICK_MODEL_ACTIONS`, `SITEKICK_MODEL_RESEARCH`, `SITEKICK_MODEL_JUDGE` | Optional model overrides, limited to an allowlist. See [Agents](./agents.md#models-and-cost). |
| `SITEKICK_AGENTS_DISABLED` | Set to turn every agent off at once. |
| `NEXT_PUBLIC_SERVER_URL` | The public URL. Blank uses the Vercel production URL, or `http://localhost:3000`. |

## Changing the schema

Collections live in `src/collections`. After changing one:

```sh
bun run generate:types
bun run migrate:create describe-the-change
```

Commit the migration with the change. The deploy applies it.
