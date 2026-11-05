# Sitekick CMS — plan

Status: draft v1, 2026-11-02. Brainstorm and plan only; nothing is built yet.

Sitekick CMS is the version of Payload that Sitekick wants to install on day one of every
client project: world-class editor UX, agent-ready from the first commit, and AI workflows
as a first-class part of the product rather than a bolt-on. Open source, MIT.

Everything below is grounded in three Sitekick repos: `yimby-website` (the furthest we have
pushed Payload: custom sidebar, dashboard, help system, 16-block page builder, and the civic
research agent on eve), `last-best-comedy` (first Payload 4 project, public MCP server, agent
discovery surface), and `payload-starter` (the current template). Section 9 lists what gets
lifted from each.

---

## 1. Decisions

These answer the open questions from the kickoff. Each is a recommendation with the reason;
change any of them and the rest of the plan still holds.

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Payload version | **Payload 4** (pinned to the current beta, tracking to stable) | Yimby and LBC already run it. Payload 4 moved to semantic colour tokens, keeps originals on upload, turns versions and authorship on by default, and ships `plugin-mcp`. Theming built on 3 would be thrown away. |
| D2 | Admin depth | **Customize inside Payload's admin, own the shell.** Sidebar, home, command palette, review inbox, runs, help, sign-in and user management are ours via Payload's component slots. Field editors, drawers, Lexical, versions, uploads stay native, re-skinned through v4 tokens. | Yimby proved this reaches "amazing" without forking. A replacement admin on the Local API means re-implementing Lexical, media drawers, versions, relationships and access UI: months of work before the first client. |
| D3 | Tenancy | **One Payload per client.** Own Vercel project, own Neon project, own domain. A later **Sitekick Console** reads every client CMS through its MCP server with Sitekick-held keys. `plugin-multi-tenant` stays an opt-in recipe for clients with chapters, locations or franchises. | Isolation by infrastructure is simpler and safer than isolation by access control. Clients own their stack at handoff. |
| D4 | Frontend | **Included.** A starter Next.js 16 frontend, a block library with React renderers, Tailwind 4 + shadcn (Base UI, `base-vega` style), design tokens, live preview, draft mode, SEO, sitemap, Markdown negotiation and a public read-only MCP server. | Neither the starter nor LBC has a block builder or live preview. Yimby's is the only one, and it is the thing editors actually use. |
| D5 | AI stack | **Vercel AI SDK through AI Gateway** for every model call (OIDC, no provider keys, model strings, fallback chains, per-client overrides). **Vercel Workflow** for durable orchestration. **eve** for long-running research-style agents, wrapped behind a small adapter. **Payload jobs** for short in-CMS tasks (alt text, SEO, rewrite). Default models: Claude Sonnet for in-admin actions, Claude Opus as eval judge, per-client overrides allowed. | This is what Yimby runs today, so it is proven. eve is a preview framework with known rough edges (a dropped parallel tool result bug, sandbox auth off-Vercel), which is why it sits behind an adapter rather than being load-bearing in the plugin API. |
| D6 | Admin auth | **Payload native sign-in plus the Yimby invite flow** (one-step invite with role, 7-day reset link, invited and last-sign-in stamps). **Google sign-in as an opt-in recipe** in phase 2. Passkeys later. | Non-technical client editors often have no Google Workspace. Invites were the biggest onboarding win at Yimby. |
| D7 | Distribution | **npm packages are the product; the template is thin.** Public packages under the `@sitekick` scope, a `create-sitekick-cms` CLI that generates a client app from the playground, and the playground itself as a template repo. Clients upgrade by bumping versions. | A template-only approach means every client forks and drifts; Yimby and LBC already drifted from the starter. Packages let a fix land in every client. |
| D8 | Repo | `sitekickcodes/sitekick-cms`, public, MIT, Turborepo + Bun monorepo. | Open source as requested. One repo for packages, playground and docs keeps the loop tight while the API is moving. |
| D9 | Visual editor | **No drag-on-canvas visual editor.** The answer to that request is live preview plus block reordering plus the **Edit with words** page agent (section 5). | Agentic route by choice. Canvas editors fight the block model and never match the designed site. |

---

## 2. Product principles

