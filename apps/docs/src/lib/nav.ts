/** `source` is `content/<file>` or `repo/<path>`; lib/docs.ts reads it. Plain data, so the
 * client sidebar can import it. */
export type Page = { slug: string; title: string; source: string; description: string }
export type Section = { title: string; pages: Page[] }

/** `content/<file>` in this app, or a file in the repo (the package READMEs). */
const content = (file: string) => `content/${file}`
const repo = (file: string) => `repo/${file}`

/**
 * Every page of the docs, in sidebar order. Guides live in `content/`; the reference pages
 * are the package READMEs themselves, read at build time, so they can't drift from the code.
 */
export const SECTIONS: Section[] = [
  {
    title: 'Start',
    pages: [
      { slug: '', title: 'Introduction', source: content('index.md'), description: 'What Sitekick CMS is, and what it is for.' },
      { slug: 'getting-started', title: 'Getting started', source: content('getting-started.md'), description: 'Create a site, run it, deploy it.' },
      { slug: 'configuration', title: 'Configuration', source: content('configuration.md'), description: 'Every option of sitekickCMS(), and the environment.' },
    ],
  },
  {
    title: 'Guides',
    pages: [
      { slug: 'editing', title: 'The admin', source: content('editing.md'), description: 'What editors get: sidebar, home, lists, boards, pages, help.' },
      { slug: 'modules', title: 'Site modules', source: content('modules.md'), description: 'Where a client’s own features go, and how they plug in.' },
      { slug: 'blocks', title: 'Pages and blocks', source: content('blocks.md'), description: 'The block library and how a page is built.' },
      { slug: 'agents', title: 'Agents', source: content('agents.md'), description: 'Draft from notes, Edit with words, Find details, and review.' },
      { slug: 'evals-and-cost', title: 'Evals and cost', source: content('evals-and-cost.md'), description: 'Measuring the agents, and what they spend.' },
      { slug: 'email', title: 'Email', source: content('email.md'), description: 'Invites and password resets through AutoSend.' },
    ],
  },
  {
    title: 'Recipes',
    pages: [
      { slug: 'recipes/forms', title: 'Forms', source: content('recipes/forms.md'), description: 'Forms editors build, submissions in the admin, spam kept out.' },
      { slug: 'recipes/redirects', title: 'Redirects', source: content('recipes/redirects.md'), description: 'Old addresses that keep working, and the missing pages people hit.' },
      { slug: 'recipes/google-sign-in', title: 'Google sign-in', source: content('recipes/google-sign-in.md'), description: '“Continue with Google” for people who already have an account.' },
      { slug: 'recipes/localisation', title: 'Localisation', source: content('recipes/localisation.md'), description: 'Content in more than one language.' },
    ],
  },
  {
    title: 'Reference',
    pages: [
      { slug: 'reference/cms', title: '@sitekick/cms', source: repo('packages/cms/README.md'), description: 'The Payload plugin.' },
      { slug: 'reference/blocks', title: '@sitekick/blocks', source: repo('packages/blocks/README.md'), description: 'Block schemas, editor and renderers.' },
      { slug: 'reference/agents', title: '@sitekick/agents', source: repo('packages/agents/README.md'), description: 'The agent kit.' },
      { slug: 'reference/create-sitekick-cms', title: 'create-sitekick-cms', source: repo('packages/create-sitekick-cms/README.md'), description: 'The CLI.' },
    ],
  },
]

export const PAGES = SECTIONS.flatMap((s) => s.pages)

export function pageFor(slug: string): Page | undefined {
  return PAGES.find((p) => p.slug === slug)
}

export function neighbours(slug: string): { prev?: Page; next?: Page } {
  const i = PAGES.findIndex((p) => p.slug === slug)
  return { prev: PAGES[i - 1], next: PAGES[i + 1] }
}

export const hrefOf = (slug: string) => (slug ? `/${slug}` : '/')


