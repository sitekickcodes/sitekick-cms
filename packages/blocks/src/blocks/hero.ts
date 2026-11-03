import type { Block } from 'payload'

import { buttonsField, eyebrowField, imageField, surfaceField, type FieldOptions } from '../fields'
import { blockGroups } from '../groups'

/** Hero: the top-of-page band. `layoutField` caps it at one per page. */
export const hero = (options: FieldOptions = {}): Block => ({
  slug: 'hero',
  interfaceName: 'HeroBlock',
  labels: { singular: 'Hero', plural: 'Heroes' },
  admin: { group: blockGroups.sections },
  fields: [
    eyebrowField(),
    {
      name: 'heading',
      type: 'textarea',
      required: true,
      admin: { description: 'Renders large. Line breaks are kept.' },
    },
    {
      name: 'subheading',
      type: 'textarea',
      admin: { description: 'One or two sentences under the heading. Blank = none.' },
    },
    buttonsField({ maxRows: 2, ...options }),
    imageField({ description: 'Feature image under the heading. Blank = text only.', ...options }),
    {
      type: 'row',
      fields: [
        surfaceField({ defaultValue: 'light', options: ['light', 'accent', 'dark'] }),
        {
          name: 'alignment',
          type: 'select',
          defaultValue: 'center',
          options: [
            { label: 'Centred', value: 'center' },
            { label: 'Left', value: 'left' },
          ],
        },
      ],
    },
  ],
})
