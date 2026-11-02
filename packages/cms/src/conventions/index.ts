import type { Plugin } from 'payload'

import type { SitekickCMSOptions } from '../types'
import { conventionManifest } from './manifest'

/** Field walkers and hooks applied to every collection and global, in manifest order. */
export const conventions = (options: SitekickCMSOptions): Plugin[] => {
  const on: Record<string, boolean> = {
    tabs: true, rowLabels: true, relationshipCells: true, uploadPreview: true, seo: true, slugs: true,
    groups: true, preview: true,
    ...options.conventions,
  }
  return conventionManifest.filter(({ key }) => on[key] !== false).map(({ plugin }) => plugin(options))
}

export { conventionManifest } from './manifest'
