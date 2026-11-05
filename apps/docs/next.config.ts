import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: NextConfig = {
  // Pages read Markdown from this app and the package READMEs at build time.
  turbopack: { root: path.resolve(dirname, '../..') },
  outputFileTracingRoot: path.resolve(dirname, '../..'),
}

export default config
