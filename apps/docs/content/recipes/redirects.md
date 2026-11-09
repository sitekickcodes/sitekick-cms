Old addresses that send visitors on to the right page, so links in emails, search results and
other sites keep working after a page moves or the site relaunches. It also keeps a list of the
addresses visitors tried that don't exist.

```ts
import { redirects, sitekickCMS } from '@sitekick/cms'

plugins: [sitekickCMS({ site, modules: [redirects()] })]
```

Redirects is a [site module](../modules.md) shipped by Sitekick. New sites from the CLI have it
already. It has two parts on the site.

**The proxy** serves redirects before any page renders. In `src/proxy.ts`:

```ts
import { redirectsProxy } from '@sitekick/cms/redirects'
import type { NextFetchEvent, NextRequest } from 'next/server'

const redirects = redirectsProxy()

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return redirects(request, event)
}

export const config = {
  matcher: ['/((?!admin|api|_next|.*\\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?|txt|xml|json)$).*)'],
}
```

The proxy reads the whole table from `GET /api/redirects/table`, which is cached at the edge,
and keeps it in memory for a minute. A visit costs a lookup, not a database query. That's also
why a new redirect takes a minute or two to start working. Old `.html` and `.php` addresses go
through the proxy too, since a relaunch breaks exactly those.

**The 404s** feed the Missing pages list. Call `recordMissing` where a route finds nothing:

```ts
import { recordMissing } from '@sitekick/cms'

if (!page) {
  await recordMissing(payload, { path: `/${slug}`, referrer: (await headers()).get('referer') })
  notFound()
}
```

To cover addresses no route matches, the playground also turns on `experimental.globalNotFound`
and records them in `app/global-not-found.tsx`. It gets the address from the `x-sitekick-path`
header that the proxy sets. Don't record in `not-found.tsx`: Next renders that boundary next to
every page, found or not.

## For editors

- **Changing a page's address** adds a redirect from the old one when the page is published.
  Earlier redirects that pointed at the old address are pointed at the new one, so visitors
  are never sent through a chain of hops. Changing an address in a draft does nothing until
  the page is published.
- **Add one by hand** under Website › Redirects. The old address can be a path or the full old
  URL. Send people to a page on this site or to any web address. Leave Permanent on unless the
  redirect is short-term. A permanent redirect is a 308, so search engines move the old
  address over; a temporary one is a 307.
- **Import from a spreadsheet** above the Redirects list. Paste two columns, old address and
  new, with an optional third column saying "temporary". Pasting a corrected sheet again
  updates the redirects already there. Lines that can't be used are listed by number.
- **Missing pages** lists the addresses visitors tried that don't exist, most visited first,
  and the dashboard shows the top five. Open one, type where it should go, and save: that adds
  the redirect and marks the missing page Redirected. Mark one Ignored if it was never a real
  page.

Each redirect counts how often it has been used and when it was last used, so you can tell
when an old one is no longer needed.

A help article, "Redirects and missing pages", is added to the help drawer on first start.

## Rules

- **A published page beats a redirect.** You can't add a redirect from an address where a
  published page lives, and publishing a page at an address removes any redirect from it.
  Routes in the app itself, like `/news`, aren't pages, so a redirect from one of them does
  take over.
- **Chains are followed and loops are dropped.** If `/a` goes to `/b` and `/b` goes to `/c`,
  visitors to `/a` go straight to `/c`. A loop is left out of the table, so it shows a 404
  instead of redirecting forever.
- **Query strings survive.** `/old?utm_source=mail` arrives at `/new?utm_source=mail`, unless
  the target has a query string of its own.
- **Addresses are stored tidy:** lower case, with no trailing slash, query string or domain.
  `https://old.example.com/About-Us/` is stored as `/about-us`.
- **Missing pages skips noise.** It ignores bots probing for WordPress or secret files, and
  requests for missing images, scripts and other files. It keeps at most 1,000 open entries,
  so a crawler can't fill the database.

Which collections write redirects: every collection with a `slug` field and a
`custom.sitekick.seo.pathPrefix`. To choose them yourself, pass
`redirects({ collections: { pages: '/', posts: '/news' } })`. Turn off Missing pages with
`redirects({ missingPages: false })`.

Both collections are private. Agents don't touch them, they aren't in the public catalog or
MCP server, and only signed-in editors can read them. The table endpoint is public, since
anyone can see a redirect by visiting the old address. Hit counts are only accepted from the
site itself, using a key derived from `PAYLOAD_SECRET`.
