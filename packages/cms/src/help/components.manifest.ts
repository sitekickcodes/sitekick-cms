/**
 * Admin components the help module adds. Each is referenced from config as
 * `@sitekick/cms/admin#<Name>` and must be re-exported from `src/admin/index.ts`
 * from the module listed here.
 */
export const helpComponents = {
  /** Client. Wraps the admin; owns the drawer and the `?help=` launcher. */
  HelpProvider: './HelpProvider',
  /** Server view at `/admin/help`: redirects to `/admin?help=<id>`. */
  HelpView: './HelpView',
  /** Client. The Preview button on a help article, opening the draft in the drawer. */
  HelpPreviewButton: './HelpPreviewButton',
} as const

export type HelpComponentName = keyof typeof helpComponents
