Content in more than one language, translated in place.

```ts
import { localization, sitekickCMS } from '@sitekick/cms'

plugins: [sitekickCMS({ site }), localization({ locales: ['en', 'es'] })]
```

Then create a migration (`bun run migrate:create add-spanish`). Existing content becomes the
default language's.

## What editors see

A language switcher at the top of every document. Fields that are translated are marked with
the language ("Title — Español"). Shared fields, such as the slug, show no marker and are
the same in every language. Publishing is per language ("Publish in Español"), and a missing
translation falls back to the default language on the site.

## What is translated

**Words are translated; structure is shared.** Text, long text and rich text fields are
translated wherever they are, including inside groups, lists and page sections. A translator
fills in the same page in another language, rather than rebuilding it.

These stay the same in every language:

- slugs (one URL per page; put the language in the path, such as `/es/visit`)
- link addresses, emails and phone numbers
- dates, numbers, choices, relationships and images
- fields marked unique

The automatic search title and description follow each language.

## Options

```ts
localization({
  locales: ['en', { code: 'es-MX', label: 'Español (México)' }],
  defaultLocale: 'en',          // default: the first
  fallback: true,               // show the default language when a translation is missing
  collections: ['pages', 'posts'],  // default: every collection in the sidebar
  globals: ['site-settings'],       // default: every global
})
```

Accounts and Sitekick's own collections (help, proposals, runs) are never translated. A field
that sets `localized` itself keeps its choice, and `custom: { sitekick: { localized: false } }`
keeps a field shared.

## On the site

Ask for a language when reading:

```ts
const page = await payload.find({ collection: 'pages', where: { slug: { equals: 'visit' } }, locale: 'es' })
```

Routing (`/es/...`) is the site's own. Agent proposals still write the default language.
