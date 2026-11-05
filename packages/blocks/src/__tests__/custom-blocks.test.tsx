import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { RenderBlocks } from '../react/render-blocks'

describe('RenderBlocks with a site’s own sections', () => {
  const Upcoming = ({ block }: { block: { heading?: string } }) => <section data-block="upcomingEvents">{block.heading}</section>

  test('renders a custom section with its renderer, next to library ones', () => {
    const html = renderToStaticMarkup(<RenderBlocks blocks={[{ blockType: 'quote', quote: 'Hi', id: 'a' } as never, { blockType: 'upcomingEvents', heading: 'Coming up', id: 'b' } as never]} custom={{ upcomingEvents: Upcoming }} />)
    expect(html).toContain('data-block="quote"')
    expect(html).toContain('<section data-block="upcomingEvents">Coming up</section>')
  })

  test('a section with no renderer says so while developing', () => {
    const html = renderToStaticMarkup(<RenderBlocks blocks={[{ blockType: 'mystery', id: 'c' }]} />)
    expect(html).toContain('No renderer for the “mystery” section')
  })
})
