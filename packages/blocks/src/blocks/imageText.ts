import type { Block } from 'payload'

import { eyebrowField, headingField, imageField, linkFields, surfaceField } from '../fields'
import { blockGroups } from '../groups'
import { editorConfig, type EditorOptions } from '../lexical'

/**
 * Image + text: the two-column editorial row. The image side is a designed
 * slot; the only layout choice is which side it sits on.
 */
export const imageText = (options: EditorOptions = {}): Block => ({
  slug: 'imageText',
  interfaceName: 'ImageTextBlock',
  labels: { singular: 'Image + text', plural: 'Image + text sections' },
  admin: { group: blockGroups.sections },
  fields: [
    imageField({ description: 'The photo beside the text. Blank = text only.', ...options }),
    eyebrowField(),
    headingField(),
    { name: 'content', type: 'richText', editor: editorConfig(options) },
    {
      // An array capped at one, not an optional group: a group's required
      // label would always validate, even with no link intended.
      name: 'link',
      type: 'array',
      label: 'Link under the text',
      labels: { singular: 'Link', plural: 'Links' },
      maxRows: 1,
      fields: linkFields(options),
    },
    {
      type: 'row',
      fields: [
        {
          name: 'imagePosition',
          type: 'select',
          defaultValue: 'right',
          options: [
            { label: 'Image right', value: 'right' },
            { label: 'Image left', value: 'left' },
          ],
        },
        surfaceField({ options: ['light', 'soft'] }),
      ],
    },
  ],
})
