/**
 * The admin components this module contributes. Each is referenced by
 * import-map path `@sitekick/cms/admin#<exportName>` and must be exported
 * from `src/admin/index.ts` under that name:
 *
 *   export { Nav } from './Nav'
 *
 * `NavClient` and `NavHeader` are imported directly by `Nav.tsx`; they are
 * listed so the import map can be generated for them too if a config ever
 * wants to mount them on their own.
 */
export const navComponents = [
  { exportName: 'Nav', file: './Nav', kind: 'server' },
  { exportName: 'NavClient', file: './NavClient', kind: 'client' },
  { exportName: 'NavHeader', file: './NavClient', kind: 'client' },
] as const

export type NavComponentName = (typeof navComponents)[number]['exportName']
