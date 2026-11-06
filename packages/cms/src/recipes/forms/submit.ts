import { createHash } from 'node:crypto'

import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { FORMS_SLUG, SUBMISSIONS_SLUG } from './collections'
import { checkAnswers, notificationOf, replyToOf, summaryOf, type FormDefinition } from './model'

/**
 * POST /api/forms/:id/submit, the only way a submission is created. In order:
 *
 *   honeypot   a hidden field people never see; anything in it is a bot
 *   too fast   sent under 2 seconds after the form appeared (`startedAt` from the page)
 *   rate       at most 5 from one sender in 10 minutes (a salted hash of the IP, never the IP)
 *   answers    required fields, email and phone shape, a real choice, a length cap
 *
 * Bots get a plain 200 so they learn nothing; people get their errors by field. Then the
 * submission is saved and everyone on the form's notify list is emailed (Reply-To: the
 * sender), through the site's email adapter. A failed email never loses a submission.
 */
export const MIN_FILL_MS = 2000
export const RATE = { max: 5, windowMs: 10 * 60 * 1000 }

type Body = { answers?: Record<string, unknown>; startedAt?: number; website?: string; page?: string }

export function submitEndpoint(): Endpoint {
  return {
    path: '/:id/submit',
    method: 'post',
    handler: async (req) => {
      const id = req.routeParams?.id
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Body
      const form = id
        ? ((await req.payload.findByID({ collection: FORMS_SLUG as CollectionSlug, id: String(id), depth: 0, overrideAccess: true, disableErrors: true, req })) as unknown as (FormDefinition & { notify?: { email: string }[] }) | null)
        : null
      if (!form) return Response.json({ error: 'This form no longer exists.' }, { status: 404 })
      const thanks = Response.json({ ok: true, message: form.confirmation || 'Thanks, we got it.' })

      if (typeof body.website === 'string' && body.website.trim()) return thanks
      if (typeof body.startedAt === 'number' && Date.now() - body.startedAt < MIN_FILL_MS) return thanks

      const sender = senderOf(req)
      const recent = await req.payload.count({
        collection: SUBMISSIONS_SLUG as CollectionSlug,
        where: { and: [{ sender: { equals: sender } }, { createdAt: { greater_than: new Date(Date.now() - RATE.windowMs).toISOString() } }] },
        overrideAccess: true,
        req,
      })
      if (recent.totalDocs >= RATE.max) return Response.json({ error: 'That’s a lot of messages in a short time. Please try again in a few minutes.' }, { status: 429 })

      const checked = checkAnswers(form, body.answers ?? {})
      if ('errors' in checked) return Response.json({ errors: checked.errors }, { status: 400 })

      const fields = form.fields ?? []
      const submission = await req.payload.create({
        collection: SUBMISSIONS_SLUG as CollectionSlug,
        data: { form: form.id, answers: checked.answers, summary: summaryOf(checked.answers, fields), status: 'new', page: typeof body.page === 'string' ? body.page.slice(0, 300) : undefined, sender } as never,
        overrideAccess: true,
        req,
      })

      const to = (form.notify ?? []).map((n) => n.email).filter(Boolean)
      if (to.length) {
        const { routes, serverURL } = req.payload.config
        const url = `${serverURL || originOf(req)}${routes.admin}/collections/${SUBMISSIONS_SLUG}/${submission.id}`
        const site = (req.payload.config.admin.custom as { sitekick?: { site?: { name?: string } } } | undefined)?.sitekick?.site?.name ?? 'the site'
        const email = notificationOf({ form, answers: checked.answers, site, url })
        const replyTo = replyToOf(checked.answers, fields)
        try {
          await req.payload.sendEmail({ to, ...email, ...(replyTo ? { replyTo } : {}) })
        } catch (err) {
          req.payload.logger.error({ err, msg: `Form "${form.title}": the notification email failed; the submission is saved (${submission.id})` })
        }
      }
      return thanks
    },
  }
}

function senderOf(req: PayloadRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${req.payload.secret}:form:${ip}`).digest('hex').slice(0, 32)
}

function originOf(req: PayloadRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return host ? `${proto}://${host}` : ''
}
