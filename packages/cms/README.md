# @sitekick/cms

The Sitekick CMS plugin for Payload 4. See `/docs/PLAN.md` section 4.

## Layout

```
src/
  index.ts          public API: sitekickCMS(), types
  plugin.ts         composes the sub-plugins in order
  types.ts          SitekickCMSOptions, NavArrangement, AgentContract
  conventions/      field walkers and hooks applied to every collection (one Plugin per file)
  fields/           field builders for client configs: externalLink(), emailField(), displayOnly()...
  hooks/            reusable collection hooks: autoSlug, publishedAt, preserveEditorChanges...
  access/           role helpers
  auth/             users collection augmentation, invites
  admin/            every admin component, re-exported from admin/index.ts
  theme/            theme.css (tokens), admin.css (polish, EXCEPTION-marked)
  help/             help-articles collection and the drawer
  nav/              sidebar arrangement engine
  dashboard/        home view
```

## Rules

- Every admin component is referenced by import-map path `@sitekick/cms/admin#<Name>` and
  must be exported from `src/admin/index.ts`. Client components start with `'use client'`.
- Use only `payload` and `@payloadcms/ui` public exports. No Payload class names in TSX.
- CSS that targets a Payload class name carries a `/* EXCEPTION: <why> */` comment on the rule.
- Nothing client-specific: no YIMBY, no chapters, no civic data. Names come from
  `options.site`.
- Each module exports a `Plugin` factory `(options: SitekickCMSOptions) => Plugin`. The order
  is decided in `plugin.ts`.
