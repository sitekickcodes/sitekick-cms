import type { Block, CollectionBeforeValidateHook, CollectionConfig, Field } from 'payload'

import { adminOnly, authenticated } from '../../access'
import { statusCell } from '../../fields/statusCell'
import { nameFor, type FormField } from './model'

export const FORMS_SLUG = 'forms'
export const SUBMISSIONS_SLUG = 'form-submissions'
export const SUBMISSION_ANSWERS = '@sitekick/cms/admin#SubmissionAnswers'

const common = (extra: Field[] = []): Field[] => [
  { name: 'label', type: 'text', required: true, admin: { description: 'What the field asks, e.g. "Your email".' } },
  ...extra,
  {
    type: 'row',
    fields: [
      { name: 'required', type: 'checkbox', label: 'Required', admin: { width: '50%' } },
      {
        name: 'width',
        type: 'select',
        defaultValue: 'full',
        options: [
          { label: 'Full width', value: 'full' },
          { label: 'Half width', value: 'half' },
        ],
        admin: { width: '50%', description: 'Two half-width fields sit side by side.' },
      },
    ],
  },
  { name: 'help', type: 'text', label: 'Help text', admin: { description: 'Shown under the field. Blank = none.' } },
  // Set once from the label (forms collection hook) and kept, so past submissions still line up.
  // Hidden: editors only ever see labels.
  { name: 'key', type: 'text', admin: { hidden: true } },
]

const placeholder: Field = { name: 'placeholder', type: 'text', admin: { description: 'Example text inside the empty field. Blank = none.' } }

const block = (slug: string, singular: string, fields: Field[]): Block => ({ slug, labels: { singular, plural: `${singular} fields` }, fields })

export const FIELD_BLOCKS: Block[] = [
  block('text', 'Short answer', common([placeholder])),
  block('email', 'Email', common([placeholder])),
  block('phone', 'Phone', common([placeholder])),
  block('textarea', 'Long answer', common([placeholder])),
  block(
    'select',
    'Choice',
    common([
      {
        name: 'options',
        type: 'array',
        minRows: 1,
        required: true,
        labels: { singular: 'Option', plural: 'Options' },
        fields: [{ name: 'label', type: 'text', required: true }],
      },
    ]),
  ),
  block('checkbox', 'Checkbox', common()),
]

/** Every field gets a stable name the first time the form is saved. */
const nameFields: CollectionBeforeValidateHook = ({ data }) => {
  const fields = (data?.fields ?? []) as FormField[]
  const taken = new Set(fields.map((f) => f.key).filter(Boolean))
  for (const field of fields) if (!field.key && field.label) field.key = nameFor(field.label, taken)
  return data
}

export function formsCollection(): CollectionConfig {
  return {
    slug: FORMS_SLUG,
    labels: { singular: 'Form', plural: 'Forms' },
    admin: {
      group: 'Forms',
      useAsTitle: 'title',
      defaultColumns: ['title', 'updatedAt'],
      description: 'Forms for the site: contact, sign-up, enquiries. Put one on a page with the Form section.',
    },
    // The site renders forms; who to email stays private (field access below).
    access: { read: () => true, create: authenticated, update: authenticated, delete: authenticated },
    hooks: { beforeValidate: [nameFields] },
    custom: { sitekick: { private: true } },
    fields: [
      { name: 'title', type: 'text', required: true, admin: { description: 'For you and the notification email, e.g. "Contact".' } },
      { name: 'fields', type: 'blocks', labels: { singular: 'Field', plural: 'Fields' }, minRows: 1, blocks: FIELD_BLOCKS },
      { name: 'submitLabel', type: 'text', label: 'Button', defaultValue: 'Send' },
      {
        name: 'confirmation',
        type: 'textarea',
        defaultValue: 'Thanks, we got your message and will be in touch.',
        admin: { description: 'Shown in place of the form once it is sent.' },
      },
      {
        name: 'notify',
        label: 'Email each submission to',
        type: 'array',
        labels: { singular: 'Address', plural: 'Addresses' },
        access: { read: ({ req }) => Boolean(req.user) },
        admin: { position: 'sidebar', description: 'Blank = submissions only appear under Submissions.' },
        fields: [{ name: 'email', type: 'email', required: true }],
      },
    ],
  }
}

export function submissionsCollection(): CollectionConfig {
  return {
    slug: SUBMISSIONS_SLUG,
    labels: { singular: 'Submission', plural: 'Submissions' },
    admin: {
      group: 'Forms',
      useAsTitle: 'summary',
      defaultColumns: ['summary', 'form', 'status', 'createdAt'],
      description: 'What people sent through the site’s forms, newest first. Mark each one handled when it’s dealt with.',
    },
    defaultSort: '-createdAt',
    // Only the submit endpoint creates these (after its spam checks), never the public API.
    access: { create: () => false, read: authenticated, update: authenticated, delete: adminOnly },
    custom: { sitekick: { private: true } },
    fields: [
      // The title in lists; on the page the answers say it all.
      { name: 'summary', type: 'text', admin: { readOnly: true, condition: () => false } },
      {
        name: 'answers',
        type: 'json',
        admin: { components: { Field: SUBMISSION_ANSWERS } },
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: 'new',
        index: true,
        options: [
          { label: 'New', value: 'new' },
          { label: 'Handled', value: 'handled' },
          { label: 'Spam', value: 'spam' },
        ],
        admin: {
          position: 'sidebar',
          components: { Cell: statusCell({ new: { label: 'New', tone: 'info' }, handled: { label: 'Handled', tone: 'success' }, spam: { label: 'Spam', tone: 'quiet' } }) },
        },
      },
      { name: 'form', type: 'relationship', relationTo: FORMS_SLUG as never, index: true, admin: { position: 'sidebar', readOnly: true } },
      { name: 'page', type: 'text', label: 'Sent from', admin: { position: 'sidebar', readOnly: true, description: 'The page it was sent from.' } },
      // For the rate limit only: a salted hash, never the address itself.
      { name: 'sender', type: 'text', index: true, admin: { hidden: true } },
    ],
  }
}
