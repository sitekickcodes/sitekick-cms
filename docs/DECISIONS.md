# Decisions

Numbered, dated, with what was rejected. Add to the bottom; never rewrite history.

## D1 — Payload 4 from the start (2026-11-02)

Pinned to the current 4.0.0 beta, tracking to stable. Rejected: Payload 3.92 stable. Reason:
v4 changed the theme token layer, upload originals, default versions and MCP; building on 3
means redoing the theme and the media work.

## D2 — Customize Payload's admin; own the shell, keep the fields (2026-11-02)

Sidebar, home, command palette, inbox, runs, help, sign-in and users are ours through
Payload's component slots. Field editors and drawers stay native. Rejected: a replacement
admin on the Local API. Reason: months of re-implementation before the first client, and
every Payload improvement would have to be re-done.

## D3 — One Payload per client (2026-11-02)

Own Vercel project, Neon project and domain per client. Cross-client visibility comes later
from a Sitekick Console reading each site's MCP server. Rejected: one multi-tenant Payload
for all clients. Reason: isolation by infrastructure; clients own their stack at handoff.

## D4 — Packages are the product, the template is thin (2026-11-02)

`@sitekick/cms`, `@sitekick/blocks`, `@sitekick/agents` on public npm; `create-sitekick-cms`
generates an app from the playground. Rejected: template repo only. Reason: the starter
already drifted in two clients; a fix must land everywhere with a version bump.

## D5 — AI Gateway + Workflow + eve behind an adapter (2026-11-02)

All model calls go through Vercel AI Gateway with OIDC. Durable orchestration is Vercel
Workflow. eve runs research-style agents but sits behind a small runner interface.
Rejected: direct provider SDKs with keys per client; eve as the plugin's public API.
Reason: no secrets to manage per client, model swaps are a string, and eve is still preview.

## D6 — Agents propose, people approve (2026-11-02)

Agent output lands as a proposal with per-field receipts and is accepted per field by an
editor. Rejected: direct writes with a "reviewed" checkbox (Yimby today). Reason: at Yimby
bios, photos and contacts went live before anyone looked; the checkbox never gated anything.

## D7 — No canvas visual editor (2026-11-02)

Live preview, block reordering, and the Edit-with-words page agent instead. Rejected:
drag-on-canvas editing. Reason: the agentic route is the product bet, and canvas editors
fight the block model.

## D8 — Native sign-in plus invites; SSO as a recipe (2026-11-02)

Rejected: Google-only sign-in. Reason: non-technical client editors often have no Workspace.

## D9 — Edit with words proposes a section plan, applied and validated server-side (2026-11-04)

The model never writes Payload's block storage. It answers with the page's sections in their
new order (keep n, edit n with changed fields, add a new section), in a readable form (rich
text as Markdown, ids for images and links). The kit applies the plan (kept sections byte for
byte), validates it with the block schemas and Payload's own validators, and returns problems
for the model to fix. The proposal is the whole blocks field; accepting is refused if the
sections changed since. Rejected: free-form JSON for the whole layout (the model rewrites
sections it should not touch and loses ids and images); one tool call per operation (more
turns, and a half-applied plan when the loop stops early); per-section accept (sections depend
on each other's order, and a partial layout is a page nobody reviewed). Reason: small,
checkable output; untouched content is guaranteed untouched; the review is what the editor
will get.

## D10 — The agentic editor: clients compose in a language we author (2026-11-17)

Clients make their own pages on the page itself: click a section and say what should change,
type in place, pick from a few rendered options. The agent composes from our blocks, variants
and tokens; a page that breaks the design system can't be expressed. Requests the vocabulary
can't meet come to us as drafts and, once approved, join it. Clients get Lists (simple
collections as data) instead of schema changes. Refines D7: still no free-form canvas, but now
a visual, page-first editor. Rejected: a Squarespace-style canvas (freedom at the pixel level,
where a non-designer has no judgment); forms plus a chat dialog as the end state (it works but
nobody would call it editing a page). Reason: clients can recognise good design but not
specify it, so the agent does the specifying and they choose.

## D11 — Agents work from layered guides (2026-11-17)

Every agent run carries guides in three layers: the kit's global craft (design, UX, writing,
page types) shipped in `@sitekick/agents`, the site's own (`agent/` in its repo: brand, voice,
audience, exemplars, per-block notes) which win where they disagree, and each block's own
"when to use" note. Always-on guides go in the instructions; the rest are listed and read on
demand. Prose is judgment; anything that must always hold is a validation in code. Guides are
covered by evals. Rejected: one long prompt per agent (it grows until it costs and confuses);
guides in the database (they need review like code, and belong with the blocks they describe);
a site guide that only adds to the global one (a client's voice must be able to replace ours).
