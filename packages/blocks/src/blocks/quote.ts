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
