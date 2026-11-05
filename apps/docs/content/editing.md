What a client's editors see when they sign in. Everything here comes from `sitekickCMS()`;
none of it is configured per collection.

## Signing in

A branded sign-in screen in the client's colours, with a "Signing in…" overlay so a slow
first load never looks broken. New people arrive by invite: an admin enters their email,
name and role, and they get a link to choose a password, valid for 7 days. If email isn't
set up yet, the admin is shown the link to pass on instead. Admins can see when someone was
invited and when they last signed in, and can send anyone a password reset. Sites using the
[Google sign-in recipe](./recipes/google-sign-in.md) also show "Continue with Google".

## The sidebar

The sidebar is arranged in plain areas: Website, News, People, Library, rather than one
long list of collections. Above the areas sit the documents you've pinned and the ones you
opened recently. Anything an arrangement doesn't place is under "More", so nothing is ever
unreachable. Users, API keys and (for admins) AI usage live in the account menu at the
foot, next to Get help.

## Home

A greeting in the editor's time zone, a Create menu, and cards for what needs attention:
drafts waiting, proposals to review, runs in progress and recent edits. A welcome card for
new people can be dismissed for good.

## Search and commands

<kbd>⌘K</kbd> (or <kbd>Ctrl K</kbd>) opens the command palette. Type to jump to any document,
create something in any collection, draft from notes, or open help.

## Lists

- **Status at a glance.** Draft, Published and "Changed" (live with unpublished edits) show
  as coloured tags, and related records show their names, never an empty "<No Author>".
- **Filters** show how many are active, and a filtered link opens with its filters visible.
- **Saved views.** Under *Select Preset*, save the current filters, columns, sort and
  grouping under a name, for yourself or for everyone. "Drafts by me", "Events this month".
- **Group by** any field, and switch between a table and a grid.
- **Board.** Collections with drafts have a *Board* button. It shows three columns, Draft,
  Changed and Published, with a card per document. Drag a card to Published (or use its
  Publish button) to put it live, or to Draft to take it down. Every move asks first,
  because it changes the live site. If something is missing, the board says which field to
  fix.

## Editing

- **Content and History tabs.** No API tab, no developer views.
- **Pages are built from sections.** See [Pages and blocks](./blocks.md).
- **Live preview** beside the form, at phone, tablet and desktop sizes, and a Preview button
  that opens the draft on the real site.
- **Search details fill themselves in** from the title, intro and cover. The sidebar shows
  how the page will look in search results, with an autofill control to start over.
- **Links, emails and phone numbers** tidy themselves on save (adding `https://`, formatting
  US numbers) and have buttons to open, mail or call.
- **Images** open the media drawer when clicked, and list rows show a real title instead of
  "Item 01".
- **Agent buttons** (when the site has them): *Draft from notes* beside Create New, *Edit
  with words* and *Find details* on a document, and *Describe image* and *Write search
  details* on single fields. See [Agents](./agents.md).

## Help

*Get help* opens a drawer beside the work, never over it, so an unsaved form is never lost.
Articles are searchable and can be linked directly (`/admin?help=<article>`). Admins write
them in the Help articles collection, with drafts and preview like any other content.
