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
