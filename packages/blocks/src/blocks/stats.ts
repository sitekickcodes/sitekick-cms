import type { Block } from 'payload'

import { eyebrowField, headingField, surfaceField } from '../fields'
import { blockGroups } from '../groups'

/**
 * Stats: a row of headline numbers. Designed for 2–4 figures, so the row
 * can't grow into a strip that collapses on a phone.
 */
export const stats = (): Block => ({
  slug: 'stats',
  interfaceName: 'StatsBlock',
  labels: { singular: 'Stats', plural: 'Stats sections' },
  admin: { group: blockGroups.sections },
  // Read by agents (Edit with words) when they choose and fill sections; a site's agent/blocks/stats.md replaces it.
  custom: { guide: 'Proof in numbers: 2 to 4 real figures with short labels ("120 trees planted"). Only facts the editor gave or the site already states; never invent a number. Works best after a claim it backs up.' },
  fields: [
    eyebrowField(),
    headingField(),
    {
      name: 'items',
      type: 'array',
      label: 'Figures',
      labels: { singular: 'Figure', plural: 'Figures' },
      minRows: 2,
      maxRows: 4,
      fields: [
        {
          name: 'value',
          type: 'text',
          required: true,
          admin: { description: 'Formatted as it should read: “12,000+”, “81%”, “3×”.' },
        },
        { name: 'label', type: 'text', required: true },
      ],
    },
    surfaceField({ options: ['light', 'soft', 'dark'] }),
  ],
})
