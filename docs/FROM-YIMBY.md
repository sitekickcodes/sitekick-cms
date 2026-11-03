# From Yimby to Sitekick CMS

A short note on how Sitekick CMS grows out of the work on yimby-website, and what changes
for the next client. Written 2026-11-03, at the end of the phase 1 prototype.

## What Yimby taught us

Yimby is where we learned what a good Payload admin looks like. We rebuilt the sidebar,
dashboard and help system, fixed the rough edges in lists and forms, branded the sign-in,
added invites, and built the civic research agent that fills in candidate profiles with
sources. Editors could run the site without us.

All of it was written for Yimby alone. None of it could move to the next client without
copying and editing, and Yimby and Last Best Comedy had already drifted apart from the
starter template.

## What Sitekick CMS does with it

Sitekick CMS turns that work into a product we install on day one of every project.

**The admin polish is a plugin.** The sidebar engine, dashboard, help drawer, invites,
sign-in frame, auto slugs, auto SEO, link fields, row labels, the command palette and the
theme live in one package, `@sitekick/cms`. One line in the config and a new client's admin
looks and behaves like Yimby's did after months of work. A fix lands in every client by
bumping a version.

**The page builder is a library.** Yimby's block system became `@sitekick/blocks`: the
block schemas, React renderers, a shared rich text editor, live preview, and a starter
frontend on Tailwind and shadcn. Clients get a real page builder from the first commit.

**The research agent became a pattern.** At Yimby the agent wrote straight into records
behind a "reviewed" checkbox. Now every collection declares what agents may touch, and
agents never write directly. They file proposals with receipts (source URL, when it was
fetched, the exact excerpt), and the editor accepts or rejects each field from an inbox.
Accepting writes under the editor's name, as a draft, so versions and history behave as
for a human. The same machinery runs an Enrich agent for any person or partner profile
and a Draft agent that writes a post from notes or a link. That is the answer to the
visual editor request too: say what you want changed, review the change, accept it.

**Every site is readable by AI from install.** The public MCP server we hand-built for
Last Best Comedy is now generated automatically, with llms.txt, an OpenAPI description, a
REST API and a Markdown view of every page, from the same declaration that governs the
agents. Nothing is hand-listed.

**One stack, repeated.** Each client gets its own Vercel project, Neon database and admin,
provisioned the same way. Handoff is clean and nothing is shared between clients. A later
Sitekick Console will read every client CMS through its MCP server.

## Where it stands

Phase 0 and 1 are live at https://sitekick-cms-playground.vercel.app, a demo company site
with the full admin, the block builder, the review inbox and the public agent surface.
Next is the end-to-end agent demo against a live model, then "Edit with words" on pages,
and then moving Last Best Comedy and Yimby onto the packages as the first real adopters.

Plan: `docs/PLAN.md`. Decisions: `docs/DECISIONS.md`.
