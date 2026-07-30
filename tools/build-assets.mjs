/**
 * Builds the custom-typography SVG assets used by the profile README.
 *
 * Text is converted to vector paths, so the SVGs render identically everywhere
 * (GitHub proxies README images through camo, which blocks web-font requests —
 * outlined text sidesteps that entirely). Brand marks come from simple-icons,
 * so every logo is the official vector rather than a third-party sprite sheet.
 *
 * Usage:  cd tools && npm install && npm run build
 * Fonts:  Space Grotesk + JetBrains Mono, downloaded on first run into tools/.fonts/
 *
 * Motion rule: never animate opacity or transform on text. Anywhere the
 * animation clock does not advance — image caches, some mobile clients, PNG
 * conversions — a faded-in element renders blank. Everything is drawn in its
 * final state; only decoration moves.
 */

import * as fontkit from 'fontkit'
import * as icons from 'simple-icons'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'assets')
const FONT_DIR = resolve(HERE, '.fonts')

/** Counts and repo activity, refreshed by fetch-data.mjs (see the workflow). */
const DATA = JSON.parse(readFileSync(resolve(HERE, 'data.json'), 'utf8'))

const FONT_SOURCES = {
  'SpaceGrotesk.ttf':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf',
  'JetBrainsMono.ttf':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
}

/* ─────────────────────────── type ─────────────────────────── */

async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true })
  for (const [name, url] of Object.entries(FONT_SOURCES)) {
    const path = resolve(FONT_DIR, name)
    if (existsSync(path)) continue
    process.stdout.write(`↓ ${name}\n`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`failed to download ${name}: ${res.status}`)
    writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  }
}

const faceCache = new Map()
function face(file, wght) {
  const key = `${file}:${wght}`
  if (!faceCache.has(key)) {
    faceCache.set(key, fontkit.openSync(resolve(FONT_DIR, file)).getVariation({ wght }))
  }
  return faceCache.get(key)
}

const display = (wght) => face('SpaceGrotesk.ttf', wght)
const mono = (wght) => face('JetBrainsMono.ttf', wght)

const round = (n) => Math.round(n * 100) / 100

/** SVG is parsed as XML, so attribute text has to be escaped. */
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * fontkit emits full float precision (`1.7999999999999998`), which more than
 * doubles the size of a text-heavy card for sub-hundredth-of-a-pixel accuracy
 * nobody can see. Two decimals is well past what a 13px glyph needs.
 */
const compact = (d) =>
  d
    .replace(/-?\d*\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100))
    .replace(/(^|[\s,])0\./g, '$1.')
    .replace(/-0\./g, '-.')

/** Outlines `str`; baseline sits at y = 0 and glyphs extend upwards. */
function outline(font, str, size, { tracking = 0 } = {}) {
  const scale = size / font.unitsPerEm
  const run = font.layout(str)
  const parts = []
  let x = 0

  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i]
    const d = glyph.path
      .transform(scale, 0, 0, -scale, (x + (pos.xOffset ?? 0)) * scale, 0)
      .toSVG()
    if (d) parts.push(compact(d))
    x += pos.xAdvance + tracking / scale
  })

  return { d: parts.join(''), width: x * scale }
}

/** <path> element with its baseline origin at (x, y). */
function text(font, str, size, { x = 0, y = 0, fill, tracking = 0, opacity } = {}) {
  const { d, width } = outline(font, str, size, { tracking })
  const attrs = [
    `d="${d}"`,
    fill ? `fill="${fill}"` : '',
    opacity != null ? `opacity="${opacity}"` : '',
    `transform="translate(${round(x)} ${round(y)})"`,
  ].filter(Boolean)
  return { svg: `<path ${attrs.join(' ')}/>`, width }
}

/* ─────────────────────────── colour ─────────────────────────── */

/**
 * GitHub's own Primer palette. Using the host's colours rather than a louder
 * custom scheme is what makes the cards read as part of the page instead of
 * stickers pasted onto it.
 */
