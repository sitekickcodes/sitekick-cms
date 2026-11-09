import { defineModule, type SiteModule } from '../../modules'
import { missingPagesCollection, redirectsCollection } from './collections'
import { hitEndpoint, importEndpoint, tableEndpoint } from './endpoints'
import { guardLivePages, publicPrefixes, withSlugRedirects } from './hooks'
import { MISSING_SLUG, REDIRECTS_SLUG } from './model'

export { recordMissing, MISSING_CAP, TABLE_MAX_AGE } from './endpoints'
export { MISSING_SLUG, REDIRECTS_SLUG, isNoise, normalizePath, normalizeTarget, parseImport, resolveChains, type RedirectRule } from './model'

export type RedirectsOptions = {
  /**
   * Collections whose address changes write a redirect, with their public prefix:
   * `{ pages: '/', posts: '/news' }`. Default: every collection with a `slug` field and a
   * `custom.sitekick.seo.pathPrefix`.
   */
  collections?: Record<string, string>
  /** The Missing pages list and its dashboard card. Default on. */
  missingPages?: boolean
}

/**
 * Redirects, as a recipe: old addresses that send visitors on, kept by editors under
 * Website › Redirects. It's a site module:
 *
 *   sitekickCMS({ site, modules: [redirects(), ...] })
 *
 * What it does:
 *   - Publishing a page under a new address adds a redirect from the old one (and points
 *     older redirects straight at the new one). A page at an address always beats a
 *     redirect from it.
 *   - "Import from a spreadsheet" takes the old site's URLs at a relaunch.
 *   - Missing pages lists the addresses visitors tried that don't exist, most visited
 *     first; typing where one should go turns it into a redirect.
 *
 * The site serves them from `src/proxy.ts` with `redirectsProxy` from
 * `@sitekick/cms/redirects`, and feeds Missing pages by calling `recordMissing` where it
 * 404s. Both collections are private: no agents, no public catalog.
 */
export function redirects(options: RedirectsOptions = {}): SiteModule {
  const missing = options.missingPages !== false
  return defineModule({
    name: 'redirects',
    collections: [{ ...redirectsCollection(), endpoints: [tableEndpoint(), hitEndpoint(), importEndpoint()] }, ...(missing ? [missingPagesCollection()] : [])],
    nav: { label: 'Redirects', icon: 'link', links: [REDIRECTS_SLUG, ...(missing ? [MISSING_SLUG] : [])] },
    dashboard: missing ? [{ key: 'redirects-missing', title: 'Missing pages', Component: '@sitekick/cms/admin#MissingPagesCard', skeletonRows: 4 }] : [],
    commands: [
      { label: 'Redirects', href: `/collections/${REDIRECTS_SLUG}`, keywords: ['redirect', 'old address', 'url', '301'] },
      ...(missing ? [{ label: 'Missing pages', href: `/collections/${MISSING_SLUG}?where[status][equals]=open`, keywords: ['404', 'not found', 'broken links'] }] : []),
    ],
    help: [redirectsHelp],
    plugin: (config) => {
      const prefixes = publicPrefixes(config.collections ?? [], options.collections)
      return {
        ...config,
        collections: (config.collections ?? []).map((c) => {
          if (c.slug === REDIRECTS_SLUG) return { ...c, hooks: { ...c.hooks, beforeValidate: [...(c.hooks?.beforeValidate ?? []), guardLivePages(prefixes)] } }
          return prefixes[c.slug] !== undefined ? withSlugRedirects(c, prefixes[c.slug]!) : c
        }),
      }
    },
  })
}

/** Help, written as the drawer shows it (Lexical, built small here so the recipe needs no converter). */
const text = (t: string) => ({ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
const node = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({ type, children, direction: 'ltr', format: '', indent: 0, version: 1, ...extra })
const p = (t: string) => node('paragraph', [text(t)], { textFormat: 0, textStyle: '' })
const h = (t: string) => node('heading', [text(t)], { tag: 'h2' })
const ol = (items: string[]) => node('list', items.map((t, i) => node('listitem', [text(t)], { value: i + 1 })), { listType: 'number', start: 1, tag: 'ol' })

const redirectsHelp = {
  slug: 'redirects-and-missing-pages',
  title: 'Redirects and missing pages',
  topic: 'Website',
  summary: 'Keep old links working when addresses change, and fix the ones people can’t find.',
  body: {
    root: node('root', [
      p('A redirect sends anyone who arrives at an old address to the right page, so links in emails, search results and other sites keep working.'),
      h('When you change a page’s address'),
      p('Nothing to do. When you publish a page under a new address, a redirect from the old one is added for you under Redirects.'),
      h('Add one by hand'),
      ol([
        'Open Redirects in the sidebar and choose Create New.',
        'Old address: the path people arrive at, like /about-us. A full old URL works too.',
        'Send people to: a page on this site, like /about, or any web address.',
        'Leave Permanent on unless it’s short-term (a sale, an event). Save.',
      ]),
      h('Moving from an old website'),
      p('Choose Import from a spreadsheet above the Redirects list and paste two columns: old address, new address. Pasting a corrected list again updates what’s there.'),
      h('Missing pages'),
      p('Missing pages lists the addresses visitors tried that don’t exist, most visited first, and the dashboard shows the top few. Open one, type where it should go under Send people to, and save: it becomes a redirect. Mark one Ignored if it was never a real page.'),
      p('A page always wins: if you publish a page at an address that has a redirect, the page shows and the redirect is removed.'),
    ]),
  },
}
