import type { PayloadRequest } from 'payload'

import { HELP_WELCOME_PREFERENCE } from '../../help/shared'
import { WelcomeCard } from './WelcomeCard'

/** Read on the server so a dismissed welcome never flashes on return visits. */
export async function Welcome({ req, siteName }: { req: PayloadRequest; siteName: string }) {
  const user = req.user
  if (!user) return null
  const { docs } = await req.payload.find({
    collection: 'payload-preferences',
    where: {
      and: [
        { key: { equals: HELP_WELCOME_PREFERENCE } },
        { 'user.relationTo': { equals: user.collection } },
        { 'user.value': { equals: user.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    req,
  })
  return (docs[0] as { value?: unknown } | undefined)?.value === true ? null : <WelcomeCard siteName={siteName} />
}
