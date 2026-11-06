import type { Block } from 'payload'

import { defineModule, type SiteModule } from '../../modules'
import { formsCollection, submissionsCollection, FORMS_SLUG, SUBMISSIONS_SLUG } from './collections'
import { submitEndpoint } from './submit'

export { checkAnswers, nameFor, notificationOf, summaryOf, type Answer, type FormDefinition, type FormField } from './model'
export { FORMS_SLUG, SUBMISSIONS_SLUG } from './collections'

/**
 * Forms, as a recipe: editors build forms (contact, sign-up, enquiries) from simple fields,
 * put one on any page with the Form section, and read what comes in under Forms ›
 * Submissions, with an email to whoever should know. It's a site module, so:
 *
 *   sitekickCMS({ site, modules: [forms(), ...] })
 *
 * and on the site, render the section with `FormSection` from `@sitekick/blocks/react`:
 *
 *   <RenderBlocks blocks={page.layout} custom={{ formBlock: FormSection }} />
 *
 * Submissions only come in through POST /api/forms/:id/submit, which turns away bots
 * (a hidden field, a minimum fill time, a per-sender rate limit) and checks every answer.
 * Forms and submissions are private: no agents, no public catalog.
 */
export const FORM_BLOCK: Block = {
  slug: 'formBlock',
  labels: { singular: 'Form', plural: 'Form sections' },
  admin: { group: 'Calls to action' },
  fields: [
    { name: 'form', type: 'relationship', relationTo: FORMS_SLUG as never, required: true, admin: { description: 'Build forms under Forms in the sidebar.' } },
    { name: 'heading', type: 'text' },
    { name: 'intro', type: 'textarea', admin: { description: 'A line above the form. Blank = none.' } },
  ],
}

export function forms(): SiteModule {
  const definitions = formsCollection()
  return defineModule({
    name: 'forms',
    collections: [{ ...definitions, endpoints: [submitEndpoint()] }, submissionsCollection()],
    blocks: [FORM_BLOCK],
    nav: { label: 'Forms', icon: 'mail', links: [SUBMISSIONS_SLUG, FORMS_SLUG] },
    dashboard: [{ key: 'forms-new-submissions', title: 'New submissions', Component: '@sitekick/cms/admin#SubmissionsCard', skeletonRows: 4 }],
    commands: [{ label: 'New submissions', href: `/collections/${SUBMISSIONS_SLUG}?where[status][equals]=new`, keywords: ['forms', 'messages', 'contact'] }],
    help: [formsHelp],
  })
}

/** Help, written as the drawer shows it (Lexical, built small here so the recipe needs no converter). */
const text = (t: string) => ({ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
const node = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({ type, children, direction: 'ltr', format: '', indent: 0, version: 1, ...extra })
const p = (t: string) => node('paragraph', [text(t)], { textFormat: 0, textStyle: '' })
const h = (t: string) => node('heading', [text(t)], { tag: 'h2' })
const ol = (items: string[]) => node('list', items.map((t, i) => node('listitem', [text(t)], { value: i + 1 })), { listType: 'number', start: 1, tag: 'ol' })

const formsHelp = {
  slug: 'forms-and-submissions',
  title: 'Forms and submissions',
  topic: 'Forms',
  summary: 'Build a form, put it on a page, and read what people send.',
  body: {
    root: node('root', [
      h('Build a form'),
      ol([
        'Open Forms › Forms in the sidebar and choose Create New.',
        'Give it a title, like "Contact". Only you see it.',
        'Add fields: Short answer, Email, Phone, Long answer, Choice or Checkbox. Tick Required for the ones people must fill in.',
        'Set the button text and the thank-you message.',
        'Under "Email each submission to", add who should hear about each one.',
      ]),
      h('Put it on a page'),
      p('On any page, choose Add Section, pick Form, and choose your form.'),
      h('Read submissions'),
      p('Everything people send is under Forms › Submissions, newest first, and the dashboard shows the latest. Mark each one Handled when it’s dealt with, or Spam. Hitting reply on the notification email writes straight back to the person.'),
      p('Spam is turned away before it reaches you: hidden traps for bots, and a limit on how many messages one sender can send at once.'),
    ]),
  },
}
