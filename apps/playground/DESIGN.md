# Playground design

The single visual reference for the playground site. Block renderers in `@sitekick/blocks` and the app's own pages follow this; if a rule changes, change it here first.

## Convention (LBC)

Look, Build, Check. Every page is built from tokens (look), composed from blocks and a handful of primitives (build), and read back in the live preview before publishing (check). Nothing is styled ad hoc: a colour that isn't a token, or a spacing step that isn't on the scale, is a bug.

## Tokens

Defined in `@sitekick/blocks/styles.css`, overridden on `:root` in `src/app/(frontend)/globals.css`.

| Token | Role | Default |
| --- | --- | --- |
| `--sk-bg` | Page background, warm off-white | `#faf8f4` |
| `--sk-fg` | Ink | `#1c1a17` |
| `--sk-muted` | Secondary ink | `#5f5a52` |
| `--sk-soft` | Tinted band | `#f1ede5` |
| `--sk-line` | Hairlines and card borders | `#e3ddd2` |
| `--sk-card` | Card surface | `#ffffff` |
| `--sk-dark` / `--sk-dark-fg` | Dark band and its ink | `#1c1a17` / `#faf8f4` |
| `--sk-accent` / `--sk-accent-fg` | Brand colour and its ink | `#0f766e` / `#ffffff` |
| `--sk-font-sans` / `--sk-font-display` | Body and heading faces (system stack) | |

Utilities: `bg-sk-*`, `text-sk-*`, `border-sk-*`, `font-display`.

## Surfaces

Bands choose from `light`, `soft`, `dark`, `accent`. Dark and accent invert text and switch buttons to the light tones. No block carries its own colour.

## Type

- Hero `h1`: 36 / 48 / 60px, semibold, tight tracking, balanced.
- Section `h2`: 30 / 36px, semibold.
- Eyebrow: 12px, semibold, 0.14em tracking, uppercase, accent.
- Body: 17px / 1.65 inside `.sk-prose`; 16px elsewhere.
- Headings use `font-display`, which is the sans by default. A client can swap it without touching blocks.

## Spacing

Bands are `py-16 sm:py-20` with `px-5 sm:px-8 lg:px-12`; the inner column is `max-w-6xl`. Reading width is `max-w-2xl`. Gaps inside a band are 5, 6, 10 or 12 on the Tailwind scale.

## Shape

Buttons are pills. Cards and photos are `rounded-2xl`; the hero image is `rounded-3xl`. Hairline borders, no drop shadows at rest; linked cards lift 2px and gain a soft shadow on hover.

## Motion

Only hover and disclosure transitions, 200ms, ease-out. Everything is wrapped in `motion-safe:` so `prefers-reduced-motion` removes it. No scroll reveals, no count-ups.

## Semantics

One `h1` per page (the hero's, or the page title). Sections are `<section data-block="…">`; the hero is a `<header>`. Stats are a `<dl>`, quotes a `<figure>`, the FAQ a real disclosure (`button[aria-expanded]` + region).
