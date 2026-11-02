import type { Tone } from '../admin/StatusTag'

export type StatusMap = Record<string, { label: string; tone: Tone }>

/**
 * A list-view Cell that shows a select's value as a coloured Tag instead of
 * grey text, so a column of statuses scans at a glance:
 *
 *   admin: { components: { Cell: statusCell({ won: { label: 'Won', tone: 'success' } }) } }
 */
export const statusCell = (map: StatusMap) => ({ path: '@sitekick/cms/admin#StatusCell', clientProps: { map } })
