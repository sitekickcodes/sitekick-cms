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

## Agent buttons

Off unless the host passes `agents: { basePath: '/api/agents' }` and mounts
`createAgentRoutes` from `@sitekick/agents` there. Placement comes from each collection's
contract (`agent/ui.ts`):

| Contract / field | Admin |
|---|---|
| `custom.sitekick.agent.actions: ['enrich']` | "Find details" in the edit view's document controls (saved, unmodified documents) |
| `custom.sitekick.agent.actions: ['draft']` | "Draft from notes" beside Create new; `?draft=1` opens it; a ⌘K command links there |
| upload collection, top-level `alt` text field | "Describe image" under the field |
| SEO tab (seo convention) | "Write with AI" in the overview |

Whole-document agents open the run, which links to the proposal; field actions fill the
form in place and the editor saves. Client components read `admin.custom.sitekick.agents`.
