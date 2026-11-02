'use client'

import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { MetaImageComponent } from '@payloadcms/plugin-seo/client'

/**
 * Click the photo or the filename on an image field's upload card to open
 * Payload's own media drawer. Its large preview, alt text and Edit Image
 * controls are all available there. Renders nothing; the uploadPreview
 * convention wires this onto regular fields, galleries and the SEO image
 * field.
 *
 * EXCEPTION: this is a deliberate Payload-markup adapter. It finds the
 * card's thumbnail, filename and edit action by Payload's class names
 * (listed once, below). The actual drawer, permission checks and media saves
 * stay Payload-owned. The write icon identifies the edit action without
 * relying on button order or a translated label. It never opens a global
 * image-editor modal by slug: that could target the wrong nested drawer.
 */

// EXCEPTION: Payload class names, the whole dependency in one place.
const FIELD = '.field-type'
const CARD = '.upload-field-card'
const CARD_READ_ONLY = 'upload-field-card--readOnly'
const EDIT = '.upload-relationship-details__action-btn:has(.icon--write)'
const FILENAME = '.upload-relationship-details__filename a'
const TARGET = `.upload-relationship-details__thumbnail, ${FILENAME}`

const WRAPPER = 'data-sitekick-upload-preview'

export function bindUploadShortcuts(field: HTMLElement): () => void {
  const view = field.ownerDocument.defaultView
  if (!view) return () => {}
  const original = new Map<HTMLElement, { role: string | null; label: string | null }>()
  const editFor = (target: Element) => {
    const card = target.closest(CARD)
    if (!card || !field.contains(card) || card.classList.contains(CARD_READ_ONLY)) return null
    const edit = card.querySelector<HTMLButtonElement>(EDIT)
    return edit && !edit.disabled && edit.getAttribute('aria-disabled') !== 'true' ? edit : null
  }
  const restore = (link: HTMLElement) => {
    const attributes = original.get(link)
    if (!attributes) return
    for (const [name, value] of [
      ['role', attributes.role],
      ['aria-label', attributes.label],
    ] as const) {
      if (value === null) link.removeAttribute(name)
      else link.setAttribute(name, value)
    }
    original.delete(link)
  }
  const sync = () => {
    for (const link of original.keys()) if (!field.contains(link) || !editFor(link)) restore(link)
    for (const link of field.querySelectorAll<HTMLElement>(FILENAME)) {
      const edit = editFor(link)
      if (!edit) continue
      if (!original.has(link)) original.set(link, { role: link.getAttribute('role'), label: link.getAttribute('aria-label') })
      link.setAttribute('role', 'button')
      link.setAttribute('aria-label', `${edit.getAttribute('aria-label') || 'Edit'}: ${link.textContent?.trim() || 'media'}`)
    }
  }
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof view.Element ? event.target.closest(TARGET) : null
    const edit = target && field.contains(target) ? editFor(target) : null
    if (!edit) return
    event.preventDefault()
    edit.click()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== ' ') return // Enter already dispatches a native link click.
    const target = event.target instanceof view.Element ? event.target.closest(FILENAME) : null
    const edit = target && field.contains(target) ? editFor(target) : null
    if (!edit) return
    event.preventDefault()
    edit.click()
  }
  const observer = new view.MutationObserver(sync)
  observer.observe(field, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'class'] })
  field.addEventListener('click', onClick)
  field.addEventListener('keydown', onKeyDown)
  sync()
  return () => {
    observer.disconnect()
    field.removeEventListener('click', onClick)
    field.removeEventListener('keydown', onKeyDown)
    for (const link of original.keys()) restore(link)
  }
}

export function UploadPreview() {
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // EXCEPTION: the enclosing field is found by Payload's `.field-type` class;
    // our own wrapper (MetaImageWithPreview) is found by data attribute.
    const field = anchor.current?.closest<HTMLElement>(`[${WRAPPER}], ${FIELD}`)
    if (!field) return
    return bindUploadShortcuts(field)
  }, [])

  return <span ref={anchor} hidden />
}

/** SEO's custom upload component does not forward its afterInput slot. */
export function MetaImageWithPreview(props: ComponentProps<typeof MetaImageComponent>) {
  return (
    <div {...{ [WRAPPER]: '' }}>
      <MetaImageComponent {...props} />
      <UploadPreview />
    </div>
  )
}