const THEMES = {
  dark: {
    bg: '#0D1117',
    surface: '#151B23',
    surfaceAlt: '#10161E',
    border: '#242C37',
    grid: '#1B222C',
    text: '#E6EDF3',
    textSoft: '#9198A1',
    muted: '#6E7681',
    accent: '#58A6FF',
    accentDeep: '#1F6FEB',
    nameFrom: '#FFFFFF',
    nameTo: '#79C0FF',
    haloOpacity: '.18',
    monogramOpacity: '.14',
    codeBg: '#0D1117',
    codeKeyword: '#FF7B72',
    codeIdent: '#79C0FF',
    codeString: '#A5D6FF',
    codePunct: '#C9D1D9',
    /** Brand marks darker than this get lightened so they stay visible. */
    minIconLuma: 0.22,
    iconFallback: '#E6EDF3',
  },
  light: {
    bg: '#FFFFFF',
    surface: '#F6F8FA',
    surfaceAlt: '#FBFCFD',
    border: '#D1D9E0',
    grid: '#EAEEF2',
    text: '#1F2328',
    textSoft: '#59636E',
    muted: '#818B98',
    accent: '#0969DA',
    accentDeep: '#0550AE',
    nameFrom: '#1F2328',
    nameTo: '#0969DA',
    haloOpacity: '.10',
    monogramOpacity: '.10',
    codeBg: '#FFFFFF',
    codeKeyword: '#CF222E',
    codeIdent: '#0550AE',
    codeString: '#0A3069',
    codePunct: '#1F2328',
    minIconLuma: 0,
    iconFallback: '#1F2328',
  },
}

const luma = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/* ─────────────────────────── hero ─────────────────────────── */

const HERO = { w: 1200, h: 372 }

