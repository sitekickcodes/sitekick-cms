Everything goes through one plugin call. The CLI writes this for you; this page explains it.

```ts
import { buildConfig } from 'payload'
import { googleSignIn, localization, sitekickCMS } from '@sitekick/cms'

export default buildConfig({
  // ...collections, globals, db, editor
  plugins: [
    sitekickCMS({
      site: { name: 'Acme', url: 'https://acme.com', accent: '#c2410c' },
      agents: { basePath: '/api/agents' },
      nav: [
        { label: 'Inbox', icon: 'inbox', links: [{ to: 'view:/inbox', label: 'Inbox' }] },
        { label: 'Website', icon: 'globe', links: ['pages', 'site-settings'] },
        { label: 'News', icon: 'newspaper', links: ['posts'] },
      ],
    }),
    // Recipes are separate plugins, after sitekickCMS.
    googleSignIn(),
    localization({ locales: ['en', 'es'] }),
  ],
})
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `site` | required | `name`, and optionally `url`, `logo`, `icon` and `accent`. Shown in the admin, emails and the sign-in screen. |
| `nav` | from `admin.group` | The sidebar as data: areas of links. A link is a collection or global slug, or `{ to, label, icon, query }`; `view:<path>` links a custom view. Anything visible that the arrangement leaves out lands under "More". |
| `conventions` | all on | Switch off one of `tabs`, `rowLabels`, `relationshipCells`, `uploadPreview`, `seo`, `slugs`. |
| `usersSlug` | `users` | The users collection. |
| `help` | on | The help drawer and its `help-articles` collection. |
| `invites` | on | One-step invites and the set-password controls. |
| `email` | on | AutoSend email from the environment, unless the config sets its own `email` adapter. `false` keeps Payload's default. |
| `modules` | none | The site's own features. See [Site modules](./modules.md). |
| `dashboard` | on | The home view. An object sets extra `cards`, the Create menu order and a date `range`. |
| `savedViews` | on | Saved views on every collection in the sidebar. |
| `board` | on | The board view on collections with drafts. |
| `publicAgentSurface` | on | The public, read-only MCP server, `llms.txt`, OpenAPI and Markdown versions of pages. |
| `agents` | off | The agent buttons. Set `{ basePath: '/api/agents' }` where the app mounts `createAgentRoutes`. |

## Per collection

Sitekick reads `custom.sitekick` on a collection:

```ts
custom: {
  sitekick: {
    // What agents may do here. See Agents.
    agent: {
      description: 'A news post shown on /news.',
      writable: ['title', 'excerpt', 'body', 'cover', 'meta.title', 'meta.description'],
      review: 'required',
      actions: ['draft'],
      notes: 'Never publish. Keep the excerpt under 160 characters.',
    },
    // Where documents live on the site, for SEO previews and preview links.
    seo: { pathPrefix: '/news/' },
    // Hide from agents and the public catalog entirely.
    private: false,
  },
},
```

## Conventions

Applied to every collection and global with no wiring:

- **Slugs** from the title, with `-2`, `-3` on a clash. Deleting the original hands its URL
  to the lowest copy.
- **SEO** title, description and image filled from the content, with a real search preview
  and an autofill control.
- **Row labels** that show a real title instead of "Item 01".
- **Relationship cells** in lists that show the related title, and a dash when empty.
- **Image fields** that open the media drawer on click.
- **Content and History tabs**, with the API tab hidden.

Field builders in `@sitekick/cms` add the rest: `externalLink`, `siteLink`, `emailField`,
`phoneField` (tidy on save, with open, mail and call buttons) and `displayOnly`.
