/**
 * Headings for the "add section" picker. Three groups stay legible as the
 * library grows; a flat list of block names gets the wrong one picked.
 */
export const blockGroups = {
  basics: 'Basics',
  sections: 'Designed sections',
  conversion: 'Calls to action',
} as const

export type BlockGroup = (typeof blockGroups)[keyof typeof blockGroups]