function hero(t) {
  const padX = 76
  const ringCx = 985
  const ringCy = 186

  const eyebrow = text(mono(700), 'FULL-STACK DEVELOPER', 13, {
    x: padX,
    y: 98,
    fill: t.accent,
    tracking: 4.6,
  }).svg

  const handle = text(mono(500), 'ahsan-mahfuz.pages.dev', 11, {
    fill: t.muted,
    tracking: 1.4,
  })
  const handleSvg = `<g transform="translate(${round(HERO.w - padX - handle.width)} 98)">${handle.svg}</g>`

  const name = text(display(700), 'Ahsan Mahfuz', 76, {
    x: padX - 3,
    y: 188,
    fill: 'url(#nameGrad)',
    tracking: -1.4,
  }).svg

  const lines = [
    'I build complete products — REST APIs, admin dashboards and the',
    'customer-facing app in front of them. TypeScript end to end.',
  ].map((line, i) =>
    text(display(500), line, 19, { x: padX, y: 234 + i * 29, fill: t.textSoft }),
  )
  const caret = `<rect x="${round(padX + lines[1].width + 7)}" y="${234 + 29 - 14}" width="9" height="16"
        rx="1.5" fill="${t.accent}" opacity=".85">
    <animate attributeName="opacity" values=".85;.85;0;0" keyTimes="0;.5;.52;1"
             dur="1.4s" repeatCount="indefinite"/>
  </rect>`

  const chips = ['BANGLADESH · GMT+6', 'OPEN TO WORK', 'REACT · NEXT.JS · NODE']
  let chipX = padX
  const chipSvg = chips.map((label, i) => {
    const inner = text(mono(500), label, 10.5, { fill: t.textSoft, tracking: 2.2 })
    const w = inner.width + (i === 1 ? 42 : 30)
    const dot =
      i === 1
        ? `<circle cx="17" cy="14" r="3.5" fill="#3FB950">
             <animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/>
           </circle>`
        : ''
    const g = `<g transform="translate(${round(chipX)} 302)">
      <rect width="${round(w)}" height="28" rx="14" fill="${t.surface}" stroke="${t.border}"/>
      ${dot}<g transform="translate(${i === 1 ? 27 : 15} 18.5)">${inner.svg}</g>
    </g>`
    chipX += w + 10
    return g
  })

  const monogram = outline(display(700), 'AM', 168, { tracking: -6 })
  const monoX = Math.min(ringCx - monogram.width / 2, HERO.w - 34 - monogram.width)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO.w}" height="${HERO.h}"
     viewBox="0 0 ${HERO.w} ${HERO.h}" role="img"
     aria-label="Ahsan Mahfuz — full-stack developer, Dhaka, Bangladesh">
  <defs>
    <linearGradient id="nameGrad" x1="0" y1="0" x2="1" y2="1">
      <animate attributeName="x1" values="-.15;.35;-.15" dur="9s" repeatCount="indefinite"/>
      <animate attributeName="x2" values=".85;1.5;.85" dur="9s" repeatCount="indefinite"/>
      <stop offset="0" stop-color="${t.nameFrom}"/>
      <stop offset="1" stop-color="${t.nameTo}"/>
    </linearGradient>
    <linearGradient id="monoGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accentDeep}"/>
      <stop offset="1" stop-color="${t.accent}"/>
    </linearGradient>
    <linearGradient id="topRule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accent}" stop-opacity="0"/>
      <stop offset=".35" stop-color="${t.accent}"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${t.accent}" stop-opacity="${t.haloOpacity}"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${t.grid}"/>
    </pattern>
    <clipPath id="card">
      <rect x="1" y="1" width="${HERO.w - 2}" height="${HERO.h - 2}" rx="20"/>
    </clipPath>
  </defs>

  <g clip-path="url(#card)">
    <rect width="${HERO.w}" height="${HERO.h}" fill="${t.bg}"/>
    <rect width="${HERO.w}" height="${HERO.h}" fill="url(#dots)"/>
    <ellipse cx="990" cy="150" rx="420" ry="300" fill="url(#glow)">
      <animate attributeName="opacity" values=".7;1;.7" dur="7s" repeatCount="indefinite"/>
    </ellipse>
    <g>
      <animateTransform attributeName="transform" type="rotate"
        from="0 ${ringCx} ${ringCy}" to="360 ${ringCx} ${ringCy}"
        dur="46s" repeatCount="indefinite"/>
      <circle cx="${ringCx}" cy="${ringCy}" r="148" fill="none" stroke="${t.accent}"
              stroke-opacity=".26" stroke-width="1" stroke-dasharray="2 9"/>
      <circle cx="${ringCx + 148}" cy="${ringCy}" r="4" fill="${t.accent}" opacity=".7"/>
    </g>
    <circle cx="${ringCx}" cy="${ringCy}" r="112" fill="none" stroke="${t.border}" stroke-width="1"/>
    <circle cx="${ringCx}" cy="${ringCy}" r="78" fill="none" stroke="${t.accent}"
            stroke-opacity=".18" stroke-width="1"/>
    <g transform="translate(${round(monoX)} ${ringCy + 42})">
      <path d="${monogram.d}" fill="url(#monoGrad)" opacity="${t.monogramOpacity}"/>
    </g>
    <rect x="${padX}" y="0" width="520" height="2" fill="url(#topRule)" opacity=".9"/>
    ${eyebrow}
    ${handleSvg}
    ${name}
    ${lines.map((l) => l.svg).join('\n    ')}
    ${caret}
    ${chipSvg.join('\n    ')}
  </g>
  <rect x=".5" y=".5" width="${HERO.w - 1}" height="${HERO.h - 1}" rx="20"
        fill="none" stroke="${t.border}"/>
