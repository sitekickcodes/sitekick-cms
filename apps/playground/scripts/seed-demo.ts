import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'

/**
 * Upserts the demo "Home" page (slug `home`) using every block, so the
 * playground has something to look at. Idempotent: run it again and the page
 * is rewritten, not duplicated. No images: uploads need files.
 *
 *   cd apps/playground && bun scripts/seed-demo.ts
 */

type Paragraph = { type: 'paragraph'; version: 1; children: { type: 'text'; version: 1; text: string; format: 0; mode: 'normal'; style: ''; detail: 0 }[]; direction: 'ltr'; format: ''; indent: 0; textFormat: 0; textStyle: '' }

/** Lexical state for a few plain paragraphs; enough for seed copy. */
const richText = (...paragraphs: string[]) => ({
  root: {
    type: 'root' as const,
    version: 1,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    children: paragraphs.map(
      (text): Paragraph => ({
        type: 'paragraph',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }],
      }),
    ),
  },
})

const url = (label: string, href: string, style: 'primary' | 'secondary' = 'primary') => ({ label, type: 'url' as const, href, newTab: false, style })

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const existing = await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, limit: 1, draft: true, overrideAccess: true })

  const data: RequiredDataFromCollectionSlug<'pages'> = {
    title: 'Home',
    slug: 'home',
    intro: 'A small studio that designs and builds websites people can actually run themselves.',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        eyebrow: 'Demo Co.',
        heading: 'Websites your team\ncan run without us',
        subheading: 'We design, build and hand over. Every page is editable in plain language, with a live preview so nobody publishes blind.',
        buttons: [url('Start a project', '/contact'), url('See our work', '/work', 'secondary')],
        surface: 'light',
        alignment: 'center',
      },
      {
        blockType: 'stats',
        eyebrow: 'By the numbers',
        heading: 'Small team, long relationships',
        items: [
          { value: '14', label: 'years in business' },
          { value: '120+', label: 'sites handed over' },
          { value: '92%', label: 'of clients still with us' },
        ],
        surface: 'soft',
      },
      {
        blockType: 'imageText',
        eyebrow: 'How we work',
        heading: 'Build once, then get out of the way',
        content: richText(
          'Most agencies keep you on retainer for every word change. We do the opposite: the site ships with an editor your team can use, and we stay on for the things that need a developer.',
          'That means fewer tickets, faster updates, and a site that still looks designed six months after launch.',
        ),
        link: [url('About the studio', '/about')],
        imagePosition: 'right',
        surface: 'light',
      },
      {
        blockType: 'cardGrid',
        eyebrow: 'Services',
        heading: 'What we do',
        cards: [
          { title: 'Design', icon: 'sparkles', text: 'Brand, layout and type systems that hold up across every page, not just the homepage.', link: [url('Design', '/services/design')] },
          { title: 'Build', icon: 'zap', text: 'Fast, accessible sites on a modern stack, with a content model your team understands.', link: [url('Build', '/services/build')] },
          { title: 'Support', icon: 'shield', text: 'A real person on the other end when something needs a developer. No ticket queue.', link: [url('Support', '/services/support')] },
        ],
        columns: 'three',
        surface: 'light',
      },
      {
        blockType: 'quote',
        quote: 'We used to wait two weeks for a copy change. Now the person who wrote it publishes it, and it still looks like the site we paid for.',
        attribution: 'Maya Lindqvist',
        role: 'Marketing lead, Northwind',
      },
      {
        blockType: 'richText',
        content: richText(
          'Everything on this page is a section an editor can add, reorder or remove. There is no page template behind it: the hero, the figures, the cards and the questions below are all blocks from the shared library.',
          'Open the admin, change a heading, and watch the live preview update as you type.',
        ),
        width: 'narrow',
      },
      {
        blockType: 'faq',
        eyebrow: 'Questions',
        heading: 'Things people ask first',
        items: [
          { question: 'How long does a site take?', answer: richText('Six to ten weeks for most marketing sites, from kickoff to handover. Larger content migrations add time; we scope that up front.') },
          { question: 'Can we edit it ourselves?', answer: richText('Yes. That is the point. Every page is built from sections with plain-language fields and a live preview. If a change needs code, we handle it.') },
          { question: 'What does it cost to run?', answer: richText('Hosting and the database are on your own accounts, so you pay the providers directly, typically under fifty dollars a month for a marketing site.') },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Ready when you are',
        body: 'Tell us what you are building and we will come back within two working days.',
        buttons: [url('Start a project', '/contact'), url('Email us', 'mailto:hello@example.com', 'secondary')],
        surface: 'dark',
      },
    ],
  }

  const doc = existing.docs[0]
    ? await payload.update({ collection: 'pages', id: existing.docs[0].id, data, draft: false, overrideAccess: true })
    : await payload.create({ collection: 'pages', data, draft: false, overrideAccess: true })
  payload.logger.info(`Seeded page "${doc.title}" (id ${doc.id}, ${doc.layout?.length ?? 0} sections).`)
} finally {
  await payload.destroy()
}
process.exit(0)
