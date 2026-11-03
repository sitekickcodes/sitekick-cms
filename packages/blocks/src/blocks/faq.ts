import type { Block } from 'payload'

import { eyebrowField, headingField } from '../fields'
import { blockGroups } from '../groups'
import { editorConfig, type EditorOptions } from '../lexical'

/** FAQ: an accordion of question/answer pairs. */
export const faq = (options: EditorOptions = {}): Block => ({
  slug: 'faq',
  interfaceName: 'FaqBlock',
  labels: { singular: 'FAQ', plural: 'FAQ sections' },
  admin: { group: blockGroups.sections },
  fields: [
    eyebrowField(),
    headingField(),
    {
      name: 'items',
      type: 'array',
      label: 'Questions',
      labels: { singular: 'Question', plural: 'Questions' },
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'richText', editor: editorConfig(options), required: true },
      ],
    },
  ],
})
