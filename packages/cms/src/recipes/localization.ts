import type { CollectionConfig, Config, Field, GlobalConfig, Plugin } from 'payload'

/**
 * Localisation, as a recipe: content in more than one language, translated in place.
 *
 *   plugins: [sitekickCMS({ ... }), localization({ locales: ['en', 'es'] })]
 *
 * Payload's localisation does the storage and the admin's locale switcher; this decides which
 * fields are translated, so a site doesn't hand-mark `localized: true` on dozens of fields.
 * Words are translated; structure is shared. Text, textarea and rich text fields are localised
 * wherever they sit, inside groups, arrays and blocks too, so a translator fills in the same
 * page in another language instead of rebuilding it. Everything else stays shared across
 * languages: slugs (one URL per page, the locale goes in the path), dates, numbers, choices,
 * relationships, images, links, emails and phone numbers.
 *
 * Which content: every collection in the sidebar and every global, except accounts and
 * Sitekick's own (help, proposals, runs). `collections` and `globals` narrow it. A field that
 * sets `localized` itself, or `custom.sitekick.localized: false`, keeps its choice.
 *
 * Adding it changes the database (translated values move to `_locales` tables), so create a
 * migration. Existing content becomes the default locale's.
 */
export type LocaleInput = string | { code: string; label: string }

export type LocalizationOptions = {
  locales: LocaleInput[]
  /** Default: the first locale. */
  defaultLocale?: string
  /** Show the default locale's value when a translation is missing. Default true. */
  fallback?: boolean
  /** Only these collection slugs. Default: every eligible collection. */
  collections?: string[]
  /** Only these global slugs. Default: every global. */
  globals?: string[]
}

/** Never translated: Sitekick's own collections. Accounts and `payload-*` are skipped too. */
const OWN = ['help-articles', 'proposals', 'runs']
const TRANSLATED = new Set(['text', 'textarea', 'richText'])
/** Text fields that hold an identifier or an address, not words (the block library's `href`). */
const SHARED_NAMES = new Set(['slug', 'href', 'url'])

export const localization =
  (options: LocalizationOptions): Plugin =>
  (config: Config): Config => {
    const locales = options.locales.map((l) => (typeof l === 'string' ? { code: l, label: LABELS[l] ?? l.toUpperCase() } : l))
    if (!locales.length) throw new Error('localization: give at least one locale')
    const defaultLocale = options.defaultLocale ?? locales[0]!.code
    if (!locales.some((l) => l.code === defaultLocale)) throw new Error(`localization: defaultLocale "${defaultLocale}" is not in locales`)

    return {
      ...config,
      localization: config.localization || { locales, defaultLocale, fallback: options.fallback ?? true },
      collections: (config.collections ?? []).map((c) => (collectionWanted(c, options) ? { ...c, fields: localizeFields(c.fields) } : c)),
      globals: (config.globals ?? []).map((g) => (globalWanted(g, options) ? { ...g, fields: localizeFields(g.fields) } : g)),
    }
  }

export function collectionWanted(collection: CollectionConfig, options: Pick<LocalizationOptions, 'collections'>): boolean {
  if (options.collections) return options.collections.includes(collection.slug)
  const custom = (collection.custom as { sitekick?: { private?: boolean } } | undefined)?.sitekick
  return !collection.auth && !custom?.private && !collection.slug.startsWith('payload-') && !OWN.includes(collection.slug)
}

function globalWanted(global: GlobalConfig, options: Pick<LocalizationOptions, 'globals'>): boolean {
  return options.globals ? options.globals.includes(global.slug) : true
}

/** Mark the words in a field tree as localised; see the module comment for what counts. */
export function localizeFields(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    const own = (field as { custom?: { sitekick?: { localized?: boolean } } }).custom?.sitekick?.localized
    if (own === false) return field
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'richText':
        if (field.localized !== undefined || SHARED_NAMES.has(field.name) || !TRANSLATED.has(field.type)) return field
        // A unique value can't differ per locale without breaking its index.
        if ('unique' in field && field.unique) return field
        return { ...field, localized: true } as Field
      case 'group':
      case 'row':
      case 'collapsible':
      case 'array':
        if ('localized' in field && field.localized !== undefined) return field
        return { ...field, fields: localizeFields(field.fields) } as Field
      case 'tabs':
        return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: localizeFields(tab.fields) })) }
      case 'blocks':
        if (field.localized !== undefined) return field
        // Blocks given by slug (config.blocks) are left as they are; walk them there if needed.
        return { ...field, blocks: field.blocks.map((block) => (typeof block === 'string' ? block : { ...block, fields: localizeFields(block.fields) })) } as Field
      default:
        return field
    }
  })
}

/** Names for common codes, so `locales: ['en', 'es']` reads well in the switcher. */
const LABELS: Record<string, string> = {
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  tl: 'Tagalog',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  zh: '中文',
}
