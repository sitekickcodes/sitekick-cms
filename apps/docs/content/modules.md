Every client needs something Sitekick doesn't have: an events calendar, donations, a member
directory, a sync with their CRM. That work lives in the client's own repo, as **site
modules**, and never as changes to the `@sitekick` packages.

## Three layers

| Layer | Where | What goes there |
| --- | --- | --- |
| Core | `@sitekick/cms`, `blocks`, `agents` | What every site gets. Versioned on npm, never edited from a site. |
| Recipes | Opt-in plugins in the packages | Features more than one client needs, such as [Google sign-in](./recipes/google-sign-in.md) and [localisation](./recipes/localisation.md). |
| Site modules | `src/modules/<name>/` in the site | Anything one client needs. |

## A module

A module is a folder that describes itself with `defineModule`:

```ts
// src/modules/events/index.ts
import { defineModule } from '@sitekick/cms'

export const events = defineModule({
  name: 'events',
  collections: [Events],
  blocks: [UpcomingEventsBlock],
  nav: { label: 'Events', icon: 'calendar', links: ['events'] },
  dashboard: [{ key: 'events-coming-up', title: 'Coming up', Component: '/modules/events/admin/ComingUp#ComingUp' }],
  commands: [{ label: 'Upcoming events', href: '/collections/events?sort=startsAt' }],
  help: eventsHelp,
})
```

The site lists its modules once and hands them to `sitekickCMS`:

```ts
// src/modules/index.ts
export const modules: SiteModule[] = [events]

// src/payload.config.ts
plugins: [sitekickCMS({ site, nav, modules })]
```

Modules go **inside** the call, not after it, for a reason: `sitekickCMS` adds the modules'
collections first and then applies its conventions. So a module's collection gets automatic
slugs, search details, row labels, the board, saved views, the agent buttons, MCP access and
the public catalog exactly like a built-in one, with no extra wiring.

## What a module can add

| Key | What it does |
| --- | --- |
| `collections`, `globals` | Payload collections and globals. A slug that already exists stops the build. |
| `blocks` | Page sections, added to every `layout` field (the one `layoutField()` makes). `into: { pages: 'layout' }` picks the fields. Edit with words can use them straight away. |
| `nav` | The module's area in the sidebar, used when the site's `nav` doesn't already place those links. |
| `dashboard` | Cards on the home screen: server components by import-map path. Build them from `DashboardPanel` and `DashboardRows` in `@sitekick/cms/admin` so they match. |
| `commands` | Entries in the command palette. Every collection already gets "Go to" and "New" entries; add the rest, such as a filtered list. |
| `help` | Help articles, created on start-up when missing, then the site's to edit. Write Markdown and convert it with `markdownToLexical` from `@sitekick/agents`. A new topic is added to the help drawer. |
| `plugin` | Escape hatch: a plain Payload plugin, run at the same early point. |

## Pages on the site

Public pages stay in the module too. Route files in `src/app/(frontend)` are one line each:

```tsx
// src/app/(frontend)/events/page.tsx
import { EventsPage } from '@/modules/events/frontend'
export default EventsPage
```

Section renderers are collected in `src/modules/frontend.ts` and passed to `RenderBlocks`:

```tsx
// src/modules/frontend.ts
export const customBlocks: CustomBlockComponents = { ...eventBlocks }

// where the page renders its sections
<RenderBlocks blocks={page.layout} custom={customBlocks} />
```

Use `Band`, `SectionHeading` and `Card` from `@sitekick/blocks/react` so a module's sections
look like the library's. A section without a renderer shows a note while developing, and
nothing on the live site.

> Payload's Local API returns drafts too. Public pages must ask for
> `_status: { equals: 'published' }` unless an editor is previewing; the Events module shows
> how.

## The example: Events

New sites come with `src/modules/events` (leave it out with `--no-events`). It has:
- a collection with start and end times, a place, a summary and a sign-up link
- an "Upcoming events" section for any page
- `/events` and an event page
- a "Coming up" card on the dashboard
- a palette entry and a help article

It's a complete module to copy from, or to delete.

## Rules

1. **Never patch the packages from a site.** No forks, no `patch-package`, no copied package
   code. If a module needs something the core doesn't offer, the extension point goes into the
   package, released like any other change.
2. **Modules depend on the core, not on each other.** If two need each other, they're one
   module, or the shared part belongs in the core.
3. **Graduate, don't copy.** When a second client needs a module, it moves into the packages
   as a recipe. Same shape, so it's a move, not a rewrite.
4. **Removing a module** means deleting its folder, its line in `index.ts` and
   `frontend.ts`, its routes, and creating a migration.
