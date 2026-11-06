Contact forms, sign-ups and enquiries that editors build themselves, with every submission
waiting in the admin and an email to whoever should know.

```ts
import { forms, sitekickCMS } from '@sitekick/cms'

plugins: [sitekickCMS({ site, modules: [forms()] })]
```

Forms is a [site module](../modules.md) shipped by Sitekick, so it goes in `modules`, and its
collections get the same polish as the site's own. New sites from the CLI have it already.

On the site, render the Form section:

```tsx
import { FormSection, RenderBlocks } from '@sitekick/blocks/react'

<RenderBlocks blocks={page.layout} custom={{ formBlock: FormSection }} />
```

The page must load its relationships one level deep (`depth: 1`) so the section gets the
whole form.

## For editors

- **Build a form** under Forms › Forms. Pick from short answer, email, phone, long answer,
  choice and checkbox fields. Mark the ones that are required, set half or full width, and
  add help text under any field.
- **Choose what happens on send:** the button text, a thank-you message shown in place of the
  form, and "Email each submission to": the people to notify.
- **Put it on a page** with Add Section › Form.
- **Read submissions** under Forms › Submissions, newest first. Each one shows the answers
  as they were sent, which page it came from, and a status: New, Handled or Spam. The
  dashboard shows the newest ones still marked New. Replying to the notification email
  writes straight back to the sender.

A help article, "Forms and submissions", is added to the help drawer on first start.

## Spam and safety

Submissions only arrive through `POST /api/forms/:id/submit`. The collection itself refuses
writes from the public API. The endpoint:

- **Honeypot:** turns away bots that fill in a hidden field, or send the form under
  2 seconds after it appeared. They get a quiet "thanks" and nothing is saved.
- **Rate limit:** at most 5 submissions from one sender in 10 minutes. The sender is a salted
  hash of the IP address; the address itself is never stored.
- **Checks every answer:** required fields, the shape of emails and phone numbers, a real
  choice, and a 5,000-character cap.

The browser checks required fields first, so people get instant feedback; the server checks
everything again.

Who gets notified is never readable by the public. Forms and submissions are private: agents
don't touch them, and they aren't in the public catalog or MCP server.

Notifications go through the site's [email](../email.md). If email isn't set up yet, they're
written to the server log instead, and the submission is saved either way.