1. **The editor sees their job, not the schema.** Navigation is arranged by what the client does (Website, News, People, Inbox, Settings), not by collection list. Anything unplaced still shows up under "More"; nothing silently disappears.
2. **Every field says what happens when it is blank.** Yimby's ~525 descriptions are the voice: short, plain, "Blank = from the title."
3. **Agents propose; people approve.** An agent never publishes and never overwrites a human's edit. Proposals carry provenance (source URL, fetched-at, excerpt) and are reviewed per field.
4. **Nothing is bespoke that could be a convention.** Slugs, publish dates, SEO, link normalisation, row labels, relationship cells, read-only submissions: all plugin behaviour, zero per-collection wiring.
5. **One theme, swappable identity.** Sitekick's look by default (warm paper, white cards, pill buttons, ink focus). Client identity is logo, accent, font. Every CSS rule that targets a Payload class name is marked `EXCEPTION` with the reason.
6. **Upgrade-safe by construction.** Custom surfaces use Payload's public slots and `@payloadcms/ui` exports. A screen-by-screen signoff checklist (desktop, tablet, 390, 320) runs on every Payload bump.
7. **Agent-readable from install.** Collections declare an agent contract. MCP, OpenAPI, `llms.txt` and the public read-only server are generated from it, not hand-written.

---

## 3. Repository layout

```
sitekick-cms/
  apps/
    playground/          Demo client site ("Sitekick Demo Co."). The test server, the template
                         source for the CLI, and the UX lab. Deployed to Vercel + Neon.
    docs/                Docs site (phase 2). Until then, docs live in /docs as Markdown.
  packages/
    cms/                 @sitekick/cms — the plugin. Admin shell, theme, conventions, review,
                         runs, help, invites, MCP config, agent contract. Subpath exports:
                         @sitekick/cms, @sitekick/cms/fields, @sitekick/cms/hooks,
                         @sitekick/cms/admin, @sitekick/cms/theme.css
    blocks/              @sitekick/blocks — block schemas + React renderers + the shared
                         Lexical editor config. Tailwind + shadcn.
    agents/              @sitekick/agents — agent kit: request outbox, workflow runner,
                         proposals, receipts, eve adapter, AI Gateway helpers, eval harness.
    create-sitekick-cms/ CLI. Generates a client app from apps/playground.
  docs/
    PLAN.md              this file
    DECISIONS.md         numbered decisions, with rejected options
    ADMIN-SIGNOFF.md     the per-release UI checklist
  turbo.json  package.json  bun.lock  .github/workflows (ci, release via changesets)
```

Three packages, not one, because the frontend blocks must not pull in admin code, and the
agent kit must be usable from a client's own workflow code without the admin. The split
also lets a client adopt only the plugin on an existing Payload site.

---

## 4. The plugin: `@sitekick/cms`

One call in `payload.config.ts`:

```ts
import { sitekickCMS } from '@sitekick/cms'

export default buildConfig({
  plugins: [
    sitekickCMS({
      site: { name: 'Demo Co.', logo: '/brand/logo.svg', accent: '#0f766e' },
      nav: arrangement,          // see 4.1; optional, derived from groups if omitted
      ai: { gateway: 'vercel', models: { actions: 'anthropic/claude-sonnet-5-5' } },
      recipes: ['blog', 'team', 'forms'],
    }),
  ],
})
```

### 4.1 Shell

- **Sidebar.** Arrangement as data (areas → links, icon, label override, filtered links with a query string). Collapsed areas, pinned and recent documents, "More" for unplaced collections, Users and API keys in the account menu, help at the foot. Built on `NavWrapper`, `groupNavItems` and `RenderServerComponent`, no Payload class names inside. Lifted from Yimby's `nav/`.
- **Home.** Greeting in the editor's time zone, a Create menu, and streamed cards: drafts waiting, proposals to review, runs in progress, scheduled publishes, recent edits, site pulse (PostHog or Vercel Analytics when configured). Each card is a Suspense boundary. Dismissible welcome stored in user preferences, read server-side so it never flashes.
- **Command palette.** Cmd+K: jump to any document, create in any collection, run an action, open a help guide. Payload's search endpoint plus a static command registry contributed by recipes.
- **Lists.** Filter count badge, filter panel opens on arrival at a filtered list, status as coloured tags, custom relationship cells (fixes the stock "<No X>"), saved views (Payload query presets), board view by status at `/collections/<slug>/board`.
- **Edit view.** Tabs renamed Content / History, API tab hidden. Status, SEO, preview and activity in the sidebar. Row labels show a real title. Clicking an image opens the media drawer. Live preview with phone, tablet and desktop sizes. Open, mailto and tel buttons inside link, email and phone inputs.
- **Help drawer.** Non-modal left drawer, searchable, minimisable, never touches the route or an unsaved form. Content from a `help-articles` collection with drafts and preview; recipes ship their own articles. Shareable as `/admin?help=<id>`.
- **Sign-in and users.** Branded auth frame, "Signing in…" overlay, no autofocus (1Password), set-password on create, "Send reset email" on someone else's account, one-step invite, invited and last-sign-in stamps, `name` for display with `email` as title.

