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
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'assets')
const FONT_DIR = resolve(HERE, '.fonts')

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
    if (d) parts.push(d)
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

  const handle = text(mono(500), 'github.com/Ahsan-Mahfuz', 11, {
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

function heading(t, index, title) {
  const w = 760
  const h = 46
  const baseline = 31

  const num = text(mono(700), index, 12.5, {
    x: 14,
    y: baseline - 2,
    fill: t.accent,
    tracking: 1.6,
  })
  const label = text(display(700), title, 25, {
    x: 14 + num.width + 16,
    y: baseline,
    fill: t.text,
    tracking: -0.4,
  })
  const ruleX = 14 + num.width + 16 + label.width + 18

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accent}" stop-opacity=".5"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${baseline - 15}" width="4" height="18" rx="2" fill="${t.accent}"/>
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

/* ────────────────────────── footer ────────────────────────── */

function footer(t) {
  const w = 1200
  const h = 96
  const line = text(mono(500), 'THANKS FOR STOPPING BY  ·  LET’S BUILD SOMETHING GOOD', 12, {
    fill: t.muted,
    tracking: 3.4,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}" role="img" aria-label="Thanks for stopping by">
  <defs>
    <linearGradient id="fRule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accent}" stop-opacity="0"/>
      <stop offset=".5" stop-color="${t.accent}" stop-opacity=".75"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="2" fill="url(#fRule)"/>
  <g transform="translate(${round((w - line.width) / 2)} 58)">${line.svg}</g>
  <circle cx="${w / 2}" cy="78" r="2.5" fill="${t.accent}" opacity=".8"/>
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
  write(`footer-${mode}.svg`, footer(t))
  for (const [slug, index, title] of SECTIONS) {
    write(`h-${slug}-${mode}.svg`, heading(t, index, title))
  }
}

console.log(`✓ wrote ${written.length} assets to assets/`)