</svg>
`
}

/* ────────────────────── section headings ────────────────────── */

const SECTIONS = [
  ['about', '01', 'About'],
  ['build', '02', 'What I Build'],
  ['stack', '03', 'Tech Stack'],
  ['work', '04', 'Selected Work'],
  ['process', '05', 'How I Work'],
  ['stats', '06', 'GitHub Stats'],
  ['graph', '07', 'Contribution Graph'],
  ['connect', '08', 'Connect'],
]

/**
 * Headings are deliberately theme-neutral — one file for both modes.
 *
 * `prefers-color-scheme` follows the operating system, not GitHub's own theme
 * toggle, so a visitor running GitHub in dark mode on a light OS gets the light
 * variant of every <picture>. For a solid card that is merely bright; for
 * transparent text it would mean near-invisible headings. These colours clear
 * contrast on both backgrounds, so the mismatch can never hide them.
 */
const NEUTRAL = {
  accent: '#1F6FEB',
  muted: '#7D8590',
}

function heading(index, title) {
  const w = 760
  const h = 46
  const baseline = 31

  const num = text(mono(700), index, 12.5, {
    x: 14,
    y: baseline - 2,
    fill: NEUTRAL.muted,
    tracking: 1.6,
  })
  const label = text(display(700), title, 25, {
    x: 14 + num.width + 16,
    y: baseline,
    fill: NEUTRAL.accent,
    tracking: -0.4,
  })
  const ruleX = 14 + num.width + 16 + label.width + 18

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NEUTRAL.accent}" stop-opacity=".5"/>
      <stop offset="1" stop-color="${NEUTRAL.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${baseline - 15}" width="4" height="18" rx="2" fill="${NEUTRAL.accent}"/>
  ${num.svg}
  ${label.svg}
  <rect x="${round(ruleX)}" y="${baseline - 6}" width="${round(w - ruleX)}" height="1" fill="url(#rule)"/>
</svg>
`
}

/* ─────────────────────── tech stack grid ─────────────────────── */

/** simple-icons exports are camel-cased and occasionally renamed. */
function brand(slug) {
  const candidates = [slug, ...(ICON_ALIASES[slug] ?? [])]
  for (const c of candidates) {
    const key = 'si' + c[0].toUpperCase() + c.slice(1)
    if (icons[key]) return icons[key]
  }
  throw new Error(`simple-icons has no mark for "${slug}"`)
}

// simple-icons dropped the AWS mark over trademark policy, so AWS is mentioned in
// the README copy instead of the grid.
const ICON_ALIASES = {
  css: ['css3'],
  node: ['nodedotjs'],
  next: ['nextdotjs'],
}

const STACK = [
  ['CORE', ['typescript', 'javascript', 'react', 'nextdotjs', 'nodedotjs', 'express', 'mongodb']],
  ['UI & STATE', ['redux', 'tailwindcss', 'framer', 'antdesign', 'html5', 'css']],
  ['DATA & AUTH', ['mongoose', 'firebase', 'jsonwebtokens', 'postman', 'socketdotio']],
  ['MOBILE', ['flutter', 'dart']],
  ['TOOLING & DEPLOY', ['git', 'github', 'vercel', 'netlify', 'figma', 'vite', 'npm']],
  ['LEARNING', ['docker', 'jest', 'graphql', 'postgresql']],
]

