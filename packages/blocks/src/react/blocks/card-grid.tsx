import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  Globe,
  Heart,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../cn'
import type { Card as CardData, CardGridBlock, CardIcon } from '../../types'
import { Band, MediaImg, SectionHeading, asMedia, linkAttrs, surfaceOf } from '../shared'
import { Button } from '../ui/button'
import { Card, CardBody, CardTitle } from '../ui/card'

const ICONS: Record<CardIcon, LucideIcon> = {
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  check: Check,
  zap: Zap,
  shield: Shield,
  globe: Globe,
  mail: Mail,
  phone: Phone,
  'map-pin': MapPin,
  calendar: Calendar,
  users: Users,
  'book-open': BookOpen,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  'arrow-right': ArrowRight,
}

const COLUMN_CLASSES: Record<string, string> = {
  two: 'sm:grid-cols-2',
  three: 'sm:grid-cols-2 lg:grid-cols-3',
  four: 'sm:grid-cols-2 lg:grid-cols-4',
}

function IconTile({ icon }: { icon: CardIcon }) {
  const Icon = ICONS[icon]
  return (
    <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-sk-accent/10 text-sk-accent">
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
    </div>
  )
}

function CardInner({ card, linked }: { card: CardData; linked: boolean }) {
  const hasImage = Boolean(asMedia(card.image)?.url)
  return (
    <>
      {hasImage ? (
        <div className="aspect-[3/2] overflow-hidden bg-sk-soft">
          <MediaImg
            media={card.image}
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, calc(100vw - 40px)"
            className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <CardBody className={cn(linked && 'pr-12')}>
        {!hasImage && card.icon ? <IconTile icon={card.icon} /> : null}
        <CardTitle>{card.title}</CardTitle>
        {card.text ? <p className="text-base leading-relaxed text-sk-muted">{card.text}</p> : null}
        {linked ? (
          <ArrowUpRight
            aria-hidden
            strokeWidth={1.75}
            className="absolute top-6 right-5 size-5 text-sk-muted motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        ) : null}
      </CardBody>
    </>
  )
}

/** A card with two links is one you act from: a button and a text link. */
function ActionCard({ card }: { card: CardData }) {
  const hasImage = Boolean(asMedia(card.image)?.url)
  const [primary, secondary] = card.link ?? []
  return (
    <Card className="gap-6 p-7">
      {card.icon ? (
        <IconTile icon={card.icon} />
      ) : hasImage ? (
        <div className="size-12 overflow-hidden rounded-xl bg-sk-soft">
          <MediaImg media={card.image} sizes="48px" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2">
        <CardTitle className="text-xl">{card.title}</CardTitle>
        {card.text ? <p className="text-base leading-relaxed text-sk-muted">{card.text}</p> : null}
      </div>
      {primary ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button {...linkAttrs(primary)}>{primary.label}</Button>
          {secondary ? (
            <a {...linkAttrs(secondary)} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              {secondary.label}
              {linkAttrs(secondary).target ? <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} /> : null}
            </a>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

/** Hand-authored cards; link cards lift on hover, still cards stay put. */
export function CardGrid({ block }: { block: CardGridBlock }) {
  const surface = surfaceOf(block.surface)
  const cards = block.cards ?? []
  const columns = COLUMN_CLASSES[block.columns ?? 'three']
  const actionCards = cards.some((card) => (card.link?.length ?? 0) > 1)
  return (
    <Band block="cardGrid" surface={surface} innerClassName="flex flex-col gap-10">
      <SectionHeading eyebrow={block.eyebrow} heading={block.heading} surface={surface} />
      <ul className={cn('grid grid-cols-1 gap-5', columns)}>
        {cards.map((card, index) => {
          const key = card.id ?? index
          if (actionCards) {
            return (
              <li key={key} className="flex">
                <ActionCard card={card} />
              </li>
            )
          }
          const link = card.link?.[0]
          return (
            <li key={key} className="flex">
              {link ? (
                <a
                  {...linkAttrs(link)}
                  className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-sk-line bg-sk-card text-sk-fg outline-none focus-visible:ring-[3px] focus-visible:ring-sk-accent/35 motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sk-fg/5"
                >
                  <CardInner card={card} linked />
                </a>
              ) : (
                <Card className="relative w-full">
                  <CardInner card={card} linked={false} />
                </Card>
              )}
            </li>
          )
        })}
      </ul>
    </Band>
  )
}
