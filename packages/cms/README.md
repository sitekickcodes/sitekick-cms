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
  lists/            saved views and the board view
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

## Email

Invites and password resets are sent through AutoSend when `AUTOSEND_API_KEY` and `EMAIL_FROM`
(`Acme <hello@acme.com>`, on a domain verified in AutoSend) are set (`email/index.ts`). Until
both are, nothing is sent: invites hand the admin the set-password link to pass on, "Send reset
email" is hidden, and the message is logged (in full in development, recipient only in
production, so tokens stay out of hosted logs). A config that sets its own `email` adapter is
left alone; `email: false` keeps Payload's default.

## Site modules

A client's own features live in its repo (`src/modules/<name>/`) and are handed to
`sitekickCMS({ modules })`, never patched into this package. `defineModule` (`modules/index.ts`)
takes `collections`, `globals`, `fields` (added to existing collections), `blocks` (added to `layout` fields, or `into`), `nav`,
`dashboard` cards, palette `commands`, `help` articles (seeded on start-up when missing) and a
`plugin` escape hatch. Modules are applied before every other step, so their collections get
all the conventions. A slug clash throws. The playground's `src/modules/events` is the
worked example; the docs page "Site modules" has the rules.

## Recipes

Opt-in plugins added after `sitekickCMS(...)` in `plugins`, each exported from `@sitekick/cms`.

### Google sign-in

```ts
plugins: [sitekickCMS({ site }), googleSignIn()]
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google Cloud OAuth client (type "Web
application", redirect URI `<site>/api/users/google/callback`, and `http://localhost:3000/...`
for development). The sign-in screen then shows "Continue with Google". Until both are set,
the button is hidden and the endpoints answer 404.

It signs in people who already have an account with that verified email. Invites are still how
people are added, and email and password keep working. `googleSignIn({ domains: ['acme.com'] })`
also lets in anyone from that Google Workspace, creating an editor account on first sign-in
(`role` changes the role). Failures come back to the sign-in screen with a plain message: no
account, cancelled, or expired. The session is Payload's own cookie, and the last sign-in stamp
updates (`recipes/google.ts`).

### Localisation

```ts
plugins: [sitekickCMS({ site }), localization({ locales: ['en', 'es'] })]
```

Sets up Payload's localisation (the locale switcher in the admin, fallback to the default
locale) and marks which fields are translated, so nothing is hand-marked. Words are
translated, and structure is shared. Text, textarea and rich text fields are translated
wherever they are, inside groups, arrays and blocks too, so a translator fills in the same
page in another language rather than rebuilding it. Slugs, `href`/`url` fields, the link,
email and phone field builders, dates, numbers, choices, relationships and images are shared.
The automatic SEO title and description follow each language.

By default it covers every collection in the sidebar and every global, but not accounts or
Sitekick's own collections (help, proposals, runs). `collections` and `globals` narrow that;
a field with `localized` set, or `custom: { sitekick: { localized: false } }`, keeps its
choice. Locale codes get their own names in the switcher (`es` shows as "Español"); pass
`{ code, label }` to change one.

It changes the database (translated values move to `_locales` tables), so create a migration;
existing content becomes the default locale's. The frontend asks for a language with
`payload.find({ ..., locale })`; putting the locale in the URL (`/es/about-us`) is the site's
routing. Agent proposals still write the default locale.

## Lists

Every collection in the sidebar gets saved views: Payload's query presets, so an editor can
save filters, columns, sort and grouping under a name, for themselves or shared
(`lists/index.ts`). They need the `payload-query-presets` table, so add a migration after
upgrading. `savedViews: false` turns them off; a collection that sets `enableQueryPresets`
keeps its own choice.

Collections with drafts also get a board at `/admin/collections/<slug>/board`, opened from the
"Board" button beside Create new. It has three columns: Draft (not on the site), Changed (live,
with edits that aren't published) and Published. Dragging a card to Published, or using its
Publish button, publishes the latest draft; dragging it to Draft unpublishes it. Every move
is confirmed first, and a failed publish names the fields to fix. Cards show the first
image field as a thumbnail. `board: false` turns it off.

## AI usage

`/admin/usage`, linked from the account menu for admins, shows what the agents cost. Every
run records its spend in `runs.costUsd` (from AI Gateway's cost metadata), so the page
shows:
- this month against last month, with a projection to the end of the month
- the budget in `SITEKICK_AI_BUDGET_USD`, if set: a meter, and a warning when the pace would go over
- spend per day for the last 30 days
- this month split by agent, model and who started each run
- what failed runs cost
- the five most expensive runs

Editors who open it are told only admins can see it (`admin/review/UsageView.tsx`,
`review/usage.ts`).

## Agent buttons

Off unless the host passes `agents: { basePath: '/api/agents' }` and mounts
`createAgentRoutes` from `@sitekick/agents` there. Placement comes from each collection's
contract (`agent/ui.ts`):

| Contract / field | Admin |
|---|---|
| `custom.sitekick.agent.actions: ['enrich']` | "Find details" in the edit view's document controls (saved, unmodified documents) |
| `custom.sitekick.agent.actions: ['draft']` | "Draft from notes" beside Create new; `?draft=1` opens it; a ⌘K command links there |
| `custom.sitekick.agent.actions: ['edit']` | "Edit with words" in the edit view's document controls (needs a writable blocks field) |
| upload collection, top-level `alt` text field | "Describe image" under the field |
| SEO tab (seo convention) | "Write with AI" in the overview |

Whole-document agents open the run, which links to the proposal; field actions fill the
form in place and the editor saves. Client components read `admin.custom.sitekick.agents`.

### Previewing a proposal

A proposal for a blocks field is reviewed section by section (new, changed, moved,
removed) beside the site's own preview of the proposed page. The review view takes the
target collection's `admin.preview` URL and adds `proposal=<id>` (and `section=<n>`, the
first changed section). The host wires two things:

- its draft route forwards extra query parameters to the page (the playground's
  `/api/draft` does);
- in draft mode, the page applies the proposal to the document it loaded:

```ts
import { applyProposalPreview } from '@sitekick/cms'

const applied = await applyProposalPreview({ payload, headers: await headers(), proposal, collection: 'pages', doc: page })
const shown = applied?.doc ?? page // applied.proposal.title for a "not saved" banner
```

Only a signed-in editor who can read the proposal gets it applied; uploads and
relationships in the proposed value are populated one level. `RenderBlocks` takes
`anchors` to put a `#section-<n>` anchor before each section.
