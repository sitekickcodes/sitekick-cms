'use client'

import { useConfig, useStepNav } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useEffect } from 'react'

import { INBOX_PATH } from '../../review/shared'

/**
 * Breadcrumbs for a proposal or run: "Inbox › <title>", since that's where people come from.
 * These custom edit views replace Payload's own, which is what normally sets them.
 */
export function useInboxCrumbs(title: string) {
  const { config } = useConfig()
  const { setStepNav } = useStepNav()
  const inbox = formatAdminURL({ adminRoute: config.routes.admin, path: INBOX_PATH })
  useEffect(() => setStepNav([{ label: 'Inbox', url: inbox }, { label: title }]), [setStepNav, inbox, title])
}
