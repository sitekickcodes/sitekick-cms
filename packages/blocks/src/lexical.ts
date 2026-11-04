import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { Block } from 'payload'

import { defaultFieldOptions, type FieldOptions } from './fields'

export type EditorOptions = FieldOptions & {
  /** Blocks an editor can drop into the text, e.g. a video embed. Default none. */
  blocks?: Block[]
  /** Blocks that sit inline with text. Default none. */
  inlineBlocks?: Block[]
}

/**
 * One editor for every rich-text field. Deliberately small: headings, links to
 * pages or URLs, lists, a quote, a rule and an image. Anything else is a block.
 */
export const editorConfig = ({
  blocks = [],
  inlineBlocks = [],
  media = defaultFieldOptions.media,
  pages = defaultFieldOptions.pages,
}: EditorOptions = {}): ReturnType<typeof lexicalEditor> =>
  lexicalEditor({
    admin: {
      hideAddBlockButton: true,
      hideDraggableBlockElement: true,
      hideInsertParagraphAtEnd: true,
    },
    features: () => [
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
      BoldFeature(),
      ItalicFeature(),
      UnderlineFeature(),
      LinkFeature({ enabledCollections: [pages] }),
      UnorderedListFeature(),
      OrderedListFeature(),
      BlockquoteFeature(),
      HorizontalRuleFeature(),
      UploadFeature({ collections: { [media]: { fields: [] } } }),
      ...(blocks.length || inlineBlocks.length ? [BlocksFeature({ blocks, inlineBlocks })] : []),
      FixedToolbarFeature(),
    ],
  })
