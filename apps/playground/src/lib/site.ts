/** The public origin, the same rule `payload.config.ts` uses for `serverURL`. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3100')

/**
 * Who this site is. The admin, agents and the public agent surface all read it.
 * The brand colour is repeated as `--sk-accent` in the two stylesheets (globals.css, custom.css).
 */
export const site = {
  name: 'Demo Co.',
  description: 'The Sitekick CMS playground: a demo company site.',
  url: siteUrl,
  accent: '#0f766e',
}
