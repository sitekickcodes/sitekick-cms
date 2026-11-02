import config from '@payload-config'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'

export const cms = () => getPayload({ config })

/** True when an editor is previewing a draft. */
export const isDraft = async () => (await draftMode()).isEnabled
