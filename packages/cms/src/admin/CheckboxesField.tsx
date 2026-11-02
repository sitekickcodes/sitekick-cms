'use client'

import type { SelectFieldClientProps } from 'payload'
import type React from 'react'
import { CheckboxInput, FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'

import styles from './CheckboxesField.module.css'

/**
 * A many-values select shown as one checkbox per option (a person's lists
 * hid in a dropdown, so nobody could see who was on which board). Stored as
 * the select hasMany it always was, in option order whatever order the boxes
 * were ticked in.
 *
 *   { name: 'boards', type: 'select', hasMany: true, options, admin: { components: { Field: '@sitekick/cms/admin#CheckboxesField' } } }
 */
export const CheckboxesField: React.FC<SelectFieldClientProps> = ({ field, path, readOnly }) => {
  const { value, setValue, showError, errorMessage } = useField<string[]>({ potentiallyStalePath: path })
  const picked = new Set(Array.isArray(value) ? value : [])
  const options = field.options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
  const description = typeof field.admin?.description === 'string' ? field.admin.description : undefined

  const toggle = (option: string) => {
    const next = new Set(picked)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    setValue(options.map((o) => o.value).filter((v) => next.has(v)))
  }

  return (
    // EXCEPTION: `field-type` gives the field Payload's standard spacing.
    <div className="field-type">
      {/* a real <label> (pointing at the first box) so it gets the admin's field-label style */}
      <FieldLabel label={field.label} path={path} required={field.required} htmlFor={`field-${path}-${options[0]?.value}`} />
      <div className={styles.options} role="group" aria-label={typeof field.label === 'string' ? field.label : undefined}>
        {options.map((o) => (
          <CheckboxInput
            key={o.value}
            id={`field-${path}-${o.value}`}
            name={`${path}-${o.value}`}
            checked={picked.has(o.value)}
            label={typeof o.label === 'string' ? o.label : o.value}
            readOnly={readOnly}
            onToggle={() => toggle(o.value)}
          />
        ))}
      </div>
      {showError && <FieldError path={path} message={errorMessage} showError />}
      {description && <FieldDescription path={path} description={description} />}
    </div>
  )
}
