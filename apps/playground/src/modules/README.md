# Site modules

This site's own features live here, one folder per module. The `@sitekick` packages are never
edited or patched from a site: if a module needs something they don't offer, the extension
point goes into the package.

A module describes itself with `defineModule` from `@sitekick/cms`:

```ts
export const events = defineModule({
  name: 'events',
  collections: [Events],          // get slugs, SEO, the board, agents… like any collection
  blocks: [UpcomingEventsBlock],  // added to every `layout` (page sections)
  nav: { label: 'Events', icon: 'calendar', links: ['events'] },
  dashboard: [{ key: 'events-coming-up', title: 'Coming up', Component: '/modules/events/admin/ComingUp#ComingUp' }],
  commands: [{ label: 'Upcoming events', href: '/collections/events?sort=startsAt' }],
  help: [addingAnEvent],          // created in Help on start-up if missing; then the site's to edit
})
```

Then list it in `index.ts`. Its section renderers go in `frontend.ts`, and its public pages
are thin route files in `src/app/(frontend)` that import from the module's `frontend/` folder.

```
modules/<name>/
  index.ts        defineModule(...)
  collection.ts   collections and globals
  block.ts        page sections
  admin/          admin components (dashboard cards, custom fields)
  frontend/       page components, section renderers, queries
  help.ts         help articles
```

Rules:
- A module depends on the packages, not on another module.
- Removing a module means deleting its folder, its line in `index.ts` and `frontend.ts`, and its
  routes, then creating a migration.
- When a second client needs the same module, it moves into `@sitekick/cms` as a recipe. Same
  shape, so it's a move, not a rewrite.
