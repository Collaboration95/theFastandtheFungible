// HTML → image helpers: the title and close cards, and the caption overlays the assembler burns in.
// Fonts are the app's own Geist and Geist Mono, read from node_modules (no network).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { PAPER, ROOT, VIEWPORT } from '../config.mjs'

const face = (family, pkg, file) => `@font-face{font-family:'${family}';font-weight:100 900;font-style:normal;src:url(${pathToFileURL(join(ROOT, 'node_modules/@fontsource-variable', pkg, 'files', file))}) format('woff2')}`
export const fontFaceCss = () => [
  face('Geist', 'geist', 'geist-latin-wght-normal.woff2'), face('Geist', 'geist', 'geist-latin-ext-wght-normal.woff2'),
  face('Geist Mono', 'geist-mono', 'geist-mono-latin-wght-normal.woff2'), face('Geist Mono', 'geist-mono', 'geist-mono-latin-ext-wght-normal.woff2'),
].join('\n')

/** Render one HTML document to a PNG (transparent when `transparent`). The page is written next to the output. */
export async function renderHtml({ html, out, width = VIEWPORT.width, height = VIEWPORT.height, transparent = false, browser: shared }) {
  mkdirSync(dirname(out), { recursive: true })
  const page = out.replace(/\.png$/, '.html')
  writeFileSync(page, html)
  const browser = shared ?? await chromium.launch({ headless: true })
  const tab = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage()
  await tab.goto(pathToFileURL(page).href)
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: out, omitBackground: transparent })
  await tab.context().close()
  if (!shared) await browser.close()
}

const base = `${fontFaceCss()}
  :root{--ink:#1d1b19;--muted:#6b645c;--line:rgba(30,27,24,.14)}
  html,body{margin:0;width:1920px;height:1080px;background:${PAPER};color:var(--ink);font-family:'Geist',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .pill{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:999px;padding:9px 18px;font-size:22px;color:var(--muted);background:#fff}
  .dot{width:9px;height:9px;border-radius:50%;background:#2f7a3a}`

/** Shot 1: a subtle title card. No mascot (the character is for the README hero, site, deck and app states). */
export function titleCardHtml({ mark }) {
  return `<!doctype html><meta charset="utf-8"><style>${base}
    h1{font-size:112px;letter-spacing:-.035em;font-weight:650;margin:30px 0 14px}
    p.sub{font-size:38px;color:var(--muted);margin:0 0 54px;letter-spacing:-.01em}
    img{height:84px}</style>
    <div class="wrap"><img src="${pathToFileURL(mark)}" alt=""><h1>ResearchAgent</h1><p class="sub">Research with a wallet.</p>
    <span class="pill"><span class="dot"></span>XRPL Testnet · no real value</span></div>`
}

/** Shot 8: the README's own opening (lockup, tagline, the one-sentence description), then the repository address. */
export function closeCardHtml({ lockup, repo }) {
  return `<!doctype html><meta charset="utf-8"><style>${base}
    img{height:96px;margin-bottom:34px}
    h1{font-size:60px;letter-spacing:-.03em;font-weight:620;margin:0 0 20px}
    p.lede{font-size:30px;line-height:1.45;color:var(--muted);max-width:1060px;margin:0 0 52px}
    p.url{font:500 36px 'Geist Mono',monospace;color:var(--ink);margin:0 0 40px}</style>
    <div class="wrap"><img src="${pathToFileURL(lockup)}" alt="ResearchAgent"><h1>Research with a wallet.</h1>
    <p class="lede">It answers from free sources first, then pays writers for the articles it is still missing, over x402 on the XRP Ledger, inside a budget you set. A model recommends; only policy code can pay.</p>
    <p class="url">${repo}</p><span class="pill"><span class="dot"></span>XRPL Testnet only · no real value</span></div>`
}
