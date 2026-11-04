import type { GlobalConfig } from 'payload'

import { site } from '../lib/site'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Website', description: 'Name, contact details and footer. Changes show everywhere at once.' },
  access: { read: () => true },
  fields: [
    { name: 'siteName', type: 'text', required: true, defaultValue: site.name },
    { name: 'tagline', type: 'text', admin: { description: 'Under the name in the footer and in search results for the homepage.' } },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'textarea' },
      ],
    },
  ],
}
