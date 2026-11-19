import type { Block } from 'payload'

import { blockGroups } from '../groups'
import { editorConfig, type EditorOptions } from '../lexical'

/** Text: the shared rich-text section, with formatting, links and images. */
export const richText = (options: EditorOptions = {}): Block => ({
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Text', plural: 'Text sections' },
  admin: { group: blockGroups.basics },
  // Read by agents (Edit with words) when they choose and fill sections; a site's agent/blocks/richText.md replaces it.
  custom: { guide: 'Running text: a story, an explanation, details that need paragraphs. Keep it to a few short paragraphs with ## subheadings; if it grows past a screen or two, the page needs more structure (image and text, an FAQ). Never three in a row.' },
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
