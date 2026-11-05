/**
 * Lucide icons by name, as path data rather than `lucide-react` components:
 * the plugin keeps its dependency list to `payload` and `@payloadcms/ui`,
 * and inline SVG needs no client asset files (no /public, no masks). Each
 * entry is a list of shapes drawn on Lucide's 24×24 grid, stroked at 2 (the
 * sidebar sets 1.5). `NavClient` renders them; `iconForArea` picks one for an
 * area derived from a collection's `admin.group`, so a sidebar with no
 * `options.nav` still gets sensible icons.
 *
 * Shapes © Lucide contributors, ISC licence.
 */

export type IconShape =
  | ['path', string]
  | ['circle', number, number, number]
  | ['rect', number, number, number, number, number]

export const ICONS = {
  search: [
    ['circle', 11, 11, 8],
    ['path', 'm21 21-4.3-4.3'],
  ],
  'layout-dashboard': [
    ['rect', 3, 3, 7, 9, 1],
    ['rect', 14, 3, 7, 5, 1],
    ['rect', 14, 12, 7, 9, 1],
    ['rect', 3, 16, 7, 5, 1],
  ],
  globe: [
    ['circle', 12, 12, 10],
    ['path', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'],
    ['path', 'M2 12h20'],
  ],
  home: [
    ['path', 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'],
    [
      'path',
      'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    ],
  ],
  newspaper: [
    [
      'path',
      'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2',
    ],
    ['path', 'M18 14h-8'],
    ['path', 'M15 18h-5'],
    ['path', 'M10 6h8v4h-8V6Z'],
  ],
  'file-text': [
    ['path', 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'],
    ['path', 'M14 2v4a2 2 0 0 0 2 2h4'],
    ['path', 'M10 9H8'],
    ['path', 'M16 13H8'],
    ['path', 'M16 17H8'],
  ],
  users: [
    ['path', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'],
    ['circle', 9, 7, 4],
    ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'],
    ['path', 'M16 3.13a4 4 0 0 1 0 7.75'],
  ],
  'user-round': [['circle', 12, 8, 5], ['path', 'M20 21a8 8 0 0 0-16 0']],
  image: [
    ['rect', 3, 3, 18, 18, 2],
    ['circle', 9, 9, 2],
    ['path', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'],
  ],
  folder: [
    [
      'path',
      'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
    ],
  ],
  layers: [
    [
      'path',
      'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
    ],
    ['path', 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'],
    ['path', 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'],
  ],
  settings: [
    [
      'path',
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    ],
    ['circle', 12, 12, 3],
  ],
  calendar: [
    ['path', 'M8 2v4'],
    ['path', 'M16 2v4'],
    ['rect', 3, 4, 18, 18, 2],
    ['path', 'M3 10h18'],
  ],
  inbox: [
    ['path', 'M22 12h-6l-2 3h-4l-2-3H2'],
    [
      'path',
      'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    ],
  ],
  mail: [
    ['rect', 2, 4, 20, 16, 2],
    ['path', 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'],
  ],
  'message-square': [
    ['path', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  ],
  megaphone: [
    ['path', 'm3 11 18-5v12L3 14v-3z'],
    ['path', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  ],
  tag: [
    [
      'path',
      'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z',
    ],
    ['circle', 7.5, 7.5, 0.5],
  ],
  'map-pin': [
    [
      'path',
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    ],
    ['circle', 12, 10, 3],
  ],
  briefcase: [
    ['path', 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'],
    ['rect', 2, 6, 20, 14, 2],
  ],
  'shopping-bag': [
    ['path', 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'],
    ['path', 'M3 6h18'],
    ['path', 'M16 10a4 4 0 0 1-8 0'],
  ],
  link: [
    ['path', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'],
    ['path', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  ],
  'book-open': [
    ['path', 'M12 7v14'],
    [
      'path',
      'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
    ],
  ],
  'circle-help': [
    ['circle', 12, 12, 10],
    ['path', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'],
    ['path', 'M12 17h.01'],
  ],
  'life-buoy': [
    ['circle', 12, 12, 10],
    ['path', 'm4.93 4.93 4.24 4.24'],
    ['path', 'm14.83 9.17 4.24-4.24'],
    ['path', 'm14.83 14.83 4.24 4.24'],
    ['path', 'm9.17 14.83-4.24 4.24'],
    ['circle', 12, 12, 4],
  ],
  sparkles: [
    [
      'path',
      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    ],
  ],
  'chart-column': [
    ['path', 'M3 3v16a2 2 0 0 0 2 2h16'],
    ['path', 'M18 17V9'],
    ['path', 'M13 17V5'],
    ['path', 'M8 17v-3'],
  ],
  star: [
    [
      'path',
      'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
    ],
  ],
  pin: [
    ['path', 'M12 17v5'],
    [
      'path',
      'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
    ],
  ],
  'pin-off': [
    ['path', 'M12 17v5'],
    ['path', 'M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89'],
    ['path', 'm2 2 20 20'],
    ['path', 'M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11'],
  ],
  clock: [['circle', 12, 12, 10], ['path', 'M12 6v6l4 2']],
  'key-round': [
    [
      'path',
      'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
    ],
    ['circle', 16.5, 7.5, 0.5],
  ],
  'log-out': [
    ['path', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'],
    ['path', 'm16 17 5-5-5-5'],
    ['path', 'M21 12H9'],
  ],
  'chevron-down': [['path', 'm6 9 6 6 6-6']],
  'chevrons-up-down': [['path', 'm7 15 5 5 5-5'], ['path', 'm7 9 5-5 5 5']],
  ellipsis: [['circle', 12, 12, 1], ['circle', 19, 12, 1], ['circle', 5, 12, 1]],
} as const satisfies Record<string, readonly IconShape[]>

export type IconName = keyof typeof ICONS

export const isIconName = (name: unknown): name is IconName =>
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(ICONS, name)

/** The icon an area falls back to when none is named and nothing matches. */
export const DEFAULT_AREA_ICON: IconName = 'folder'

/** Word patterns → icon, for areas derived from `admin.group` labels. First match wins. */
const AREA_ICON_RULES: [RegExp, IconName][] = [
  [/\b(more|other)\b/i, 'ellipsis'],
  [/\b(media|image|photo|asset|librar|file|upload)/i, 'image'],
  [/\b(user|people|person|team|staff|member|author|contact|customer)/i, 'users'],
  [/\b(setting|config|global|option|preference)/i, 'settings'],
  [/\b(news|post|blog|article|journal|press|stor(y|ies))/i, 'newspaper'],
  [/\b(event|calendar|schedule|date)/i, 'calendar'],
  [/\b(form|inbox|submission|message|enquir|inquir|request|lead)/i, 'inbox'],
  [/\b(help|doc|guide|handbook|faq|support)/i, 'circle-help'],
  [/\b(mail|newsletter|subscri)/i, 'mail'],
  [/\b(product|shop|store|order|catalog)/i, 'shopping-bag'],
  [/\b(job|career|vacanc|position)/i, 'briefcase'],
  [/\b(tag|categor|taxonom|topic|label)/i, 'tag'],
  [/\b(location|place|office|venue|branch|map)/i, 'map-pin'],
  [/\b(campaign|promo|announce|marketing)/i, 'megaphone'],
  [/\b(redirect|link|url)/i, 'link'],
  [/\b(web|site|page|content|home)/i, 'globe'],
  [/\b(block|layout|section|component)/i, 'layers'],
  [/\b(agent|ai|automation|review)/i, 'sparkles'],
  [/\b(collection|document|record|entr)/i, 'file-text'],
]

/** A sensible icon for an area named `label`. */
export function iconForArea(label: string): IconName {
  for (const [re, icon] of AREA_ICON_RULES) if (re.test(label)) return icon
  return DEFAULT_AREA_ICON
}
