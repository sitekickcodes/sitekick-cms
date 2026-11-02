/**
 * Helpers for the EXCEPTION policy in admin.css: every rule that names an
 * @payloadcms/ui class carries a `EXCEPTION:` comment just above it. Pure
 * string functions; no DOM, no filesystem, no CSS parser dependency.
 */

/** Class-name prefixes that mark a selector as targeting @payloadcms/ui. */
export const payloadPrefixes = [
  '.btn',
  '.field-',
  '.collection-list',
  '.doc-controls',
  '.table',
  '.nav',
  '.template-',
  '.render-fields',
  '.app-header',
  '.list-controls',
  '.popup',
  '.drawer',
  '.react-select',
] as const

/** Every `/* EXCEPTION ... *\/` comment in `css`, whitespace collapsed, in order. */
export function listExceptions(css: string): string[] {
  const out: string[] = []
  const re = /\/\*\s*(EXCEPTION\b[\s\S]*?)\*\//g
  for (let m = re.exec(css); m; m = re.exec(css)) {
    out.push(m[1]!.replace(/\s+/g, ' ').trim())
  }
  return out
}

export type CssRule = {
  /** Selector text, whitespace collapsed. */
  selector: string
  /** 1-based line where the selector's first character sits. */
  line: number
}

/**
 * Every style rule's selector and starting line. Comments are skipped,
 * at-rules (`@media ...{`) are not rules, and `{` inside strings or
 * `url(...)` does not open a block. Flat CSS only (no nesting), which is all
 * admin.css uses.
 */
export function listRules(css: string): CssRule[] {
  const rules: CssRule[] = []
  let i = 0
  let line = 1
  let selStart = -1
  let selLine = 0
  let selText = ''
  const push = (ch: string) => {
    if (selStart < 0 && !/\s/.test(ch)) {
      selStart = i
      selLine = line
    }
    if (selStart >= 0) selText += ch
  }
  while (i < css.length) {
    const ch = css[i]!
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end < 0 ? css.length : end + 2
      for (let j = i; j < stop; j++) if (css[j] === '\n') line++
      i = stop
      continue
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== ch) {
        if (css[j] === '\\') j++
        if (css[j] === '\n') line++
        j++
      }
      push(css.slice(i, j + 1))
      i = j + 1
      continue
    }
    if (ch === '\n') line++
    if (ch === '{') {
      const sel = selText.replace(/\s+/g, ' ').trim()
      if (sel && !sel.startsWith('@')) rules.push({ selector: sel, line: selLine })
      selStart = -1
      selText = ''
    } else if (ch === '}' || ch === ';') {
      selStart = -1
      selText = ''
    } else {
      push(ch)
    }
    i++
  }
  return rules
}

/** Whether `selector` names any Payload class prefix. */
export function targetsPayload(selector: string, prefixes: readonly string[] = payloadPrefixes): boolean {
  return prefixes.some((p) => selector.includes(p))
}

/**
 * Whether the word EXCEPTION appears within the `window` lines above `line`
 * (or on the line itself). A comment block that closes inside that window
 * counts from its opening `/*`, so a multi-line comment directly above the
 * rule qualifies as a whole.
 */
export function hasExceptionAbove(lines: readonly string[], line: number, window = 3): boolean {
  let from = Math.max(0, line - 1 - window)
  const to = line - 1
  for (let k = from; k <= to; k++) {
    if (lines[k]?.includes('*/')) {
      for (let j = k; j >= 0; j--) {
        if (lines[j]?.includes('/*')) {
          from = Math.min(from, j)
          break
        }
      }
    }
  }
  for (let k = from; k <= to; k++) if (lines[k]?.includes('EXCEPTION')) return true
  return false
}

/** Rules that name a Payload class without an EXCEPTION marker close above. */
export function findUnmarkedRules(css: string, prefixes: readonly string[] = payloadPrefixes): CssRule[] {
  const lines = css.split('\n')
  return listRules(css).filter((r) => targetsPayload(r.selector, prefixes) && !hasExceptionAbove(lines, r.line))
}