function stack(t) {
  const w = 1200
  const padX = 34
  const labelW = 172
  const rowGap = 14
  const chipH = 38
  const iconSize = 17

  let y = 34
  const rows = STACK.map(([groupLabel, slugs]) => {
    const label = text(mono(700), groupLabel, 10.5, {
      x: padX,
      y: y + 24,
      fill: t.muted,
      tracking: 2.2,
    }).svg

    let x = padX + labelW
    const chips = slugs.map((slug) => {
      const icon = brand(slug)
      const color = luma(icon.hex) < t.minIconLuma ? t.iconFallback : `#${icon.hex}`
      const name = text(display(500), icon.title, 13.5, { fill: t.text, tracking: -0.1 })
      const chipW = 18 + iconSize + 9 + name.width + 16
      const scale = round(iconSize / 24)

      const chip = `<g transform="translate(${round(x)} ${y})">
      <rect width="${round(chipW)}" height="${chipH}" rx="9" fill="${t.surface}" stroke="${t.border}"/>
      <g transform="translate(18 ${(chipH - iconSize) / 2}) scale(${scale})">
        <path d="${icon.path}" fill="${color}"/>
      </g>
      <g transform="translate(${round(18 + iconSize + 9)} ${chipH / 2 + 4.8})">${name.svg}</g>
    </g>`
      x += chipW + 8
      return chip
    })

    y += chipH + rowGap
    return label + '\n    ' + chips.join('\n    ')
  })

  const h = y + 20

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img"
     aria-label="${esc(STACK.map(([g, s]) => `${g}: ${s.join(', ')}`).join('; '))}">
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${t.surfaceAlt}" stroke="${t.border}"/>
  ${rows.join('\n    ')}
</svg>
`
}

/* ────────────────────────── link buttons ────────────────────────── */

/**
 * Hand-drawn marks for links that have no brand logo. Each is authored on a
 * 24×24 grid so it drops into the same slot as a simple-icons path.
 */
const CUSTOM_MARKS = {
  globe: (color) => `
    <g fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round">
      <circle cx="12" cy="12" r="9.2"/>
      <path d="M2.8 12h18.4"/>
      <path d="M12 2.8c2.5 2.5 3.8 5.7 3.8 9.2s-1.3 6.7-3.8 9.2c-2.5-2.5-3.8-5.7-3.8-9.2S9.5 5.3 12 2.8Z"/>
    </g>`,
  // LinkedIn asked simple-icons to drop its logo, so this is a neutral
  // "professional network" glyph rather than a redrawn trademark.
  network: (color) => `
    <g fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.4 13.4 15.6 9M8.4 10.6l7.2 4.4"/>
      <circle cx="5.8" cy="12" r="2.9"/>
      <circle cx="18.2" cy="7.4" r="2.9"/>
      <circle cx="18.2" cy="16.6" r="2.9"/>
    </g>`,
}

const BUTTONS = [
  { key: 'portfolio', label: 'Portfolio', mark: 'globe', primary: true },
  { key: 'linkedin', label: 'LinkedIn', mark: 'network' },
  { key: 'github', label: 'GitHub', slug: 'github' },
  { key: 'facebook', label: 'Facebook', slug: 'facebook' },
]

function linkButton(t, { label, slug, mark, primary }) {
  const h = 52
  const padX = 24
  const gap = 12
  const iconSize = 20
  const arrowW = primary ? 22 : 0

  const fg = primary ? '#FFFFFF' : t.text
  const name = text(display(600), label, 16, { fill: fg, tracking: -0.2 })
  const w = padX * 2 + iconSize + gap + name.width + arrowW

  let icon
  if (mark) {
    icon = CUSTOM_MARKS[mark](fg)
  } else {
    const brandMark = brand(slug)
    const color = primary
      ? '#FFFFFF'
      : luma(brandMark.hex) < t.minIconLuma
        ? t.iconFallback
        : `#${brandMark.hex}`
    icon = `<path d="${brandMark.path}" fill="${color}"/>`
  }

  const arrow = primary
    ? `<g transform="translate(${round(padX + iconSize + gap + name.width + 8)} ${h / 2})"
          fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
         <path d="M0 5 L9 -4"/><path d="M2.5 -4H9V2.5"/>
       </g>`
    : ''

  const surface = primary
    ? `<rect x=".5" y=".5" width="${round(w - 1)}" height="${h - 1}" rx="11"
             fill="url(#btnGrad)" stroke="${t.accent}"/>`
    : `<rect x=".5" y=".5" width="${round(w - 1)}" height="${h - 1}" rx="11"
             fill="${t.surface}" stroke="${t.border}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(w)}" height="${h}"
     viewBox="0 0 ${round(w)} ${h}" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="btnGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.accent}"/>
      <stop offset="1" stop-color="${t.accentDeep}"/>
    </linearGradient>
  </defs>
  ${surface}
  <g transform="translate(${padX} ${(h - iconSize) / 2}) scale(${round(iconSize / 24)})">${icon}</g>
  <g transform="translate(${round(padX + iconSize + gap)} ${h / 2 + 5.6})">${name.svg}</g>
  ${arrow}
</svg>
`
}

/* ────────────────────────── footer ────────────────────────── */

