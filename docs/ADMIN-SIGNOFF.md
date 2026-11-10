# Admin signoff checklist

Run on every Payload bump and before every release of `@sitekick/cms`. Four widths: desktop
(1440), tablet (1024), phone (390) and small phone (320). The Playwright suite in
`apps/playground/e2e` automates the checks marked ⚙, and CI runs it on every push (the Admin
suite job: a production build on an empty Postgres, migrated from the first migration and
seeded). The rest are eyes-on.

Locally: `cd apps/playground && bun run e2e` against the dev server on :3100 (the Neon `dev`
branch). It seeds its own admin account, demo page and review demo first.

What the suite covers beyond this list: a page from Create New to live (no empty draft on
open, slug from the title), the board, a visitor sending a form and the submission in the
admin, a redirect served by the proxy, and a missing page turned into a redirect.

For each screen: no console errors ⚙, no horizontal scroll ⚙, focus visible on every
control, text never clipped, the sidebar and header stay usable.

## Sign in and account
- [ ] Sign-in frame shows the site name, no autofocus, 1Password fills cleanly ⚙
- [ ] "Signing in…" overlay appears, no flash of the empty admin
- [ ] Forgot password, reset, set password on first sign-in (invite link)
- [ ] Account page: name, email, change password, log out

## Shell
- [ ] Sidebar: brand row, Search (⌘K), Dashboard, Pinned, Recent, areas, More, Get help, account ⚙
- [ ] Single-link areas render as the link; areas remember their fold within the session
- [ ] Collapsed sidebar and the phone sidebar (open, close, scroll lock)
- [ ] Command palette: opens with ⌘K and from the sidebar row, arrows + Enter, document search returns rows, Escape and backdrop close ⚙
- [ ] Help drawer: opens, searches, minimises, never resets an unsaved form, `?help=<id>` deep link
- [ ] Dashboard: greeting, Create menu, every card renders or shows its empty state ⚙

## Lists
- [ ] Filter count badge and filter panel open on arrival at a filtered list
- [ ] Status tags, relationship cells never show "<No X>", upload thumbnails
- [ ] Search, sort, pagination, column picker, bulk select and delete
- [ ] Inbox: To review and In progress sections, empty states, filter chips ⚙

## Edit view
- [ ] Tabs read Content / History, API tab hidden
- [ ] Sidebar: status, publish/unpublish, SEO panel with real URL, preview, autosave indicator
- [ ] Row labels show real titles; blocks picker shows the three groups
- [ ] Clicking an image opens the media drawer; link/email/phone open buttons
- [ ] Live preview at phone, tablet and desktop updates on save ⚙
- [ ] Versions: compare, restore
- [ ] Proposal review: per-field diff, receipts, Accept / Reject / Accept all, toast, status update ⚙
- [ ] Run view: steps timeline, Now line, question buttons, cancel and retry ⚙

## Uploads
- [ ] Drag and drop, bulk upload, focal point, crop off, alt required message

## Users
- [ ] Invite: one step with role, 7-day link, invited and last-sign-in stamps
- [ ] Send reset email on someone else's account

## Theme
- [ ] The EXCEPTION list test passes and each exception still matches its Payload class ⚙
- [ ] Dark mode (OS setting) is readable on every screen above
