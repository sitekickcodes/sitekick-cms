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