### 4.2 Conventions (field walkers and hooks, zero per-collection wiring)

- Auto slug from title with `-2`, `-3` on clash; deleting the original hands the URL to the lowest copy and writes a redirect.
- `publishedAt` defaults to now on first publish.
- Automatic SEO: meta from content in `beforeValidate`/`afterRead`, SEO tab hidden where unwanted, real public URL in the search preview, autofill control in the document header.
- Link, email and phone fields normalise on save (add `https://`, lowercase, US phone format).
- `displayOnly()` makes submissions read-only except named fields.
- `preserveEditorChanges` for synced content: a sync never overwrites a field a human edited.
- One shared stripped-down Lexical config (h1–h4, links, lists, quote, rule, upload, blocks) across every rich text field.
- Cache revalidation hook per collection (`cms:<slug>` tags), with an escape hatch via `req.context`.
- Sidebar group constants and a documented rule: grouping is cosmetic, isolation is access control.
- Default `defaultColumns`, `useAsTitle` and `listSearchableFields` when a collection omits them.

### 4.3 Theme

- `theme.css`: Sitekick shade scales mapped onto Payload 4's semantic tokens. Client overrides are three variables (accent, font, radius) plus logo and sign-in art.
- `custom.css`: polish rules, each marked `EXCEPTION` when it targets a Payload class, with a test that lists every exception so a Payload bump produces a checklist.
- Motion tokens and a brand font loaded as CSS variables on `<html>`.

### 4.4 Agent contract and MCP

Every collection may declare:

```ts
custom: {
  sitekick: {
    agent: {
      description: 'A news post shown on /news.',
      writable: ['title', 'excerpt', 'body', 'meta'],   // everything else read-only to agents
      fillEmptyOnly: ['excerpt'],
      review: 'required' | 'optional' | 'none',
      notes: 'Never publish. Excerpt under 160 chars.',
    },
  },
}
```

From that one declaration the plugin derives: `plugin-mcp` notes and tool allowlists, API-key permission cards (read, create, edit, delete) bound to a user, the public read-only MCP server's catalog (explicit allowlist, fixed output schemas, rate limit headers), OpenAPI, `llms.txt`, and the review policy for proposals. Keys never count as a signed-in person in access helpers.

### 4.5 Proposals and runs (the review inbox)

Two collections and one admin area, shipped by the plugin, consumed by `@sitekick/agents`:

- **`proposals`.** Target doc, a patch (field → proposed value), per-field receipts (URL, fetched-at, SHA-256, excerpt), the run that made it, status (open, accepted, partially accepted, rejected, superseded). The edit view shows an inline diff per field with Accept and Reject; accepting writes through Payload's normal update with the editor as author, so versions and hooks behave as for a human.
- **`runs`.** Kind, target, stage, steps (with "running / done / failed / skipped" and a short detail), the "Now:" activity line, a question for the editor rendered as buttons, cost, attempts, lease, session id. Retry, cancel and report.
- **Inbox view.** `/admin/inbox`: proposals to review and runs in flight, filterable by collection and by who triggered them. The sidebar badge counts open items.

This replaces Yimby's `researchReviewed` checkbox and direct `overrideAccess: true` writes. The only agent writes that bypass proposals are `fillEmptyOnly` fields with `review: 'none'`.

---

## 5. AI workflows: `@sitekick/agents`

Generalised from the civic research agent. Yimby-specific tools stay in Yimby; the machinery moves here.

