# Profile assets

The banner, section headings, tech-stack card and footer in the profile README are
generated SVGs, not screenshots. Typography is **Space Grotesk** (display) and
**JetBrains Mono** (labels), converted to vector outlines at build time — GitHub serves
README images through its camo proxy, which blocks web-font requests, so outlined text is
the only way to keep a custom typeface rendering everywhere.

Brand marks come from [simple-icons](https://simpleicons.org), so each logo is the
official vector in its official colour. Marks too dark to read on the dark theme are
swapped for the foreground colour automatically (`minIconLuma`). Colours throughout are
GitHub's own Primer palette, which is what makes the cards sit in the page rather than on
top of it.

## Regenerate

```bash
cd tools
npm install          # fontkit + simple-icons
npm run build        # downloads the fonts on first run, writes ../assets/*.svg
```

Fonts land in `tools/.fonts/` and both that folder and `node_modules/` are gitignored.

## Editing

Everything lives in [`build-assets.mjs`](./build-assets.mjs):

| What | Where |
| --- | --- |
| Name, tagline, chips, handle | `hero()` |
| Colours for both themes | `THEMES` |
| Section numbers and titles | `SECTIONS` |
| Tech groups and their logos | `STACK` (slugs are simple-icons names) |
| Footer line | `footer()` |

Adding a tool is one entry in `STACK` — the label, colour and layout come from the icon
data. If a slug has been renamed upstream the build fails loudly rather than silently
dropping the logo; add the new name to `ICON_ALIASES`. AWS has no simple-icons mark
(trademark policy), which is why it appears in the README copy instead.

Two files are written per asset — `*-dark.svg` and `*-light.svg` — and the README picks
between them with `<picture>` + `prefers-color-scheme`.

One rule worth keeping: **never animate opacity or transform on text.** Anywhere the
animation clock does not advance (image caches, some mobile clients, PNG conversions) a
faded-in element renders blank. Elements are drawn in their final state and only
decoration moves — the orbit ring, the halo, the name's colour sweep, the caret.
