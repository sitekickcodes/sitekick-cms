import type { CollectionSlug, Field, UploadCollectionSlug } from 'payload'

import type { Surface } from './types'

/**
 * Field builders shared by the blocks. Collection slugs are options so a
 * client app with `images` instead of `media` can still use the library.
 */
export type FieldOptions = {
  /** Upload collection for images. Default `media`. */
  media?: UploadCollectionSlug
  /** Collection that internal links point at. Default `pages`. */
  pages?: CollectionSlug
}

export const defaultFieldOptions = { media: 'media', pages: 'pages' } as const

type Sibling = { type?: unknown } | undefined

/**
 * One link: label, then a page on this site or a URL. A radio rather than two
 * optional fields so a link can't point both ways, or nowhere.
 */
export const linkFields = ({ pages = defaultFieldOptions.pages }: FieldOptions = {}): Field[] => [
  {
    name: 'label',
    type: 'text',
    required: true,
    admin: { description: 'The text on the link or button.' },
  },
  {
    type: 'row',
    fields: [
      {
        name: 'type',
        type: 'radio',
        defaultValue: 'page',
        options: [
          { label: 'Page on this site', value: 'page' },
          { label: 'URL', value: 'url' },
        ],
        admin: { layout: 'horizontal' },
      },
      { name: 'newTab', type: 'checkbox', label: 'Open in a new tab' },
    ],
  },
  {
    name: 'page',
    type: 'relationship',
    relationTo: pages,
    admin: { condition: (_data, sibling: Sibling) => sibling?.type !== 'url' },
    validate: (value: unknown, { siblingData }: { siblingData?: unknown }) =>
      (siblingData as Sibling)?.type === 'url' || value ? true : 'Pick a page, or switch the link to a URL.',
  },
  {
    name: 'href',
    type: 'text',
    admin: {
      condition: (_data, sibling: Sibling) => sibling?.type === 'url',
      description: 'Full address (https://…) or a path on this site (/contact).',
    },
    validate: (value: unknown, { siblingData }: { siblingData?: unknown }) =>
      (siblingData as Sibling)?.type !== 'url' || (typeof value === 'string' && value.trim()) ? true : 'Enter the address the link goes to.',
  },
]

/**
 * A row of buttons. Capped so a section can't grow a button row that wraps and
 * breaks the band. `minRows` where a block is meaningless without one.
 */
export const buttonsField = ({
  name = 'buttons',
  label = 'Buttons',
  minRows,
  maxRows = 2,
  ...options
}: FieldOptions & { name?: string; label?: string; minRows?: number; maxRows?: number } = {}): Field => ({
  name,
  type: 'array',
  label,
  labels: { singular: 'Button', plural: 'Buttons' },
  ...(minRows ? { minRows } : {}),
  maxRows,
  fields: [
    ...linkFields(options),
    {
      name: 'style',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary (filled)', value: 'primary' },
        { label: 'Secondary (outline)', value: 'secondary' },
      ],
    },
  ],
})

/**
 * Background treatment for a band. Named surfaces, never free colours: the
 * renderer maps them to design tokens so every client site stays on-system.
 */
export const surfaceField = ({
  defaultValue = 'light',
  options = ['light', 'soft', 'dark', 'accent'],
}: { defaultValue?: Surface; options?: Surface[] } = {}): Field => {
  const labels: Record<Surface, string> = {
    light: 'Light',
    soft: 'Soft (tinted)',
    dark: 'Dark',
    accent: 'Accent colour',
  }
  return {
    name: 'surface',
    type: 'select',
    defaultValue,
    options: options.map((value) => ({ label: labels[value], value })),
    admin: { description: 'Background for this section.' },
  }
}

/** Small label above a heading, e.g. "Our story". */
export const eyebrowField = (): Field => ({
  name: 'eyebrow',
  type: 'text',
  admin: { description: 'Small label above the heading, e.g. “Our story”. Blank = none.' },
})

/** A section heading; required where a block has nothing else to lead with. */
export const headingField = (required = false): Field => ({
  name: 'heading',
  type: 'text',
  required,
  admin: { description: required ? undefined : 'Blank = no heading for this section.' },
})

/** One or two sentences under a heading. */
export const introField = (name = 'intro'): Field => ({
  name,
  type: 'textarea',
  admin: { description: 'One or two sentences under the heading. Blank = none.' },
})

/** An image from the media library. */
export const imageField = ({
  name = 'image',
  required = false,
  description,
  media = defaultFieldOptions.media,
}: FieldOptions & { name?: string; required?: boolean; description?: string } = {}): Field => ({
  name,
  type: 'upload',
  relationTo: media,
  required,
  admin: { description },
})
