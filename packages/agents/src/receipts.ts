import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Guarded fetch with a receipt. Every fact an agent proposes points at exactly
 * what it read: the URL, when, a hash of the bytes and the passage that says
 * it. Public http(s) only, private ranges refused on every redirect hop,
 * bounded size and time, Internet Archive when the live page is gone.
 */
export type Receipt = {
  url: string
  fetchedAt: string
  sha256: string
  excerpt: string
  title?: string
}

export type FetchResult = {
  receipt: Receipt
  text: string
  html?: string
  status: number
  /** Set when the live page failed and the Internet Archive's copy was read instead. */
  archived?: { liveError: string }
}

export type FetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /** Try web.archive.org when the live fetch fails or returns 4xx/5xx. Default true. */
  archive?: boolean
  /** Injection points for tests; production uses the globals. */
  fetchImpl?: typeof fetch
  lookup?: (hostname: string) => Promise<Array<{ address: string }>>
  userAgent?: string
}

const DEFAULT_UA = 'Sitekick-CMS-agent/1.0 (+https://sitekick.co)'

/** RFC 1918, loopback, link-local, CGNAT, multicast; IPv6 outside global unicast. */
export function isPrivateIP(ip: string): boolean {
  const version = isIP(ip)
  if (version === 6) {
    const lower = ip.toLowerCase()
    if (lower.startsWith('::ffff:')) return isPrivateIP(lower.slice(7))
    return !/^2[0-9a-f]{3}:/.test(lower)
  }
  if (version !== 4) return true
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

const PRIVATE_HOSTS = /^(localhost|.*\.(localhost|local|internal|home|lan|intranet))$/i

export async function assertPublicUrl(url: URL, lookup: FetchOptions['lookup'] = defaultLookup): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs can be fetched.')
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (PRIVATE_HOSTS.test(host)) throw new Error('Private network addresses are not allowed.')
  if (isIP(host)) {
    if (isPrivateIP(host)) throw new Error('Private network addresses are not allowed.')
    return
  }
  const addresses = await lookup(host)
  if (!addresses.length || addresses.some((a) => isPrivateIP(a.address))) {
    throw new Error('Private network addresses are not allowed.')
  }
}

const defaultLookup: NonNullable<FetchOptions['lookup']> = (hostname) => dnsLookup(hostname, { all: true })

export const sha256 = (input: string | Uint8Array): string => createHash('sha256').update(input).digest('hex')

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))

/**
 * Readable text from HTML: no scripts, styles, nav chrome or hidden markup;
 * whitespace collapsed. Links keep their target as `text [url]` and images
 * become `[image: alt url]`, so an agent can name a social profile or a
 * headshot from what it read; footers stay because that is where socials live.
 */
export function htmlToText(html: string, base?: string): string {
  const abs = (u: string) => {
    try {
      return base ? new URL(u, base).toString() : u
    } catch {
      return u
    }
  }
  return decodeEntities(
    html
      // Comments and <template> are markup a visitor never sees; a placeholder
      // footer in a comment once became a "fact".
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|nav|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const src = tag.match(/\s(?:src|data-src)=["']([^"']+)["']/i)?.[1]
        const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? ''
        return src && !src.startsWith('data:') ? ` [image${alt ? `: ${alt}` : ''} ${abs(src)}] ` : ' '
      })
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) =>
        /^(#|javascript:|mailto:|tel:)/i.test(href) ? ` ${text} ` : ` ${text} [${abs(href)}] `,
      )
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/section|\/article|\/blockquote)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function titleOf(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
  const title = og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return title ? decodeEntities(title).replace(/\s+/g, ' ').trim().slice(0, 200) || undefined : undefined
}

const normalise = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/**
 * The passage around a quoted claim, for the receipt. Matching ignores case,
 * curly quotes and whitespace, because models re-space what they quote. Null
 * when the text does not contain the claim, which the verifiers treat as
 * "not supported".
 */
export function excerptFor(text: string, needle: string, radius = 160): string | null {
  const hay = normalise(text)
  const pin = normalise(needle)
  if (!pin) return null
  const at = hay.indexOf(pin)
  if (at === -1) return null
  const start = Math.max(0, at - radius)
  const end = Math.min(hay.length, at + pin.length + radius)
  return `${start > 0 ? '…' : ''}${hay.slice(start, end).trim()}${end < hay.length ? '…' : ''}`
}

