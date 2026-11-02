import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import { groupsConvention } from './groups'
import { previewConvention } from './preview'
import { relationshipCellsConvention } from './relationshipCells'
import { rowLabelsConvention } from './rowLabels'
import { seoConvention } from './seo'
import { slugsConvention } from './slugs'
import { tabsConvention } from './tabs'
import { uploadPreviewConvention } from './uploadPreview'

export type ConventionKey = keyof NonNullable<SitekickCMSOptions['conventions']> | 'groups' | 'preview'

/**
 * Every convention, in the order it should run. Keys match
 * `options.conventions`; `groups` and `preview` have no switch yet and
 * always run.
 *
 *   groups            cosmetic, first so later steps see the final admin.group
 *   tabs              Content / History tabs on every entity
 *   slugs             slug hooks before SEO reads the slug
 *   seo               adds the meta tab and its image field
 *   rowLabels         walks arrays, including any the SEO tab added
 *   relationshipCells list-view cells
 *   uploadPreview     last of the walkers: it must see the SEO image field
 *   preview           Preview buttons from custom.sitekick.seo.pathPrefix
 */
export const conventionManifest: { key: ConventionKey; plugin: (options: SitekickCMSOptions) => Plugin }[] = [
  { key: 'groups', plugin: groupsConvention },
  { key: 'tabs', plugin: tabsConvention },
  { key: 'slugs', plugin: slugsConvention },
  { key: 'seo', plugin: seoConvention },
  { key: 'rowLabels', plugin: rowLabelsConvention },
  { key: 'relationshipCells', plugin: relationshipCellsConvention },
  { key: 'uploadPreview', plugin: uploadPreviewConvention },
  { key: 'preview', plugin: previewConvention },
]