- **Request outbox.** A hook or button enqueues a request row in the same transaction as the triggering save. `context.sitekickAgent` on agent writes stops hook loops.
- **Durable runner.** One Vercel Workflow per request: claim with a conditional update and a lease, run, resume the same session on provider failure or an unfinished turn (up to N), requeue on lease expiry, then mark failed. Kill switch via env.
- **Session binding.** A signed token per request binds the agent session to one target record. Tools are thin proxies to an app-side action route that re-validates every input with Zod and serialises writes per request. Every call is logged to a write log.
- **Receipts.** Guarded fetch with receipts, PDF and image readers, Internet Archive fallback. Facts without a receipt are not saved.
- **Verifiers.** A small library of deterministic and model checks run before a proposal is created: claim-by-claim bio check against cited text, portrait check, URL liveness.
- **Model selection.** Allowlist plus AI Gateway fallback chain, per-client override, cost recorded on the run.
- **Evals.** `eve eval`-style harness: one Neon branch per model, exact-field checks plus an LLM judge, a ledger of results.
- **Adapters.** `eve` first; the runner interface is small enough that a plain AI SDK `generateText` loop with tools is the second adapter, so a client with no eve is still supported.

### Reference agents shipped with the kit

1. **Enrich.** "Research this entity and fill in the profile." Target: any collection with a `website` or `name`. Finds the official site, socials, logo or headshot with credit, a neutral bio. The generalisation of candidate research; works for partners, team members, venues, sponsors.
2. **Draft.** "Write a post from these notes / this URL / this transcript." Produces title, excerpt, body (Lexical JSON), SEO, suggested cover. Always a draft proposal.
3. **Edit with words** (phase 2, shipped 2026-11-04). On any page with blocks: "add a FAQ section about parking below the hero, three questions." The agent proposes a section plan, the review shows the change per section beside a preview of the proposed page, the editor accepts or rejects. This is the answer to the visual-editor request. See DECISIONS.md D9.
4. **Field actions.** Rewrite, shorten, translate, alt text, SEO. Inline, instant, accept-in-place; still logged as proposals with `review: 'none'`.

---

## 6. Blocks and frontend: `@sitekick/blocks` + `apps/playground`

