import type { Config, Plugin } from 'payload'

/**
 * The Sitekick admin theme.
 *
 * The theme is CSS, not configuration. Payload loads admin styles from the
 * app's own `(payload)/custom.css` (imported by its `(payload)/layout.tsx`),
 * so a client app wires the theme with two imports and then overrides the
 * `--sk-*` variables it wants:
 *
 *   @import '@sitekick/cms/theme.css';   // tokens, mapped onto Payload 4's semantic tokens
 *   @import '@sitekick/cms/admin.css';   // EXCEPTION-marked polish on Payload classes
 *
 *   :root {
 *     --sk-accent: #0f766e;
 *     --sk-font-body: var(--font-inter), system-ui, sans-serif;
 *   }
 *
 * Both files are package exports (`./theme.css`, `./admin.css` in
 * package.json). This plugin therefore touches one thing only: `admin.theme`,
 * when the client wants to pin light or dark, and otherwise leaves the
 * config alone.
 */
export type ThemePluginOptions = {
  /**
   * Payload's `admin.theme`: `'all'` (default, follows the OS and the user's
   * switch), `'light'` or `'dark'`. Omitted = the config's own value stays.
   */
  theme?: NonNullable<Config['admin']>['theme']
}

export const themePlugin =
  (options: ThemePluginOptions = {}): Plugin =>
  (config) => {
    if (options.theme) {
      config.admin = { ...config.admin, theme: options.theme }
    }
    return config
  }

export { listExceptions, listRules, findUnmarkedRules, payloadPrefixes } from './exceptions'
