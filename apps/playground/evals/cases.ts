import type { CollectionLike } from '@sitekick/agents'
import { draftCase, editCase, type EvalCase } from '@sitekick/agents/evals'

/**
 * The playground's eval cases: what "good" means for Draft and Edit with words on this
 * site's own collections. Run them with `bun run evals` (scripts/evals.ts).
 */
const lexical = (text: string) => ({
  root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }] }] },
})

const underExcerptLimit = (value: unknown) => (typeof value === 'string' && value.length <= 160 ? true : `excerpt is ${String(value).length} characters; the contract says under 160`)

export function evalCases(collections: CollectionLike[]): EvalCase[] {
  return [
    draftCase({
      id: 'draft/volunteer-day',
      description: 'A post from bullet notes, facts only from the notes.',
      collections,
      input: {
        targetCollection: 'posts',
        notes: [
          'Volunteer day recap, Saturday Oct 25.',
          '- 40 volunteers, planted 120 trees along the river path',
          '- partnered with the parks department',
          '- next one is in spring, sign-ups open in February',
          '- thank the bakery on 3rd street for donating breakfast',
        ].join('\n'),
      },
      expect: { title: /volunteer|tree/i, excerpt: underExcerptLimit },
      forbid: ['author', 'publishedAt'],
      judge: [
        'A news post recapping a volunteer day.',
        '- Every fact comes from the notes: 40 volunteers, 120 trees, the river path, the parks department, spring with sign-ups in February, the bakery on 3rd street. Nothing invented: no names, quotes, times or numbers that are not in the notes.',
        '- The title is specific, not "Exciting news".',
        '- The body thanks the bakery and says when the next one is.',
        '- Plain, warm, no hype.',
      ].join('\n'),
    }),
    draftCase({
      id: 'draft/closure-notice',
      description: 'A short practical notice: the key facts lead.',
      collections,
      input: { targetCollection: 'posts', notes: 'Office closed Thursday Nov 27 and Friday Nov 28 for Thanksgiving. Back Monday Dec 1. Urgent requests: email help@democo.example.' },
      expect: { excerpt: underExcerptLimit, title: /clos|thanksgiving|holiday/i },
      judge: [
        'A short closure notice.',
        '- States the closed days (Thursday Nov 27 and Friday Nov 28), the reopening (Monday Dec 1) and the email for urgent requests, all correctly.',
        '- Short: a notice, not an essay. No invented details such as opening hours or phone numbers.',
      ].join('\n'),
    }),
    editCase({
      id: 'edit/add-faq',
      description: 'Add a section where asked, keep the rest of the page as it was.',
      collections,
      seed: {
        pages: [
          {
            id: 'pg1',
            title: 'Visit us',
            slug: 'visit',
            layout: [
              { id: 'b1', blockType: 'hero', heading: 'Visit us', text: 'Open every weekday, 9 to 5.' },
              { id: 'b2', blockType: 'richText', content: lexical('We are at 12 Market Street, across from the library.') },
            ],
          },
        ],
      },
      input: { targetCollection: 'pages', targetId: 'pg1', instruction: 'Add an FAQ below the hero with three questions about parking.' },
      expect: {
        layout: (value: unknown) => {
          const blocks = Array.isArray(value) ? (value as { blockType?: string; items?: unknown[] }[]) : []
          if (blocks[0]?.blockType !== 'hero') return 'the hero is no longer first'
          if (blocks[1]?.blockType !== 'faq') return `section 2 is ${blocks[1]?.blockType ?? 'missing'}, not the FAQ`
          if (blocks[1].items?.length !== 3) return `the FAQ has ${blocks[1].items?.length ?? 0} questions, not 3`
          if (!blocks.some((b) => b.blockType === 'richText')) return 'the address section was dropped'
          return true
        },
      },
      judge: [
        'Edit a page: add an FAQ about parking below the hero.',
        '- Three sensible parking questions. The page gives an address (12 Market Street, across from the library) but no parking facts, so the agent must not invent prices, capacities, hours or rules. Facts it cannot know belong in square-bracket placeholders for the editor, e.g. "[Where to park]"; that is the expected behaviour, not a flaw. Answers that use what the page does say (the address) are better.',
        '- The hero and the address section are kept as they were.',
      ].join('\n'),
    }),
  ]
}
