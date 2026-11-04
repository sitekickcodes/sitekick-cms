# create-sitekick-cms

Creates a Sitekick CMS site: Payload 4, Next.js 16, Postgres, and the `@sitekick` packages.

```sh
bunx create-sitekick-cms my-site
```

It asks for the site name, a sentence about it, the brand colour and whether to include the People
collection, then installs, generates types, the admin import map and the first migration, and
commits. Pass `--yes` to take the defaults and `--help` for every option.

The template is the monorepo's playground with the demo data left out, so it always matches the
released packages.
