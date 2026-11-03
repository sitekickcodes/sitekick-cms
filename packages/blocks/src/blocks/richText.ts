import type { Block } from 'payload'

import { blockGroups } from '../groups'
import { editorConfig, type EditorOptions } from '../lexical'

/** Text: the shared rich-text section, with formatting, links and images. */
export const richText = (options: EditorOptions = {}): Block => ({
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Text', plural: 'Text sections' },
  admin: { group: blockGroups.basics },
  fields: [
    { name: 'content', type: 'richText', editor: editorConfig(options), required: true },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'narrow',
      options: [
        { label: 'Narrow (reading width)', value: 'narrow' },
        { label: 'Contained', value: 'contained' },
      ],
    },
  ],
})
