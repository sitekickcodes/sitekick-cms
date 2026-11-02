import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  findUnmarkedRules,
  hasExceptionAbove,
  listExceptions,
  listRules,
  payloadPrefixes,
  targetsPayload,
} from '../exceptions'

const themeDir = join(import.meta.dir, '..')
const adminCss = readFileSync(join(themeDir, 'admin.css'), 'utf8')
const themeCss = readFileSync(join(themeDir, 'theme.css'), 'utf8')

describe('listExceptions', () => {
  test('extracts EXCEPTION comments in order, whitespace collapsed', () => {
    const css = `
      /* plain */
      .a { color: red; }
      /* EXCEPTION: one
         line two */
      .btn { x: y; }
      /* EXCEPTION (same terms): two */
      .field-x { x: y; }
    `
    expect(listExceptions(css)).toEqual(['EXCEPTION: one line two', 'EXCEPTION (same terms): two'])
  })

  test('admin.css carries many exceptions; theme.css carries none', () => {
    expect(listExceptions(adminCss).length).toBeGreaterThan(50)
    expect(listExceptions(themeCss)).toEqual([])
  })
})

describe('listRules', () => {
  test('finds selectors and lines, skipping at-rules, comments, strings and url()', () => {
    const css = [
      '/* .btn { in a comment } */',
      '@media (max-width: 600px) {',
      '  .btn { mask: url("data:x,{"); }',
      "  .a[title=': {'] { color: red; }",
      '}',
      ':root { --x: 1; }',
    ].join('\n')
    expect(listRules(css)).toEqual([
      { selector: '.btn', line: 3 },
      { selector: ".a[title=': {']", line: 4 },
      { selector: ':root', line: 6 },
    ])
  })
})

describe('hasExceptionAbove', () => {
  test('honours the 3-line window and extends through a closing comment', () => {
    const lines = ['/* EXCEPTION: long', 'comment', 'ends here */', '.btn {', '}']
    expect(hasExceptionAbove(lines, 4)).toBe(true)
    const far = ['/* EXCEPTION: far */', '', '', '', '.btn {']
    expect(hasExceptionAbove(far, 5)).toBe(false)
    const near = ['/* EXCEPTION: near */', '', '', '.btn {']
    expect(hasExceptionAbove(near, 4)).toBe(true)
  })
})

describe('admin.css policy', () => {
  test('targetsPayload recognises the known prefixes', () => {
    expect(targetsPayload('.btn--style-pill')).toBe(true)
    expect(targetsPayload('html[data-theme] .template-minimal form input')).toBe(true)
    expect(targetsPayload('h1:not([contenteditable] *)')).toBe(false)
    expect(payloadPrefixes).toContain('.react-select')
  })

  test('every rule naming a Payload class has an EXCEPTION comment within the previous 3 lines', () => {
    const unmarked = findUnmarkedRules(adminCss)
    expect(
      unmarked.map((r) => `admin.css:${r.line} ${r.selector}`),
      'rules below need a /* EXCEPTION: ... */ marker',
    ).toEqual([])
  })

  test('theme.css is tokens only: no class selectors at all', () => {
    const classRules = listRules(themeCss).filter((r) => r.selector.includes('.'))
    expect(classRules).toEqual([])
  })

  test('no --yb-* leftovers from the source project', () => {
    expect(adminCss).not.toMatch(/--yb-/)
    expect(themeCss).not.toMatch(/--yb-/)
  })
})
