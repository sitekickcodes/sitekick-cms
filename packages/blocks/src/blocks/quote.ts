import type { Block } from 'payload'

import { blockGroups } from '../groups'

/**
 * Quote: one pull quote. Plain text, not rich text, because a pull quote is
 * one voice speaking, not formatted copy.
 */
export const quote = (): Block => ({
  slug: 'quote',
  interfaceName: 'QuoteBlock',
  labels: { singular: 'Quote', plural: 'Quotes' },
  admin: { group: blockGroups.sections },
  // Read by agents (Edit with words) when they choose and fill sections; a site's agent/blocks/quote.md replaces it.
  custom: { guide: 'One voice from a real person: a customer, a partner, the founder. Short (one to three sentences) with a name and role. Never invent a quote or attribute one; ask for it with a placeholder instead. One per page, two at most on long pages.' },
  fields: [
    {
      name: 'quote',
      type: 'textarea',
      required: true,
      admin: { description: 'No quotation marks needed; the design adds them.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'attribution', type: 'text', label: 'Who said it' },
        { name: 'role', type: 'text', admin: { description: 'e.g. “Customer since 2019”. Blank = none.' } },
      ],
    },
  ],
})
