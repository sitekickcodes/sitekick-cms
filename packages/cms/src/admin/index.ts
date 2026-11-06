/**
 * Every admin component the plugin references by import-map path lives here as
 * `@sitekick/cms/admin#<Name>`. Client components carry 'use client' in their own file.
 */
// Conventions
export { AutoRowLabel, BlockRowLabel } from './RowLabel'
export { RelationshipCell } from './RelationshipCell'
export { MetaImageWithPreview, UploadPreview } from './UploadPreview'
export { CallLink, EmailLink, OpenLink } from './OpenLink'
export { SEODescription, SEOImage, SEOOverview, SEOPreview, SEOTitle } from './SEOFields'
export { SEOAutofill, SEOAutofillNote } from './SEOAutofill'
export { StatusCell, StatusTag, Tag } from './StatusTag'
export { CheckboxesField } from './CheckboxesField'
// Recipes
export { TranslationHint } from './TranslationHint'
export { SubmissionAnswers } from './forms/SubmissionAnswers'
export { SubmissionsCard } from './forms/SubmissionsCard'
// Auth and users
export { AuthView } from './AuthView'
export { Icon } from './Icon'
export { InviteButton } from './InviteButton'
export { InviteUser } from './InviteUser'
export { Logo } from './Logo'
export { SetPassword } from './SetPassword'
export { SigningIn } from './SigningIn'
// Help
export { HelpProvider, useHelp } from './HelpProvider'
export { HelpView } from './HelpView'
export { HelpPreviewButton } from './HelpPreviewButton'
// Dashboard, and the pieces a site's own cards are built from
export { Dashboard } from './Dashboard'
export { Card as DashboardPanel, Empty as DashboardEmpty } from './dashboard/Card'
export { Rows as DashboardRows } from './dashboard/Rows'
export type { CardContext as DashboardCardProps, Row as DashboardRow } from './dashboard/data'
// Sidebar
export { Nav } from './Nav'
export { NavClient, NavHeader } from './NavClient'

export { CommandPalette } from './CommandPalette'
export { ProposalReview } from './review/ProposalReview'
export { RunReview } from './review/RunReview'
export { InboxView } from './review/InboxView'
export { UsageView } from './review/UsageView'
// Lists
export { BoardLink } from './board/BoardLink'
export { BoardView } from './board/BoardView'
// Agent buttons (placed by agent/ui.ts from the contract)
export { AltTextButton } from './agents/AltTextButton'
export { DraftButton } from './agents/DraftButton'
export { EditButton } from './agents/EditButton'
export { EnrichButton } from './agents/EnrichButton'