export const archiveUrlFor = (url: string) => `https://web.archive.org/web/2/${url}`

type Raw = { status: number; body: string; contentType: string; finalUrl: string }

async function readGuarded(input: string, opts: FetchOptions): Promise<Raw> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const maxBytes = opts.maxBytes ?? 4 * 1024 * 1024
  const maxRedirects = opts.maxRedirects ?? 5
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  let url = new URL(input)
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Re-checked per hop: a public host may 302 to an internal address.
    await assertPublicUrl(url, opts.lookup)
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'user-agent': opts.userAgent ?? DEFAULT_UA,
        'accept-language': 'en-US,en;q=0.9',
      },
    })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location')
      await response.body?.cancel().catch(() => {})
      if (!next) throw new Error(`Redirect without a location from ${url.hostname}`)
      url = new URL(next, url)
      continue
    }
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > maxBytes) throw new Error(`The page is larger than ${Math.round(maxBytes / 1024)} KB.`)
          chunks.push(value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
    }
    const body = Buffer.concat(chunks).toString('utf8')
    return { status: response.status, body, contentType: response.headers.get('content-type') ?? '', finalUrl: url.toString() }
  }
  throw new Error('Too many redirects.')
}

const isHtml = (raw: Raw) => /html|xml/i.test(raw.contentType) || /^\s*<(!doctype|html)/i.test(raw.body)

function toResult(raw: Raw, requested: string, archived?: FetchResult['archived']): FetchResult {
  const html = isHtml(raw) ? raw.body : undefined
  const text = html ? htmlToText(html, raw.finalUrl) : raw.body.replace(/[ \t]+/g, ' ').trim()
  const receipt: Receipt = {
    url: archived ? raw.finalUrl : requested,
    fetchedAt: new Date().toISOString(),
    sha256: sha256(raw.body),
    excerpt: text.slice(0, 320),
    ...(html && titleOf(html) ? { title: titleOf(html) } : {}),
  }
  return { receipt, text, ...(html ? { html } : {}), status: raw.status, ...(archived ? { archived } : {}) }
}

/**
 * Fetch a public page and return its text with a receipt. A dead or refusing
 * page (network error, 4xx, 5xx) is retried from the Internet Archive; the
 * receipt then names the snapshot URL so the editor sees what was actually
 * read. Guard failures (private address, bad scheme) are never retried.
 */
export async function fetchWithReceipt(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a URL: ${url}`)
  }
  // Guard first so a refused URL never reaches the archive either.
  await assertPublicUrl(parsed, opts.lookup)
  let liveError: string
  try {
    const raw = await readGuarded(url, opts)
    if (raw.status < 400) return toResult(raw, url)
    liveError = `HTTP ${raw.status}`
  } catch (err) {
    liveError = err instanceof Error ? err.message : String(err)
    if (/Private network|credentials|Only http/.test(liveError)) throw err
  }
  if (opts.archive === false) throw new Error(`${parsed.hostname}: ${liveError}`)
  const archived = await readGuarded(archiveUrlFor(url), { ...opts, maxRedirects: 8 }).catch((err: unknown) => {
    throw new Error(`${parsed.hostname}: ${liveError}; no archive copy (${err instanceof Error ? err.message : String(err)})`)
  })
  if (archived.status >= 400) throw new Error(`${parsed.hostname}: ${liveError}; archive returned HTTP ${archived.status}`)
  return toResult(archived, url, { liveError })
}

/** A receipt for text the editor typed (notes, a transcript); nothing was fetched. */
export function syntheticReceipt(kind: 'notes' | 'transcript' | 'editor', text: string): Receipt {
  return { url: `${kind}:`, fetchedAt: new Date().toISOString(), sha256: sha256(text), excerpt: text.slice(0, 320) }
}

/** The receipt for a specific claim: same fetch, excerpt narrowed to the passage. */
export function receiptForClaim(base: Receipt, text: string, claim: string): Receipt | null {
  const excerpt = excerptFor(text, claim)
  return excerpt ? { ...base, excerpt } : null
}
