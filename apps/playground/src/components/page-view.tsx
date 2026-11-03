import { RenderBlocks, RichText } from '@sitekick/blocks/react'

import { LivePreview } from '@/components/live-preview'
import type { Page } from '@/payload-types'
import { cms, isDraft } from '@/lib/cms'

/**
 * A page: the title block unless the layout opens with a hero (the hero
 * carries the h1 then), the sections, then the body copy.
 */
export async function PageView({ page }: { page: Page }) {
  const draft = await isDraft()
  const payload = await cms()
  const layout = page.layout ?? []
  const hasHero = layout[0]?.blockType === 'hero'
  return (
    <>
      {draft ? <LivePreview serverURL={payload.config.serverURL} /> : null}
      {hasHero ? null : (
        <header className="px-5 pt-16 pb-10 sm:px-8 sm:pt-24 lg:px-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{page.title}</h1>
            {page.intro ? <p className="max-w-2xl text-lg leading-relaxed text-sk-muted sm:text-xl">{page.intro}</p> : null}
          </div>
        </header>
      )}
      <RenderBlocks blocks={layout} />
      {page.body ? (
        <section data-block="body" className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <RichText data={page.body} className="max-w-2xl" />
          </div>
        </section>
      ) : null}
    </>
  )
}
