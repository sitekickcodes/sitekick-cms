# Theme

The Sitekick admin look for Payload 4, as two stylesheets and a near-empty plugin.

```
theme.css       tokens only: --sk-* palette, --sk-admin-* shade scale, Payload 4 semantic tokens
admin.css       polish: element rules first, then EXCEPTION-marked rules on Payload classes
exceptions.ts   listExceptions(css), listRules(css), findUnmarkedRules(css)
index.ts        themePlugin({ theme? })  sets admin.theme and nothing else
__tests__/      bun test: every Payload-class rule in admin.css carries an EXCEPTION marker
```

## Wiring

Payload loads admin CSS from the app's `(payload)/custom.css`. A client app imports both files
there, then overrides:

```css
@import '@sitekick/cms/theme.css';
@import '@sitekick/cms/admin.css';

:root {
  --sk-accent: #0f766e;
}
```

`themePlugin()` is optional and does nothing unless given `{ theme: 'light' | 'dark' | 'all' }`
to pin a mode; `plugin.ts` can add it to its step list when that option is surfaced.

## Policy

1. **Tokens first.** Everything that Payload 4 exposes as a custom property is set in `theme.css`
   on `:root` / `html[data-theme]`: `--color-*`, `--field-*`, `--radius-*`, `--button-*`,
   `--text-body-family`, `--gutter-h`. Payload keeps its own rules in `@layer payload-default`,
   so unlayered token overrides win without naming a class. `theme.css` contains no class
   selector; the test enforces that.
2. **EXCEPTION-marked class rules second.** `@payloadcms/ui` class names are not a public API.
   Where a token cannot reach (pill buttons, the form-label hierarchy, tables, checkboxes,
   overflow fixes), `admin.css` names the class and carries `/* EXCEPTION: why */` within the
   three lines above the rule. If an upgrade renames the class, that one spot falls back to
   stock and nothing else breaks. `bun test src/theme` fails on an unmarked rule.
3. **Nothing client-specific.** No brand fonts, artwork, collection slugs or sidebar colours
   here. The sidebar (`src/nav`) and dashboard (`src/dashboard`) own their CSS modules; the
   only `.nav` rule here is the hairline between sidebar and page.

## Per-client overrides

Set on `:root` after the imports. Everything cascades from these:

| Variable            | Default                      | Reaches                                              |
| ------------------- | ---------------------------- | ---------------------------------------------------- |
| `--sk-accent`       | `#0f766e` (teal)             | success ramp: toasts, checkmarks, banners, toggles   |
| `--sk-focus`        | `#2563eb` (blue)             | focus rings, active tab, selected rows, filter badge |
| `--sk-font-body`    | system stack                 | `--text-body-family`, `--font-family-sans`, inputs   |
| `--sk-font-display` | `var(--sk-font-body)`        | h1-h3, section titles, join-table titles             |
| `--sk-danger`       | `#dc2626`                    | error ramp                                           |
| `--sk-warning`      | `#d97706`                    | warning ramp                                         |
| `--sk-tag-*`        | green / gold / warm neutral  | publish-state tags in the header and list cells      |
| `--sk-base-*`       | warm neutral ramp, 21 stops  | paper, cards, borders, secondary text, ink           |

Buttons are ink (`--color-bg-brand` maps to the text colour), not the accent; this is by
design, so an accent of any lightness never has to carry a button label.

Dark mode reads the same ramps reversed (`html[data-theme='dark']`), with `--sk-focus` stepped
up for contrast on ink.

## Host contracts

- `html[data-list-filters="n"]`: set by the nav module while a list URL carries filters; the
  Filters button takes the focus outline and shows `n` (up to `9+`).
- `.template-minimal--width-normal`: Payload's auth shell; the sign-in frame widens it to 528px.

## Payload 4.0.0-beta.6

Token names used here were checked against `@payloadcms/ui@4.0.0-beta.6`'s `dist/styles.css`.
Between beta.3 (the source project) and beta.6 no `--color-*`, `--field-*`, `--radius-*`,
`--button-*` or `--text-*` token was renamed; beta.6 adds `--color-border-control`,
`--color-border-control-strong`, `--color-border-menu-separator`, `--color-icon-favorite`,
`--accessibility-outline-inset` and `--collapsible-content-padding`, and drops the
`--recents-*` dashboard tokens for `--activity-*`. Markup that did change and is handled in
`admin.css`: `.tabs-field__tab-button--active` became `[aria-selected="true"]`,
`.login__form__forgotPassword` became `.login__form__forgot`, the list Filters/Sort toggles are
Buttons (not Pills) and the Columns/Group-by triggers are `.list-controls__toggle-group-by` /
`.group-by-control__select-trigger`; `.btn--size-small` no longer exists.
