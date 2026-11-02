'use client'

import { useEffect, useRef } from 'react'
import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { reduceFieldsToValues } from 'payload/shared'

import { fillSEO, seoObject } from '../conventions/seoDefaults'

/**
 * Populate a new form's search details too, and follow source edits while
 * keeping typed overrides. Mounted with the document controls (the seo
 * convention adds it to beforeDocumentControls), so switching Content/SEO
 * tabs never loses the generated values or freezes them in a new document.
 */
export function SEOAutofill({ siteName }: { siteName?: string }) {
  const { collectionSlug } = useDocumentInfo()
  return collectionSlug && siteName ? <AutomaticValues siteName={siteName} /> : null
}

function AutomaticValues({ siteName }: { siteName: string }) {
  const { initialData } = useDocumentInfo()
  const json = useFormFields(([fields]) => JSON.stringify(reduceFieldsToValues(fields, true)))
  const previous = useRef<Record<string, unknown> | undefined>(initialData)
  const title = useField<string>({ path: 'meta.title' })
  const description = useField<string>({ path: 'meta.description' })
  const image = useField({ path: 'meta.image' })
  const { setValue: setTitle } = title
  const { setValue: setDescription } = description
  const { setValue: setImage } = image
  const disabled = title.disabled || description.disabled || image.disabled || title.formInitializing || title.formProcessing

  useEffect(() => {
    if (disabled) return
    const data = JSON.parse(json) as Record<string, unknown>
    const current = seoObject(data.meta)
    const meta = fillSEO(data, { name: siteName }, previous.current)
    previous.current = { ...data, meta }
    if (meta.title !== current.title) setTitle(meta.title)
    if (meta.description !== current.description) setDescription(meta.description)
    if (meta.image !== current.image) setImage(meta.image)
  }, [json, siteName, disabled, setTitle, setDescription, setImage])

  return null
}

export function SEOAutofillNote() {
  return (
    // EXCEPTION: `field-description` borrows Payload's description type style.
    <p className="field-description" style={{ marginBottom: 24 }}>
      Search and sharing details are filled in from your content. Edit them here to use custom copy. Without a sharing image, the site uses its default
      share card.
    </p>
  )
}
