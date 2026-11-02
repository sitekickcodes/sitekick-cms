/**
 * Admin components the dashboard module adds. Each is referenced from config
 * as `@sitekick/cms/admin#<Name>` and must be re-exported from
 * `src/admin/index.ts` from the module listed here.
 */
export const dashboardComponents = {
  /** Server view for `admin.components.views.dashboard`. */
  Dashboard: './Dashboard',
} as const

export type DashboardComponentName = keyof typeof dashboardComponents
