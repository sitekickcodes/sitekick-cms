import type { Block } from 'payload'

import { eyebrowField, headingField, imageField, linkFields, surfaceField, type FieldOptions } from '../fields'
import { blockGroups } from '../groups'
import type { CardIcon } from '../types'

/** The icons an editor can pick for a card without a photo. Rendered with lucide. */
export const cardIcons: { label: string; value: CardIcon }[] = [
  { label: 'Sparkles', value: 'sparkles' },
  { label: 'Star', value: 'star' },
  { label: 'Heart', value: 'heart' },
  { label: 'Check', value: 'check' },
  { label: 'Bolt', value: 'zap' },
  { label: 'Shield', value: 'shield' },
  { label: 'Globe', value: 'globe' },
  { label: 'Mail', value: 'mail' },
  { label: 'Phone', value: 'phone' },
  { label: 'Map pin', value: 'map-pin' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'People', value: 'users' },
  { label: 'Book', value: 'book-open' },
  { label: 'Lightbulb', value: 'lightbulb' },
  { label: 'Megaphone', value: 'megaphone' },
  { label: 'Arrow', value: 'arrow-right' },
]

/**
 * Card grid: hand-authored cards (services, programmes, resources). For
 * one-off sets only; a list of records belongs in its own collection.
 */
export const cardGrid = (options: FieldOptions = {}): Block => ({
  slug: 'cardGrid',
  interfaceName: 'CardGridBlock',
  labels: { singular: 'Card grid', plural: 'Card grids' },
  admin: { group: blockGroups.sections },
  fields: [
    eyebrowField(),
    headingField(),
    {
      name: 'cards',
      type: 'array',
      minRows: 2,
      maxRows: 12,
      labels: { singular: 'Card', plural: 'Cards' },
      fields: [
        { name: 'title', type: 'text', required: true },
        imageField({ description: 'Photo across the top of the card. Blank = no photo.', ...options }),
        {
          name: 'icon',
          type: 'select',
          options: cardIcons,
          admin: { description: 'A small icon above the title, for a card without a photo. Blank = none.' },
        },
        { name: 'text', type: 'textarea' },
        {
          name: 'link',
          type: 'array',
          label: 'Links',
          labels: { singular: 'Link', plural: 'Links' },
          maxRows: 2,
          fields: linkFields(options),
          admin: {
            description:
              'One link makes the whole card clickable. Add a second and the cards show buttons instead: the first link as a button, the second as a text link beside it.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'columns',
          type: 'select',
          defaultValue: 'three',
          options: [
            { label: 'Two across', value: 'two' },
            { label: 'Three across', value: 'three' },
            { label: 'Four across', value: 'four' },
          ],
        },
        surfaceField({ options: ['light', 'soft'] }),
      ],
    },
  ],
})
