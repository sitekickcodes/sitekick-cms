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
  // Read by agents (Edit with words) when they choose and fill sections; a site's agent/blocks/faq.md replaces it.
  custom: { guide: 'Answers to the questions readers actually ask, often near the end before the closing call to action. Three to eight questions, each answer a few sentences. Good for price, time, eligibility and practical details.' },
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
