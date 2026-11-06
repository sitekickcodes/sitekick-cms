'use client'

import { useField } from '@payloadcms/ui'

import type { Answer } from '../../recipes/forms/model'
import styles from './forms.module.css'

/** A submission's answers as label and value, the way the person wrote them (read-only). */
export function SubmissionAnswers({ path }: { path: string }) {
  const { value } = useField<Answer[]>({ path })
  const answers = Array.isArray(value) ? value : []
  if (!answers.length) return <p className={styles.empty}>No answers.</p>
  return (
    <dl className={styles.answers}>
      {answers.map((a) => (
        <div key={a.key} className={styles.answer}>
          <dt>{a.label}</dt>
          <dd>{a.value ? a.value : <span className={styles.blank}>Left blank</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