- Block schemas sorted into Basics, Designed sections and Calls to action (Yimby's 16 as the seed, pruned to the client-agnostic ones).
- One React renderer per block, shadcn primitives, design tokens in `globals.css`, `DESIGN.md` as the single visual reference (LBC convention), fonts local.
- Pages with blocks, drafts and versions, live preview, draft mode routes, `use cache: remote` with tag invalidation, sitemap from routes plus CMS, JSON-LD helpers, Markdown negotiation on `Accept`, `llms.txt`, public MCP read-only server, 410 for dead slugs, BotID on anonymous writes.
- Recipes (schema + renderer + help articles + sample content): blog, team, events, locations, FAQs, forms with an inbox, testimonials, redirects.
- Media: Vercel Blob, `sharpTransformer` variants, focal point on, auto alt text on upload with a button to regenerate, orphan-blob and backfill crons.

---

## 7. Platform conventions

- Bun, Node 24, exact pins on every `@payloadcms/*` package, `importMap.autoGenerate: false`.
- Neon: `main` is production and the default branch, `preview/<git-branch>` per Vercel preview via the integration, `dev` for local, migrations only (`push: false`), migrate over the unpooled connection, pooled `max: 5`.
- `vercel-build`: lint, typecheck, test, migrate, build. Crons aligned to one hour.
- Email behind one adapter: AutoSend from `AUTOSEND_API_KEY`/`EMAIL_FROM` (built 2026-11-04). Until both are set, invites hand the admin the link instead of failing silently. Analytics via env plus `instrumentation-client.ts`.
- CI on the monorepo: typecheck, unit tests, lint, and a packaging job that creates a site from the npm tarballs (built 2026-11-04, `.github/workflows/ci.yml`). Still to add: the admin signoff Playwright suite against the playground (needs a Neon branch for CI), changesets release to npm.

---

## 8. Phases

### Phase 0 — foundation (week 1)
- Monorepo, packages scaffolded, playground app on Payload 4 beta deployed to Vercel + Neon preview branches.
- Plugin skeleton with theme tokens and the Sitekick look.
- Port the conventions: adminPresentation, rowLabels, relationshipCells, uploadPreview, link/email/phone fields, auto slug, auto SEO, invites, help drawer, sign-in frame.
- Exit: a fresh client app with one line in config looks and behaves like a polished Yimby admin.

### Phase 1 — prototype (weeks 2–4)
- Shell: sidebar arrangement, home, command palette, list polish.
- Blocks package with the first eight blocks, renderer, live preview, draft mode in the playground.
- Agent contract, MCP config, public read-only MCP, `llms.txt`, OpenAPI.
- Proposals, runs, inbox view.
- `@sitekick/agents` runner with the eve adapter; ship **Enrich** and **Draft**; field actions for alt text and SEO.
- Admin signoff checklist run on desktop, tablet, 390 and 320.
- Exit: a demo where an editor creates a partner by name, the agent enriches it, the editor reviews per field and accepts; and writes a post from notes.

### Phase 2 — platform (months 2–3)
- Edit with words (shipped 2026-11-04). Saved views and board view (shipped 2026-11-05: Payload query presets on every sidebar collection; a Draft / Changed / Published board on collections with drafts, where moving a card publishes or unpublishes after a confirm). Google sign-in recipe (shipped 2026-11-05: `googleSignIn()`, existing accounts plus optional Workspace domains). Localisation recipe (shipped 2026-11-05: `localization()`, translates words and shares structure; checked on a fresh CLI site). Follow-ups: show the default language beside an empty translation, and a Translate agent.
- `create-sitekick-cms` CLI and template (built 2026-11-04; the template ships inside the CLI, generated from the playground, so there is no separate template repo). First npm publish waits on the `@sitekick` npm org. Docs site.
- Evals harness and cost dashboard. Plain AI SDK adapter alongside eve.
- Last Best Comedy and Yimby stay untouched for now (decided 2026-11-04). Their repos and CMSs are reference only: no branches, commits, deploys or CMS writes. Moving them onto the packages is deferred until John says go, and will be planned with him first.

### Phase 3 — fleet (month 4+)
- Sitekick Console: every client CMS in one view through their MCP servers.
- Recipe marketplace, client analytics digest agent, scheduled content agents.
- Payload 4 stable; drop the beta pin.

---

## 9. What gets lifted from where

| From | Reusable as-is or near | Stays client-specific |
|---|---|---|
| yimby-website | Sidebar engine and arrangement format, dashboard shell, help drawer, invites, sign-in frame, SigningIn overlay, the four field walkers, link/email/phone fields, displayOnly, auto SEO, slug and promote-slug hooks, preserveEditorChanges, StatusTag, CheckboxesField, MCP config and key permissions, public read-only MCP, request outbox + workflow + lease + resume, receipts, verifiers, eval harness, EXCEPTION CSS convention, signoff checklist, block library, shared Lexical config | Chapter tenancy, civic data, GIS, 18 research tools, 51 state skills, YIMBY art and copy |
| last-best-comedy | Payload 4 config shape (storage, sharpTransformer, variants), migrate script over unpooled Neon, vercel-build chain, cache-tags and invalidation, `use cache: remote`, MCP route skeleton with rate limiting and discovery, SEO pages collection and metadata helpers, DESIGN.md convention, alt text generation and crons, Markdown negotiation, 410 proxy | Shows, classes, bar menu, venue copy |
| payload-starter | Draft routes, redirects plugin + proxy, analytics settings, CLAUDE.md rationale style | Everything else is superseded |

---

## 10. Risks

- **Payload 4 beta churn.** Mitigation: exact pins, the EXCEPTION list test, the signoff suite in CI, one person owns each bump.
- **eve is preview.** Mitigation: adapter boundary, the plain AI SDK adapter in phase 2, known bugs documented.
- **Payload class-name coupling.** Some polish (image shortcut, filter badge) depends on markup. Mitigation: marked, tested, and preferred to be replaced by public slots as Payload adds them.
- **Scope.** Three packages and a playground is a lot for a weeks-long prototype. Phase 0 and 1 cut to the eight blocks and two agents; recipes come later.
- **In-memory state in serverless.** Yimby's action queue and rate limiter live per instance. The kit uses Workflow and Neon for anything that must be shared.

---

## 11. Open questions (answered 2026-11-02)

1. **Brand assets.** John will provide logo, fonts and accent later. Until then the playground uses a neutral placeholder theme; the theme API must make the swap a one-commit change.
2. **First real adopter.** Not decided yet. The playground is the only target through phase 1.
3. **Public read-only MCP and `llms.txt`.** On by default for every client. Opting out is a plugin option.
4. **Playground demo URL.** Yes eventually (`demo.sitekick.co`); use the Vercel-generated domain for now.
