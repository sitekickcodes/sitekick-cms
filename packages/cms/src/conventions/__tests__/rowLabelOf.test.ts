import { describe, expect, test } from 'bun:test'

import { rowLabelOf } from '../rowLabelOf'

describe('rowLabelOf', () => {
  test('heading before eyebrow, quote when there is no heading, never an id', () => {
    expect(rowLabelOf({ id: 'abc123', eyebrow: 'Demo Co.', heading: 'Websites your team\ncan run' })).toBe('Websites your team can run')
    expect(rowLabelOf({ id: 'abc123', quote: 'We used to wait.', attribution: 'Maya' })).toBe('We used to wait.')
    expect(rowLabelOf({ id: 'abc123', width: 'narrow', content: { root: { children: [] } } })).toBeNull()
    expect(rowLabelOf({ id: 'abc123', width: 'narrow', content: { root: { children: [{ children: [] }, { children: [{ text: 'Everything on ' }, { text: 'this page' }] }] } } })).toBe('Everything on this page')
    expect(rowLabelOf({ eyebrow: 'Only this' })).toBe('Only this')
    expect(rowLabelOf({ link: { label: 'Contact' } })).toBe('Contact')
  })
})
