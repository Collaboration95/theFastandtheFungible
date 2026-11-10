#!/usr/bin/env node
// The link-preview card for /proof/:id pages (lane W1): "Refused to spend · verified on XRPL", S$0.00.
// One static 1200×630 card; the per-proof question travels in the page's og:title/og:description text, so no
// rasteriser runs in production. Same method as build-brand.mjs: Geist outlined with fontkit, Chromium for the PNG.
//   node design/brand/build-proof-og.mjs        (no network, no OS fonts)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openSync } from 'fontkit'
import { chromium } from 'playwright'
import { palette as P } from '../cast/build-cast.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const base = openSync(resolve(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'))
// The brand cards use Geist at its default (Regular) weight; so does this one.
function text(s, x, y, size, color = P.ink) {
  const font = base, run = font.layout(s); let advance = 0
  const glyphs = run.glyphs.map((g, i) => { const p = run.positions[i]; const out = `<path transform="translate(${advance + p.xOffset} ${p.yOffset})" d="${g.path.toSVG()}"/>`; advance += p.xAdvance; return out }).join('')
  return { body: `<g fill="${color}" transform="translate(${x} ${y}) scale(${size / font.unitsPerEm} ${-size / font.unitsPerEm})">${glyphs}</g>`, width: advance * size / font.unitsPerEm }
}
const MUTED = '#655D55', RULE = '#C9BFB2'
const mark = (color = P.ink) => `<path d="M9 4H4v16h5M15 4h5v16h-5M9 15l6-6" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/>`
const w = 1200, h = 630
const spent = text('S$0.00', 64, 478, 56, P.green)
const body = [
  `<rect width="${w}" height="${h}" fill="${P.paper}"/>`,
  `<path d="M64 130H${w - 64}M64 ${h - 100}H${w - 64}" stroke="${RULE}"/>`,
  // The brand lockup: mark + ResearchAgent, as on every other card.
  `<g transform="translate(64 56) scale(1.333333)">${mark()}</g>`, text('ResearchAgent', 112, 82, 32, P.ink).body,
  text('Proof of refusal', 64, 206, 24, MUTED).body,
  text('Refused to spend.', 64, 300, 92, P.ink).body,
  text('Verified on XRPL.', 64, 396, 92, MUTED).body,
  spent.body, text('spent', 64 + spent.width + 14, 478, 56, MUTED).body,
  // Held coin: a ring with a bar through it, on the 24-unit grid (scale 11).
  `<g transform="translate(884 196) scale(11)"><circle cx="12" cy="12" r="8" fill="none" stroke="${P.ink}" stroke-width="1.5"/><path d="M7.5 12h9" stroke="${P.salmon}" stroke-width="2.5" stroke-linecap="square"/></g>`,
  text('XRPL Testnet · no real value', 64, h - 55, 18, MUTED).body, text('ResearchAgent', w - 228, h - 55, 18, MUTED).body,
].join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Refused to spend · verified on XRPL. S$0.00 spent.">${body}</svg>\n`
const svgPath = resolve(root, 'design/brand/og/refusal-proof.svg')
mkdirSync(dirname(svgPath), { recursive: true }); writeFileSync(svgPath, svg)
const png = resolve(root, 'public/og/refusal-proof.png')
mkdirSync(dirname(png), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await page.goto(pathToFileURL(svgPath).href)
  writeFileSync(png, await page.screenshot({ type: 'png', omitBackground: false }))
} finally { await browser.close() }
console.log(`Wrote ${svgPath.replace(root + '/', '')} and ${png.replace(root + '/', '')}`)
