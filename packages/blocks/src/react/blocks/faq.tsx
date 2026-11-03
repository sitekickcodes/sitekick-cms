import type { FaqBlock } from '../../types'
import { RichText } from '../rich-text'
import { Band, SectionHeading } from '../shared'
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from '../ui/accordion'

/** Question/answer disclosure list, one open at a time. */
export function Faq({ block }: { block: FaqBlock }) {
  return (
    <Band block="faq" innerClassName="flex max-w-3xl flex-col gap-10">
      <SectionHeading eyebrow={block.eyebrow} heading={block.heading} />
      <Accordion>
        {(block.items ?? []).map((item, index) => (
          <AccordionItem key={item.id ?? index} value={item.id ?? String(index)}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionPanel>
              <RichText data={item.answer} />
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </Band>
  )
}
