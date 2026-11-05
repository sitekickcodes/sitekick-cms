import { describe, expect, test } from 'bun:test'

import { columnOf, confirmOf, errorOf, moveOf, requestOf } from '../model'

describe('board moves', () => {
  test('to Published publishes, to Draft unpublishes, nothing goes into Changed', () => {
    expect(moveOf('draft', 'published')).toBe('publish')
    expect(moveOf('changed', 'published')).toBe('publish')
    expect(moveOf('published', 'draft')).toBe('unpublish')
    expect(moveOf('changed', 'draft')).toBe('unpublish')
    expect(moveOf('draft', 'changed')).toBeNull()
    expect(moveOf('published', 'changed')).toBeNull()
    expect(moveOf('draft', 'draft')).toBeNull()
  })

  test('publish saves the latest draft live; unpublish only flips the status', () => {
    expect(requestOf('posts', 7, 'publish')).toEqual({ path: '/posts/7?depth=0&draft=true', body: { _status: 'published' } })
    expect(requestOf('posts', 'a/b', 'unpublish')).toEqual({ path: '/posts/a%2Fb?depth=0', body: { _status: 'draft' } })
  })

  test('drafts with a published version are Changed', () => {
    const live = new Set<number | string>([2])
    expect(columnOf('published', 1, live)).toBe('published')
    expect(columnOf('draft', 2, live)).toBe('changed')
    expect(columnOf('draft', 3, live)).toBe('draft')
  })

  test('confirmations say what happens to the site', () => {
    expect(confirmOf('publish', 'Hello', 'changed', 'post').heading).toBe('Publish the changes to “Hello”?')
    expect(confirmOf('unpublish', 'Hello', 'published', 'post').body).toContain('comes off the site')
  })

  test('validation errors name the fields', () => {
    const json = { errors: [{ name: 'ValidationError', message: 'The following field is invalid: Body', data: { errors: [{ label: 'Post > Body', path: 'body', message: 'Required' }] } }] }
    expect(errorOf(json, 400)).toBe('Open it and fix Body first.')
    expect(errorOf({ errors: [{ message: 'Forbidden' }] }, 403)).toBe('Forbidden')
    expect(errorOf(null, 500)).toBe('The server answered HTTP 500.')
  })
})
