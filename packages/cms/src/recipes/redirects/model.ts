/**
 * Redirects, the pure parts: shared by the Payload side (collections, endpoints) and the
 * Next proxy, so nothing here may import Payload or Node.
 */

export const REDIRECTS_SLUG = 'redirects'
export const MISSING_SLUG = 'missing-pages'
/** Where the proxy reads the table: `GET <api>/redirects/table`. */
export const TABLE_PATH = '/table'
export const HIT_PATH = '/hit'
export const IMPORT_PATH = '/import'

/** One row of the table the proxy serves from: already normalised and chains followed. */
export type RedirectRule = { from: string; to: string; permanent: boolean }

/**
 * The form every `from` is stored and looked up in: a path with a leading slash, no
 * trailing slash, no query or hash, lower case, percent-decoding undone. A full URL is
 * cut to its path ("https://old.example.com/About-Us/?x=1" → "/about-us"). Returns
 * null for what can't be a path on this site.
 */
export function normalizePath(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname
    } catch {
      return null
    }
  }
  s = s.replace(/[?#].*$/, '')
  if (!s.startsWith('/')) s = `/${s}`
  try {
    s = decodeURI(s)
  } catch {
    // Leave a malformed escape as typed.
  }
  s = s.replace(/\/{2,}/g, '/').toLowerCase()
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s.length > 1000 ? null : s
}

/**
 * Where a redirect may point: a path on this site or an http(s) URL anywhere. A path is
 * tidied the same way as `from`, keeping its case and query (other sites may care).
 */
export function normalizeTarget(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).toString()
    } catch {
      return null
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//')) return null
  const [path, rest = ''] = s.split(/(?=[?#])/, 2) as [string, string?]
  let p = path.startsWith('/') ? path : `/${path}`
  p = p.replace(/\/{2,}/g, '/')
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p + rest
}

/** The public path of a document, from its collection's prefix: ('/news', 'hello') → '/news/hello'. */
export const pathFor = (prefix: string, slug: string): string => `${prefix.replace(/\/+$/, '')}/${slug}`.replace(/^(?!\/)/, '/')

/**
 * Follow chains (a → b, b → c becomes a → c) so a visitor is sent once, never through a
 * row of hops. A loop, or a chain longer than `max`, drops the rule: better a 404 than a
 * redirect that never ends.
 */
export function resolveChains(rules: RedirectRule[], max = 10): RedirectRule[] {
  const byFrom = new Map(rules.map((r) => [r.from, r]))
  const out: RedirectRule[] = []
  for (const rule of rules) {
    let to = rule.to
    let permanent = rule.permanent
    const seen = new Set([rule.from])
    let ok = true
    for (let hops = 0; ; hops++) {
      const next = to.startsWith('/') ? byFrom.get(normalizePath(to) ?? '') : undefined
      if (!next) break
      if (seen.has(next.from) || hops >= max) {
        ok = false
        break
      }
      seen.add(next.from)
      to = next.to
      // One temporary hop makes the whole trip temporary.
      permanent = permanent && next.permanent
    }
    if (ok && normalizePath(to) !== rule.from) out.push({ from: rule.from, to, permanent })
  }
  return out
}

/**
 * The destination for a request, keeping the visitor's query string when the target has
 * none of its own (campaign links survive a relaunch).
 */
export function destinationOf(rule: RedirectRule, search: string): string {
  if (!search || search === '?' || rule.to.includes('?')) return rule.to
  const [base, hash = ''] = rule.to.split('#', 2) as [string, string?]
  return `${base}${search.startsWith('?') ? search : `?${search}`}${hash ? `#${hash}` : ''}`
}

/**
 * Requests not worth listing as missing pages: bots probing for WordPress and secrets,
 * and files (images, scripts) rather than pages. Old `.html`/`.php`/`.aspx` pages stay in:
 * they are exactly what a relaunch breaks.
 */
export function isNoise(path: string): boolean {
  const p = path.toLowerCase()
  if (/(^|\/)\.(?!well-known)/.test(p)) return true
  if (/^\/(wp-|wordpress|xmlrpc|cgi-bin|vendor|phpmyadmin|admin\.php|boaform|actuator|autodiscover|owa|ecp|remote|hnap1)/.test(p)) return true
  if (/(\.env|\.git|\.sql|\.bak|\.ini|\.ya?ml|\.log|\.zip|\.tar|\.gz|config\.json|wlwmanifest)/.test(p)) return true
  if (/\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|txt|xml|json|mp4|pdf)$/.test(p)) return true
  return false
}

export type ImportRow = { from: string; to: string; permanent: boolean; line: number }
export type ImportResult = { rows: ImportRow[]; errors: { line: number; message: string }[] }

/**
 * Rows pasted from a spreadsheet or a CSV: `old, new` per line, tabs or commas, an
 * optional third column saying "temporary" (or 302/307). A header row is skipped.
 * Duplicate `from`s keep the last one, as a spreadsheet reader would expect.
 */
export function parseImport(text: string): ImportResult {
  const rows = new Map<string, ImportRow>()
  const errors: ImportResult['errors'] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim()) return
    const cells = splitCells(raw)
    const [a = '', b = '', c = ''] = cells
    if (i === 0 && !/^(\/|https?:\/\/)/i.test(a) && !/^(\/|https?:\/\/)/i.test(b)) return
    // In a paste, an address starts with / or http(s)://; anything else is a stray cell.
    const from = /^(\/|https?:\/\/)/i.test(a) ? normalizePath(a) : null
    const to = /^(\/|https?:\/\/)/i.test(b) ? normalizeTarget(b) : null
    if (!from) return void errors.push({ line, message: `“${a || '(blank)'}” isn’t an address on the old site.` })
    if (!to) return void errors.push({ line, message: `“${b || '(blank)'}” isn’t a page or a web address.` })
    if (normalizePath(to) === from) return void errors.push({ line, message: `${from} points at itself.` })
    rows.set(from, { from, to, permanent: !/temp|302|307/i.test(c), line })
  })
  return { rows: [...rows.values()], errors }
}

const splitCells = (line: string): string[] => {
  const sep = line.includes('\t') ? '\t' : ','
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === sep && !quoted) {
      cells.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  cells.push(cur.trim())
  return cells
}

/** The key the proxy sends with hits so only the site itself can count them. */
export async function hitKey(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`sitekick-redirects:${secret}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
