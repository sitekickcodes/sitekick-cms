A page is a title, an intro, and a list of **sections** that editors add, reorder and
remove. Each section is a block from `@sitekick/blocks`, designed to look right whatever is
typed into it.

## The sections

| Section | Use it for |
| --- | --- |
| Hero | The top of a page: eyebrow, big heading, a line, up to two buttons, an optional image. At most one per page. |
| Text | Body copy, at reading width or the full column. |
| Image + text | A photo beside a heading, text and one link. Image left or right. |
| Stats | Two to four headline figures with labels. |
| Quote | One pull quote with who said it. |
| Card grid | Hand-written cards: title, photo or icon, text, up to two links. |
| FAQ | Questions and answers that open on click. |
| Call to action | The closing band: heading, a line, one or two buttons. |

Lists of records, such as team members, posts or events, are collections with their own
pages, never cards typed by hand.

Sections pick a **surface** (light, soft, dark or accent), never a colour. A site restyles
every section by changing its design tokens, so editors can't make a page off-brand.

Every link is a label plus either a page on the site or a web address, with an
open-in-a-new-tab checkbox. Linking to a page means the link keeps working when that page's
URL changes.

## In a collection

```ts
import { editorConfig, layoutField } from '@sitekick/blocks'

fields: [
  { name: 'title', type: 'text', required: true },
  { name: 'body', type: 'richText', editor: editorConfig() },
  layoutField(), // `layout`: the sections
]
```

## On the site

```tsx
import { RenderBlocks, RichText } from '@sitekick/blocks/react'

<RenderBlocks blocks={page.layout} />
<RichText data={page.body} />
```

The renderers use Tailwind 4. A site imports the tokens and points Tailwind at the package:

```css
@import 'tailwindcss';
@import '@sitekick/blocks/styles.css';
@source '../../../node_modules/@sitekick/blocks/dist';

:root {
  --sk-accent: #c2410c;
}
```

Changing a page by describing the change, such as "add an FAQ about parking below the
hero", is [Edit with words](./agents.md#edit-with-words).

The full reference is [@sitekick/blocks](/reference/blocks).
