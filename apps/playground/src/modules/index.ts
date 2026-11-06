import { forms, type SiteModule } from '@sitekick/cms'

import { events } from './events'

/**
 * This site's own features. Each module is a folder here, handed to sitekickCMS in
 * payload.config.ts, which adds its collections before applying the Sitekick conventions.
 * Page sections a module renders are in ./frontend.ts. See README.md. `forms()` is a
 * Sitekick recipe in the same shape.
 */
export const modules: SiteModule[] = [forms(), events]
