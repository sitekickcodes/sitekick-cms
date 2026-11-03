# @sitekick/blocks

Block schemas, a shared rich-text editor and React renderers for Sitekick CMS pages. Client-agnostic: nothing in here knows what the site is about.

```ts
import { createBlocks, layoutField, editorConfig } from '@sitekick/blocks'
import { RenderBlocks, RichText } from '@sitekick/blocks/react'
```

| Export | What it is |
| --- | --- |
| `.` | Block schemas (`createBlocks`, one factory per block), `layoutField`, `blockGroups`, shared field builders, hand-written block types |
| `./lexical` | `editorConfig()`: the one Lexical editor every rich-text field uses |
| `./react` | `RenderBlocks`, `RichText`, one renderer per block, the shared chrome and the UI primitives |
| `./styles.css` | Design tokens (`--sk-*`), the `sk-*` colour utilities and the `.sk-prose` rhythm |

## The blocks

Three groups in the "add section" picker (`blockGroups`).

| Slug | Group | Use it for |
| --- | --- | --- |
| `hero` | Designed sections | The top of a page: eyebrow, big heading, a line, up to two buttons, an optional image. At most one per page (`layoutField` validates). |
| `richText` | Basics | Body copy. Reading width or the full column. |
| `imageText` | Designed sections | A photo beside a kicker, heading, prose and one link. Image left or right. |
| `stats` | Designed sections | Two to four headline figures with labels. |
| `quote` | Designed sections | One pull quote with who said it. Plain text. |
| `cardGrid` | Designed sections | Hand-written cards: title, photo or icon, text, up to two links. One link makes the card clickable; two turn it into an action card. |
| `faq` | Designed sections | Question and answer disclosures. |
| `cta` | Calls to action | The closing band: heading, a line, one or two buttons (one is required). |

Lists of records (team, posts, events) are collections with their own pages, never cards typed by hand.

### Surfaces

Bands pick a named surface, never a colour: `light`, `soft`, `dark`, `accent`. The renderers map these to the `--sk-*` tokens, so a client site restyles by overriding variables, not by editing blocks.

### Links

Every link is a label plus either a page on this site (a relationship) or a URL, with an "open in a new tab" checkbox. Renderers resolve a page to `/<slug>` (`home` is `/`). Relationships must be populated (`depth: 1`) or the link falls back to `#`.

## Wiring an app

**Payload config.** Add the layout to a collection and use the shared editor for any rich text:

```ts
import { editorConfig, layoutField } from '@sitekick/blocks'

fields: [
  { name: 'body', type: 'richText', editor: editorConfig() },
  layoutField(), // name `layout`, labels Section / Sections
]
```

Collection slugs are options when they differ: `layoutField({ media: 'images', pages: 'articles' })`, `editorConfig({ pages: 'articles' })`.

**Tailwind.** The renderers use Tailwind 4 utilities, so the app must scan the package source and import the tokens. In the app's `globals.css`:

```css
@import 'tailwindcss';
@import '@sitekick/blocks/styles.css';
@source '../../node_modules/@sitekick/blocks/src';
```

The `@source` path is relative to the CSS file; inside this monorepo the playground points at `packages/blocks/src` directly. Override tokens on `:root` after the import:

```css
:root {
  --sk-accent: #b45309;
}
```

**Rendering.**

```tsx
import { RenderBlocks, RichText } from '@sitekick/blocks/react'

<RenderBlocks blocks={page.layout} />
<RichText data={page.body} />
```

`RenderBlocks` accepts `components` to swap a renderer per slug, for example a hero that uses `next/image`. Every section root carries `data-block="<slug>"`.

## Adding a block

1. **Schema**: `src/blocks/<slug>.ts` exporting a factory that returns a Payload `Block` with `admin.group` from `blockGroups`. Add it to `createBlocks` in `src/blocks/index.ts` and to `blockSlugs` in `src/types.ts`.
2. **Type**: add `<Name>Block` to `src/types.ts` and to the `LayoutBlock` union. The types mirror the schema by hand; the app's generated types are not available here.
3. **Renderer**: `src/react/blocks/<slug>.tsx`, one component taking `{ block }`, built on `Band`, `SectionHeading` and the shared helpers.
4. **Switch case**: add the slug to `blockComponents` and the `switch` in `src/react/render-blocks.tsx`. The switch is total, so TypeScript reports the missing case.
5. `bun test` checks the slug list and the renderer map agree.

## Scripts

```
bun run typecheck
bun test
```
