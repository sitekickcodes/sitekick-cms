import type { Access, CollectionConfig, CollectionSlug, Endpoint } from 'payload'
import {
  BlockquoteFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { isAdmin, isUserAccount } from '../access'
import { readHelpArticles } from './articles'
import { DEFAULT_HELP_TOPICS, HELP_PARAM, HELP_PREVIEW_PARAM, HELP_SLUG } from './shared'

export type HelpCollectionOptions = {
  /** Collection slug. Default `help-articles`. */
  slug?: string
  /** Topic choices. Default: Getting started, Content, Media, Account. */
  topics?: readonly string[]
  /** Upload collection articles may embed images from. Default `media`. */
  mediaSlug?: string
  /** Users collection slug. Default `users`. */
  usersSlug?: string
  /** Who writes articles and sees drafts. Default: the `admin` role. */
  canManage?: (user: unknown) => boolean
  /** The admin route, for the preview link. Default `/admin`. */
  adminRoute?: string
}

/**
 * The `help-articles` collection behind the help drawer: drafts, drag order,
 * a topic, a stable slug with previous links, related reads and a preview
 * that opens the draft inside the drawer.
 */
export function helpArticlesCollection(options: HelpCollectionOptions = {}): CollectionConfig {
  const {
    slug = HELP_SLUG,
    topics = DEFAULT_HELP_TOPICS,
    mediaSlug = 'media',
    usersSlug = 'users',
    canManage = isAdmin,
    adminRoute = '/admin',
  } = options

  /** Signed-in people read published articles; managers also read drafts. */
  const read: Access = ({ req: { user } }) => {
    if (!isUserAccount(user, usersSlug)) return false
    return canManage(user) ? true : { _status: { equals: 'published' } }
  }
  const manage: Access = ({ req: { user } }) => isUserAccount(user, usersSlug) && canManage(user)

  /** One request for the whole drawer: published articles, images resolved. */
  const reader: Endpoint = {
    path: '/reader',
    method: 'get',
    handler: async (req) => {
      if (!isUserAccount(req.user, usersSlug)) {
        return Response.json({ error: 'Sign in to read help.' }, { status: 401 })
      }
      const preview = typeof req.query?.preview === 'string' ? req.query.preview : undefined
      if (preview && !canManage(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      return Response.json(
        { articles: await readHelpArticles(req, { slug, preview }) },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    },
  }

  return {
    slug,
    labels: { singular: 'Help article', plural: 'Help articles' },
    // Topic labels ("Content & media") are not valid GraphQL enum names and
    // would break schema generation for every collection. The drawer reads
    // REST through its own endpoint; nothing queries help over GraphQL.
    graphQL: false,
    orderable: true,
    defaultSort: '_order',
    admin: {
      useAsTitle: 'title',
      group: 'Admin',
      hidden: ({ user }) => !canManage(user),
      defaultColumns: ['title', 'topic', '_status', 'updatedAt'],
      description:
        'The articles shown under Help in the sidebar. Write an article, choose a topic, and publish when it is ready. Drag to set the reading order.',
      components: { edit: { PreviewButton: '@sitekick/cms/admin#HelpPreviewButton' } },
      preview: (doc) =>
        `${adminRoute}?${HELP_PARAM}=${encodeURIComponent(String(doc.slug))}&${HELP_PREVIEW_PARAM}=${encodeURIComponent(String(doc.id))}`,
    },
    access: { read, create: manage, update: manage, delete: manage, readVersions: manage },
    versions: { drafts: true },
    endpoints: [reader],
    fields: [
      { name: 'title', type: 'text', required: true },
      {
        name: 'slug',
        type: 'slug',
        useAsSlug: 'title',
        admin: { description: "The article's shared link. Keep it when changing the title so existing links still work." },
      },
      {
        name: 'topic',
        type: 'select',
        options: [...topics],
        required: true,
        defaultValue: topics[0],
        index: true,
        admin: { position: 'sidebar' },
      },
      {
        name: 'summary',
        type: 'textarea',
        admin: { description: 'A short description to help people find this article in search.' },
      },
      {
        name: 'body',
        label: 'Article',
        type: 'richText',
        required: true,
        admin: {
          description: 'Use headings for sections, numbered lists for steps, and quotes for helpful notes. You can add links and images.',
        },
        editor: lexicalEditor({
          features: () => [
            ParagraphFeature(),
            HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
            BoldFeature(),
            ItalicFeature(),
            UnderlineFeature(),
            LinkFeature({ enabledCollections: [] }),
            OrderedListFeature(),
            UnorderedListFeature(),
            BlockquoteFeature(),
            HorizontalRuleFeature(),
            UploadFeature({ collections: { [mediaSlug]: { fields: [] } } }),
            FixedToolbarFeature(),
          ],
        }),
      },
      {
        name: 'related',
        label: 'Related articles',
        type: 'relationship',
        relationTo: slug as CollectionSlug,
        hasMany: true,
        admin: { description: 'Optional next reads shown at the end of this article. Only published articles appear to readers.' },
      },
      {
        name: 'aliases',
        label: 'Previous links',
        type: 'array',
        admin: { initCollapsed: true, description: 'Optional old article slugs that should continue opening this article.' },
        fields: [{ name: 'slug', type: 'text', required: true }],
      },
    ],
  }
}
