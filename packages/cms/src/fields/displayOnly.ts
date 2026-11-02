import type { Field } from 'payload'

/**
 * Every field read-only in the admin except the ones named in `editable`
 * (records a form filed, like a newsletter sign-up, show what came in; they
 * aren't for editing). Walks tabs, groups, rows and collapsibles. Admin
 * only: hooks and syncs still write these fields.
 */
export function displayOnly(fields: Field[], editable: string[] = []): Field[] {
  const keep = new Set(editable)
  const walk = (list: Field[]): Field[] =>
    list.map((field) => {
      if (field.type === 'tabs') return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: walk(tab.fields) })) }
      if (field.type === 'ui') return field
      if ('name' in field && field.name && keep.has(field.name)) return field
      const withKids = 'fields' in field && Array.isArray(field.fields) ? { ...field, fields: walk(field.fields) } : field
      // groups, rows and collapsibles take their children's state; a named
      // group is also locked itself
      if (field.type === 'row' || field.type === 'collapsible') return withKids
      return { ...withKids, admin: { ...withKids.admin, readOnly: true } } as Field
    })
  return walk(fields)
}
