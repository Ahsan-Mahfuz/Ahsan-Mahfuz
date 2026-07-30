# Profile assets

Nearly every visual in the profile README — banner, link buttons, stat bar, about card,
project cards, section headings, tech-stack card, connect card, footer — is a generated
SVG. Typography is **Space Grotesk** (display) and **JetBrains Mono** (labels), converted
to vector outlines at build time: GitHub serves README images through its camo proxy,
which blocks web-font requests, so outlined text is the only way to keep a custom typeface
rendering everywhere.

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

## Live numbers

Counters and "updated N days ago" chips are baked into SVGs, so something has to keep
them true. [`fetch-data.mjs`](./fetch-data.mjs) queries the GitHub GraphQL API and rewrites
[`data.json`](./data.json); `build-assets.mjs` reads that file.
[`.github/workflows/refresh-assets.yml`](../.github/workflows/refresh-assets.yml) runs both
every 12 hours and commits whatever changed.

```bash
GITHUB_TOKEN=<token> node fetch-data.mjs && npm run build
```

The repositories it refreshes are the keys under `repos` in `data.json` — add a project
card and you add its primary repo there too.

## Editing

Everything else lives in [`build-assets.mjs`](./build-assets.mjs):

| What | Where |
| --- | --- |
| Name, tagline, chips, handle | `hero()` |
| Colours for both themes | `THEMES` |
| Section numbers and titles | `SECTIONS` |
| Tech groups and their logos | `STACK` (slugs are simple-icons names) |
| Link buttons | `BUTTONS` + `CUSTOM_MARKS` |
| Code snippet and fact rows | `CODE`, `FACTS` |
| Project cards | `PROJECTS` |
| Availability wording | `connectCard()` |
| Footer line | `footer()` |

Adding a tool is one entry in `STACK` — the label, colour and layout come from the icon
data. If a slug has been renamed upstream the build fails loudly rather than silently
dropping the logo; add the new name to `ICON_ALIASES`. AWS and LinkedIn have no
simple-icons marks any more (trademark policy): AWS is named in the README copy, and
LinkedIn uses a neutral network glyph from `CUSTOM_MARKS` rather than a redrawn logo.

## Two rules worth keeping

**Never animate opacity or transform on text.** Anywhere the animation clock does not
advance — image caches, some mobile clients, PNG conversions — a faded-in element renders
blank. Elements are drawn in their final state and only decoration moves: the orbit ring,
the halo, the name's colour sweep, the caret.

**Transparent, text-only assets get one theme-neutral file.** Solid cards ship as
`*-dark.svg` and `*-light.svg`, picked with `<picture>` + `prefers-color-scheme`. But that
media query follows the *operating system*, not GitHub's theme toggle — a visitor running
GitHub in dark mode on a light OS gets the light variant. For a card that is merely
bright; for transparent text it would mean invisible headings. So headings and the footer
use `NEUTRAL` colours that clear contrast on both backgrounds and ship as a single file.
