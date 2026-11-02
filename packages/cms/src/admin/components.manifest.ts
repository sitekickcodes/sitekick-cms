/**
 * Export names of the admin components created by the conventions port, each
 * referenced as `@sitekick/cms/admin#<Name>`. Wire them in admin/index.ts.
 */
export const conventionComponents = [
  // admin/RowLabel.tsx
  'AutoRowLabel',
  // admin/RelationshipCell.tsx
  'RelationshipCell',
  // admin/UploadPreview.tsx
  'UploadPreview',
  'MetaImageWithPreview',
  // admin/OpenLink.tsx
  'OpenLink',
  'EmailLink',
  'CallLink',
  // admin/SEOFields.tsx
  'SEOOverview',
  'SEOTitle',
  'SEODescription',
  'SEOImage',
  'SEOPreview',
  // admin/SEOAutofill.tsx
  'SEOAutofill',
  'SEOAutofillNote',
  // admin/StatusTag.tsx
  'Tag',
  'StatusTag',
  'StatusCell',
  // admin/CheckboxesField.tsx
  'CheckboxesField',
] as const
