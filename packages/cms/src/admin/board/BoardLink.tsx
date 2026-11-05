'use client'

import { Button, useConfig } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'

/** "Board" beside Create new on a list with drafts (lists/index.ts places it). */
export function BoardLink({ collection }: { collection: string }) {
  const { config } = useConfig()
  const url = formatAdminURL({ adminRoute: config.routes.admin, path: `/collections/${collection}/board` })
  return (
    <Button el="link" url={url} buttonStyle="secondary" size="medium" margin={false}>
      Board
    </Button>
  )
}