/** Theme-neutral, for the same reason as `heading()`. */
function footer() {
  const w = 1200
  const h = 96
  const line = text(mono(500), 'THANKS FOR STOPPING BY  ·  LET’S BUILD SOMETHING GOOD', 12, {
    fill: NEUTRAL.muted,
    tracking: 3.4,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img" aria-label="Thanks for stopping by">
  <defs>
    <linearGradient id="fRule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NEUTRAL.accent}" stop-opacity="0"/>
      <stop offset=".5" stop-color="${NEUTRAL.accent}" stop-opacity=".75"/>
      <stop offset="1" stop-color="${NEUTRAL.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="2" fill="url(#fRule)"/>
  <g transform="translate(${round((w - line.width) / 2)} 58)">${line.svg}</g>
  <circle cx="${w / 2}" cy="78" r="2.5" fill="${NEUTRAL.accent}" opacity=".8"/>
</svg>
`
}

/* ──────────────────── data-driven cards ──────────────────── */

const LANG_COLOR = {
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Dart: '#00B4AB',
  HTML: '#E34C26',
  CSS: '#563D7C',
}

const nf = (n) => n.toLocaleString('en-US')

/** "today" / "4 days ago" / "3 weeks ago" / "Oct 2025" */
function since(iso) {
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 35) return `${Math.floor(days / 7)} weeks ago`
  return then.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Four oversized counters. Numbers come from data.json, refreshed twice a day. */
function statsBar(t) {
  const w = 1200
  const h = 118
  const s = DATA.stats
  const cells = [
    [nf(s.repos), 'PUBLIC REPOSITORIES'],
    [nf(s.contributions), 'CONTRIBUTIONS · 12 MONTHS'],
    [nf(s.followers), 'FOLLOWERS'],
    [String(s.since), 'BUILDING SINCE'],
  ]
  const colW = w / cells.length

  const body = cells.map(([value, label], i) => {
    const cx = colW * i + colW / 2
    const num = text(display(700), value, 38, { fill: t.text, tracking: -1 })
    const cap = text(mono(500), label, 10, { fill: t.muted, tracking: 2.4 })
    const rule =
      i === 0
        ? ''
        : `<rect x="${round(colW * i)}" y="30" width="1" height="${h - 60}" fill="${t.border}"/>`
    return `${rule}
    <g transform="translate(${round(cx - num.width / 2)} 62)">${num.svg}</g>
    <g transform="translate(${round(cx - cap.width / 2)} 86)">${cap.svg}</g>`
  })

  const stamp = text(mono(500), `REFRESHED ${DATA.generatedAt}`, 8.5, {
    fill: t.muted,
    tracking: 1.6,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img"
     aria-label="${esc(cells.map(([v, l]) => `${v} ${l.toLowerCase()}`).join(', '))}">
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${t.surfaceAlt}" stroke="${t.border}"/>
  ${body.join('\n  ')}
  <g transform="translate(${round(w - 18 - stamp.width)} ${h - 10})" opacity=".75">${stamp.svg}</g>
</svg>
`
}

/* the snippet is authored as tokens so it can be coloured without a parser */
const CODE = [
  [['kw', 'const '], ['id', 'ahsan'], ['op', ' = {']],
  [['pl', '  role:  '], ['str', '"Full-Stack Developer"'], ['op', ',']],
  [['pl', '  site:  '], ['str', '"ahsan-mahfuz.pages.dev"'], ['op', ',']],
  [['pl', '  base:  '], ['str', '"Bangladesh (GMT+6)"'], ['op', ',']],
  [['pl', '  core:  '], ['op', '['], ['str', '"TypeScript"'], ['op', ', '], ['str', '"React"'], ['op', ', '], ['str', '"Next.js"'], ['op', '],']],
  [['pl', '  api:   '], ['op', '['], ['str', '"Node.js"'], ['op', ', '], ['str', '"Express"'], ['op', ', '], ['str', '"MongoDB"'], ['op', '],']],
  [['pl', '  state: '], ['op', '['], ['str', '"Redux Toolkit"'], ['op', ', '], ['str', '"RTK Query"'], ['op', '],']],
  [['pl', '  mobile:'], ['op', ' ['], ['str', '"Flutter"'], ['op', ', '], ['str', '"Dart"'], ['op', '],']],
  [['pl', '  next:  '], ['op', '['], ['str', '"AWS"'], ['op', ', '], ['str', '"Docker"'], ['op', ', '], ['str', '"Jest"'], ['op', '],']],
  [['op', '};']],
]

const FACTS = [
  ['PORTFOLIO', 'ahsan-mahfuz.pages.dev'],
  ['FOCUS', 'Product suites — API, dashboards, client app'],
  ['MAIN STACK', 'TypeScript · Next.js · Node · MongoDB'],
  ['ALSO SHIPPING', 'Flutter (Dart) mobile apps'],
  ['LEARNING', 'AWS · Docker · Jest & RTL'],
  ['AVAILABILITY', 'Open to freelance and full-time work'],
]

function aboutCard(t) {
  const w = 1200
  const h = 330
  const codeW = 646
  const lineH = 23

  const syntax = {
    kw: t.codeKeyword,
    id: t.codeIdent,
    str: t.codeString,
    op: t.codePunct,
    pl: t.textSoft,
  }

  const codeLines = CODE.map((tokens, row) => {
    let x = 26
    const parts = tokens.map(([kind, value]) => {
      const piece = text(mono(kind === 'kw' ? 700 : 500), value, 13, {
        x,
        y: 92 + row * lineH,
        fill: syntax[kind],
      })
      x += piece.width
      return piece.svg
    })
    return parts.join('')
  })

  const factRows = FACTS.map(([label, value], i) => {
    const y = 84 + i * 38
    const key = text(mono(700), label, 9.5, { x: codeW + 46, y, fill: t.muted, tracking: 2 })
    const val = text(display(500), value, 14.5, { x: codeW + 46, y: y + 19, fill: t.text })
    const rule =
      i === 0
        ? ''
        : `<rect x="${codeW + 46}" y="${y - 20}" width="${w - codeW - 92}" height="1" fill="${t.border}" opacity=".7"/>`
    return `${rule}${key.svg}${val.svg}`
  })

  const filename = text(mono(500), 'ahsan.ts', 11, { fill: t.muted, tracking: 1 })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img"
     aria-label="${esc(FACTS.map(([k, v]) => `${k}: ${v}`).join('; '))}">
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${t.surfaceAlt}" stroke="${t.border}"/>
  <rect x="18" y="18" width="${codeW}" height="${h - 36}" rx="12" fill="${t.codeBg}" stroke="${t.border}"/>
  <circle cx="42" cy="46" r="5" fill="#FF5F57" opacity=".85"/>
  <circle cx="60" cy="46" r="5" fill="#FEBC2E" opacity=".85"/>
  <circle cx="78" cy="46" r="5" fill="#28C840" opacity=".85"/>
  <g transform="translate(${round(18 + codeW / 2 - filename.width / 2)} 50)">${filename.svg}</g>
  <rect x="18" y="62" width="${codeW}" height="1" fill="${t.border}" opacity=".6"/>
  <g transform="translate(18 0)">${codeLines.join('\n  ')}</g>
  ${factRows.join('\n  ')}
</svg>
`
}

const PROJECTS = [
  {
    key: 'happy-photo',
    name: 'Happy Photo',
    blurb: 'One product across four surfaces — API, merchant dashboard, admin dashboard and a Flutter app.',
    primary: 'happyphoto_backend',
    surfaces: 4,
  },
  {
    key: 'theo',
    name: 'Theo',
    blurb: 'Service, internal dashboard and public frontend, kept in step through one typed API.',
    primary: 'theo_backend',
    surfaces: 3,
  },
  {
    key: 'net-snap',
    name: 'Net Snap',
    blurb: 'Paired backend and frontend built and deployed together.',
    primary: 'georgecowin385_net_snap_frontend',
    surfaces: 2,
  },
  {
    key: 'product-management',
    name: 'Product Management App',
    blurb: 'Inventory and product CRUD with role-aware access.',
    primary: 'bitechx-product-management-app',
    surfaces: 1,
  },
  {
    key: 'weather-api',
    name: 'Weather API',
    blurb: 'Compact REST service — a clean reference for request handling and error shapes.',
    primary: 'weather-api',
    surfaces: 1,
  },
]

function projectCard(t, project) {
  const w = 588
  const h = 176
  const meta = DATA.repos[project.primary] ?? { language: 'TypeScript', lastPush: DATA.generatedAt }
  const langColor = LANG_COLOR[meta.language] ?? t.accent

  const name = text(display(700), project.name, 21, { x: 26, y: 50, fill: t.text, tracking: -0.4 })

  const words = project.blurb.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (outline(display(500), candidate, 13.5).width > w - 60 && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  lines.push(line)
  const blurb = lines
    .slice(0, 3)
    .map((l, i) => text(display(500), l, 13.5, { x: 26, y: 80 + i * 21, fill: t.textSoft }).svg)

  const chips = [
    { label: meta.language, dot: langColor },
    { label: `${project.surfaces} ${project.surfaces === 1 ? 'repository' : 'repositories'}` },
    { label: `updated ${since(meta.lastPush)}` },
  ]
  let chipX = 26
  const chipSvg = chips.map((chip) => {
    const label = text(mono(500), chip.label.toUpperCase(), 9.5, { fill: t.muted, tracking: 1.6 })
    const cw = label.width + (chip.dot ? 38 : 24)
    const g = `<g transform="translate(${round(chipX)} ${h - 48})">
      <rect width="${round(cw)}" height="26" rx="13" fill="${t.surface}" stroke="${t.border}"/>
      ${chip.dot ? `<circle cx="16" cy="13" r="4" fill="${chip.dot}"/>` : ''}
      <g transform="translate(${chip.dot ? 28 : 12} 17)">${label.svg}</g>
    </g>`
    chipX += cw + 8
    return g
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`${project.name}: ${project.blurb}`)}">
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="${t.surfaceAlt}" stroke="${t.border}"/>
  <rect x="0" y="18" width="3" height="42" rx="1.5" fill="${t.accent}"/>
  ${name.svg}
  ${blurb.join('\n  ')}
  ${chipSvg.join('\n  ')}
</svg>
`
}

function connectCard(t) {
  const w = 1200
  const h = 150

  const status = text(display(700), 'Available for freelance projects and full-time roles', 22, {
    fill: t.text,
    tracking: -0.4,
  })
  const sub = text(display(500), 'Bangladesh (GMT+6) · working with teams worldwide · fastest reply on LinkedIn', 15, {
    fill: t.textSoft,
  })
  const eyebrow = text(mono(700), 'OPEN TO WORK', 10.5, { fill: '#3FB950', tracking: 3 })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img"
     aria-label="Open to work: available for freelance projects and full-time roles">
  <defs>
    <linearGradient id="cGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.accent}" stop-opacity=".14"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${t.surfaceAlt}" stroke="${t.border}"/>
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="url(#cGlow)"/>
  <g transform="translate(${round((w - eyebrow.width - 18) / 2)} 46)">
    <circle cx="4" cy="-4" r="4.5" fill="#3FB950">
      <animate attributeName="opacity" values="1;.3;1" dur="2.4s" repeatCount="indefinite"/>
    </circle>
    <g transform="translate(18 0)">${eyebrow.svg}</g>
  </g>
  <g transform="translate(${round((w - status.width) / 2)} 88)">${status.svg}</g>
  <g transform="translate(${round((w - sub.width) / 2)} 116)">${sub.svg}</g>
</svg>
`
}

/* ────────────────────────── build ────────────────────────── */

await ensureFonts()
mkdirSync(OUT, { recursive: true })

const written = []
const write = (name, svg) => {
  writeFileSync(resolve(OUT, name), svg)
  written.push(name)
}

for (const [mode, t] of Object.entries(THEMES)) {
  write(`hero-${mode}.svg`, hero(t))
  write(`stack-${mode}.svg`, stack(t))
  write(`about-${mode}.svg`, aboutCard(t))
  write(`stats-${mode}.svg`, statsBar(t))
  write(`connect-${mode}.svg`, connectCard(t))
  for (const project of PROJECTS) {
    write(`proj-${project.key}-${mode}.svg`, projectCard(t, project))
  }
  for (const config of BUTTONS) {
    write(`btn-${config.key}-${mode}.svg`, linkButton(t, config))
  }
}

// One file each: see the note on `heading()`.
write('footer.svg', footer())
for (const [slug, index, title] of SECTIONS) {
  write(`h-${slug}.svg`, heading(index, title))
}

console.log(`✓ wrote ${written.length} assets to assets/`)
