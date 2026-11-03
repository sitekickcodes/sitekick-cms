import type { Block } from 'payload'

import { buttonsField, surfaceField, type FieldOptions } from '../fields'
import { blockGroups } from '../groups'

/**
 * Call to action: the closing band. At least one button is required because
 * a CTA with no link is the most common broken-page case there is.
 */
export const cta = (options: FieldOptions = {}): Block => ({
  slug: 'cta',
  interfaceName: 'CtaBlock',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  admin: { group: blockGroups.conversion },
  fields: [
    { name: 'heading', type: 'text', required: true },
    {
      name: 'body',
      type: 'textarea',
      admin: { description: 'A sentence or two under the heading. Blank = none.' },
    },
    buttonsField({ minRows: 1, maxRows: 2, ...options }),
    surfaceField({ defaultValue: 'dark', options: ['dark', 'accent'] }),
  ],
})
