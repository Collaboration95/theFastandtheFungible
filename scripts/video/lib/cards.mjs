// HTML → image helpers: the title and close cards, and the caption overlays the assembler burns in.
// Fonts are the app's own Geist and Geist Mono, read from node_modules (no network).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    <div class="wrap"><img src="${pathToFileURL(mark)}" alt=""><h1>ResearchAgent</h1><p class="sub">Paid on delivery. Proven on the ledger.</p>
    <span class="pill"><span class="dot"></span>Research with a wallet</span></div>`
}

/** Shot 8: the README's own opening (lockup, tagline, the one-sentence description), then the repository address. */
export function closeCardHtml({ lockup }) {
  const card = JSON.parse(readFileSync(join(ROOT, 'docs/submission/video/shots.json'), 'utf8')).endCard
  const qr = pathToFileURL(join(ROOT, card.qr))
  return `<!doctype html><meta charset="utf-8"><style>${base}
    h1{font-size:72px;margin:20px} .logo{height:70px}.qr{height:220px;margin:18px}
    .url{font-size:28px}.limits{font-size:23px;line-height:1.5;max-width:1450px;color:var(--muted)}
    </style><div class="wrap"><img class="logo" src="${pathToFileURL(lockup)}" alt="ResearchAgent">
    <h1>Check the key. It matches.</h1><img class="qr" src="${qr}" alt="Open hosted demo">
    <p class="url">${card.url}</p><p class="limits"><b>Status and limits.</b> ${card.limits}</p></div>`
}

/** Historical RPC output, rendered from the unchanged committed probe. Never a submitted transaction. */
export function dryRunCardHtml(evidence) {
  if (!evidence.unsigned || evidence.submitted) throw new Error('expected unsigned, unsubmitted probe')
  const rows = evidence.results.map(r => `<tr><td>${r.network}</td><td>RLUSD</td><td>${r.rlusd.engine_result}</td><td>${r.rlusd.ledger_index}</td></tr>`).join('')
  const control = evidence.results.find(r => r.network === 'Testnet')?.control
  if (!control?.engine_result || !control.ledger_index) throw new Error('Missing recorded Testnet control verdict')
  return `<!doctype html><meta charset="utf-8"><style>${base}
    .wrap{align-items:flex-start;text-align:left;padding:80px;box-sizing:border-box}
    h1{font-size:52px;margin:20px 0}p,td,th{font-size:27px;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{padding:18px;border-bottom:1px solid #ccc;text-align:left}code{font-family:'Geist Mono'}small{font-size:22px;color:var(--muted)}</style>
    <div class="wrap"><span class="pill">Recorded unsigned simulate results · Testnet + Mainnet reads · nothing signed/submitted</span>
    <h1>Ask rippled before signing.</h1><table><tr><th>Network</th><th>Token</th><th>Verdict</th><th>Ledger index</th></tr>${rows}
    <tr><td>Testnet</td><td>TEST-SGD control</td><td>${control.engine_result}</td><td>${control.ledger_index}</td></tr></table>
    <p>Measured signing fees: buyer 12 drops · writer 423 drops<br>Unsigned autofill: 10 / 350 drops · simulation charges nothing<br>No-show principal returns only after an EscrowCancel validates.</p>
    <small>Observed ${evidence.observedAt} · docs/evidence/dry-run-nov12/result.json<br>TEST-SGD is a no-value stand-in · sandbox pays Testnet XRP · mainnet spending disabled</small></div>`
}
