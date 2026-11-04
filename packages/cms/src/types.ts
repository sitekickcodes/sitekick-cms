import type { CollectionConfig, GlobalConfig } from 'payload'

/** How a client identifies itself in the admin. Everything else is the Sitekick theme. */
export type SiteIdentity = {
  /** Shown in the sidebar brand row, the tab title and emails. */
  name: string
  /** Public URL of the site. Used for preview links and SEO previews. */
  url?: string
  /** Path or URL to an SVG/PNG logo. Omitted = a wordmark of `name`. */
  logo?: string
  /** Square icon for the favicon and the collapsed sidebar. Omitted = `logo`. */
  icon?: string
  /** Accent colour (hex). Drives buttons, links and focus. Omitted = Sitekick teal. */
  accent?: string
}

/** One link in the sidebar. */
export type NavLink =
  | string
  | {
      /** Collection or global slug, or `view:<path>` for a custom admin view. */
      to: string
      label?: string
      /** Lucide icon name. */
      icon?: string
      /** Query string appended to a list, e.g. `?where[site][equals]=law`. */
      query?: string
    }

/** A titled area of links in the sidebar. */
export type NavArea = {
  label: string
  icon?: string
  links: NavLink[]
}

/** The sidebar, as data. Anything visible the arrangement omits lands under "More". */
export type NavArrangement = NavArea[]

/** Per-collection declaration of what agents may do. Lives at `custom.sitekick.agent`. */
export type AgentContract = {
  /** One line, for the LLM. */
  description?: string
  /** Fields agents may write. Everything else is read-only to agents. */
  writable?: string[]
  /** Fields agents may fill only when empty. */
  fillEmptyOnly?: string[]
  /** Whether agent writes land as proposals for review. */
  review?: 'required' | 'optional' | 'none'
  /** Free-form guidance appended to MCP notes. */
  notes?: string
  /**
   * Whole-document agents the admin offers here (needs the `agents` plugin
   * option). `enrich`: "Find details" on a saved document. `draft`: "Draft
   * from notes" beside Create new. `edit`: "Edit with words" on a saved
   * document with a writable blocks field.
   */
  actions?: AgentAction[]
}

export type AgentAction = 'enrich' | 'draft' | 'edit'

export type SitekickCustom = {
  sitekick?: {
    agent?: AgentContract
    /** Skip automatic SEO for this collection. */
    seo?: false | { pathPrefix?: string }
    /** Hide this collection from agents and the public catalog entirely. */
    private?: boolean
  }
}

export type SitekickCMSOptions = {
  site: SiteIdentity
  /** Sidebar arrangement. Omitted = derived from `admin.group` on each collection. */
  nav?: NavArrangement
  /** Which conventions to apply. All on by default. */
  conventions?: Partial<{
    /** Content / History tabs, API tab hidden. */
    tabs: boolean
    /** Array rows show a real title instead of "Item 01". */
    rowLabels: boolean
    /** Relationship list cells that never show "<No X>". */
    relationshipCells: boolean
    /** Click an image field to open the media drawer. */
    uploadPreview: boolean
    /** Meta title/description/image filled from content. */
    seo: boolean
    /** Slug from title; copies get -2, -3. */
    slugs: boolean
  }>
  /** Users collection slug. Default `users`. */
  usersSlug?: string
  /** Help drawer. Default on, backed by a `help-articles` collection. */
  help?: boolean
  /** Invite flow and set-password polish on the users collection. Default on. */
  invites?: boolean
  /**
   * Account email from the environment (AUTOSEND_API_KEY, EMAIL_FROM; see email/index.ts) when
   * the config sets no `email` adapter itself. `false` leaves Payload's default. Default on.
   */
  email?: false
  /** Dashboard home. Default on. */
  dashboard?: boolean
  /** Public read-only MCP server, llms.txt and OpenAPI. Default on. */
  publicAgentSurface?: boolean
  /**
   * Agent buttons in the admin: Find details, Draft from notes, Describe
   * image, Write search details. Off unless set, because the routes live in
   * the app (`createAgentRoutes` from @sitekick/agents, mounted at basePath).
   */
  agents?: { basePath?: string }
}

export type Entity = CollectionConfig | GlobalConfig
