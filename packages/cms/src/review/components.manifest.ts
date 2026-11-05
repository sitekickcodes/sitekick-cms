/**
 * Admin components the review module adds. Each is referenced from config as
 * `@sitekick/cms/admin#<Name>` and must be re-exported from `src/admin/index.ts`
 * from the module listed here (paths relative to `src/admin/`).
 */
export const reviewComponents = {
  /** Server. `views.edit.default` of `proposals`: the per-field diff with Accept/Reject. */
  ProposalReview: './review/ProposalReview',
  /** Server. `views.edit.default` of `runs`: the timeline, the question, Cancel and Retry. */
  RunReview: './review/RunReview',
  /** Server view at `/admin/inbox`: proposals to review and runs in progress. */
  InboxView: './review/InboxView',
  /** Server view at `/admin/usage`: what the agents cost, admins only. */
  UsageView: './review/UsageView',
} as const

export type ReviewComponentName = keyof typeof reviewComponents
