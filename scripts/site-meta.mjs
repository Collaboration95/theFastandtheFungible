// Page-specific metadata and geometric OG cards. --check is offline and read-only.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { HOSTED_APP_URL, LIVE_WINDOW, replayDate } from './site-config.mjs'
const root = join(import.meta.dirname, '..'), site = join(root, 'site'), check = process.argv.includes('--check')
const esc = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const base = 'https://collaboration95.github.io/theFastandtheFungible/'
const descriptions = {
  'try/index.html': 'Open ResearchAgent: ask a question, set a budget and check the delivery key.',
  'index.html': 'Search expertise. Buy missing evidence within your budget. Try the hosted sandbox, replay key reveal, or inspect the proof.',
  'demo/index.html': `Replay of a recorded key-reveal run on XRPL Testnet, ${replayDate()}. No real value; fixture models and fictional demo writers.`,
  'talk/index.html': 'Key-reveal escrow explained, plus the historical 9 October walkthrough. Refunds require writer cooperation; refunds do not restore budget.',
  'progress/index.html': 'Progress since SingHacks with dated measurements, source receipts and the misses we kept.',
  'ledger/index.html': 'Inspect recorded XRPL Testnet transactions and re-check their validation on public servers. No real value.',
  'proof/index.html': 'Inspect transaction receipts, independently verify answers, and follow measured evidence and its limits.',
  'developers/index.html': 'Connect an MCP client, run the Testnet app, or verify receipts with versioned release packages.',
  'builder-feedback/index.html': 'Read recorded unsigned RLUSD escrow refusals and check the issuers’ current AccountRoot permission, read-only.',
  'evolution/index.html': 'The September–October build archive. For the current finals story, follow Progress since SingHacks.',
  'project-map/index.html': 'Explore the architecture from source discovery through budget policy, payment and verified citations.',
  'slides/index.html': 'Archived October AI Tinkerers presentation: research, evidence, spending policy and payment.',
  'notes/index.html': 'Speaker notes for the archived October ResearchAgent talk.',
  'reports/airwallex-before-after/index.html': 'Archived banking concept: one account with explicit spending limits.',
  'reports/kit-11-evaluation/index.html': 'Archived evaluation of the Kit 11 banking proposal and its implementation boundaries.',
}
const pages = readdirSync(site, { recursive: true }).filter(f => f.endsWith('.html') && !f.startsWith('demo/')).concat('demo/index.html')
const manifestPath = join(site, 'brand/og/site-manifest.json'), manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath)) : {}
let browser, page
if (!check) { const { chromium } = await import('playwright'); browser = await chromium.launch(); page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' }) }
let stale = 0
try {
  for (const file of pages) {
    const path = file === 'demo/index.html' ? join(root, file) : join(site, file)
    // The Replay shell's title carries the default recording's date.
    const source = readFileSync(path, 'utf8'), html = file === 'demo/index.html' ? source.replace(/<title>Replay · [^·<]+ · ResearchAgent<\/title>/, `<title>Replay · ${replayDate()} · ResearchAgent</title>`) : source
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1], description = descriptions[file]
    if (!title || !description) throw new Error(`Missing title/description: ${file}`)
    const slug = file === 'index.html' ? 'index' : file.replace('/index.html', '').replaceAll('/', '-')
    const route = file === 'index.html' ? '' : file.replace('index.html', ''), prefix = '../'.repeat(file.split('/').length - 1)
    const image = `${base}brand/og/${slug}.png`
    const block = `<!-- site-meta:start -->\n<meta name="description" content="${esc(description)}">\n<link rel="icon" href="${prefix}brand/favicon.svg">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(description)}">\n<meta property="og:url" content="${base}${route}">\n<meta property="og:image" content="${image}">\n<meta property="og:image:alt" content="${esc(title)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(description)}">\n<meta name="twitter:image" content="${image}">\n<!-- site-meta:end -->\n`
    let next = html.replace(/<!-- (?:brand|site-meta):start -->[\s\S]*?<!-- (?:brand|site-meta):end -->\s*/g, '').replace(/\s*<meta\b(?=[^>]*(?:name=["'](?:description|twitter:[^"']+)["']|property=["']og:[^"']+["']))[^>]*>/gi, '').replace(/\s*<link\b(?=[^>]*rel=["'](?:icon|shortcut icon)["'])[^>]*>/gi, '').replace(/<\/head>/i, block + '</head>')
    if (file === 'index.html') next = next.replace(/<!-- live-cta:start -->[\s\S]*?<!-- live-cta:end -->/, `<!-- live-cta:start --><p><a class="live-cta" href="${HOSTED_APP_URL}">Try it live</a> · ${LIVE_WINDOW} 2026. If unavailable: <a href="demo/">Replay · ${replayDate()}</a>.</p><!-- live-cta:end -->`)
    const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FBF8F2"/><path d="M64 130H1136M64 530H1136" stroke="#C9BFB2"/><g fill="#24211E" font-family="Arial,sans-serif"><text x="64" y="88" font-size="28">ResearchAgent</text><text x="64" y="260" font-size="${title.length > 45 ? 29 : 38}">${esc(title)}</text><text x="64" y="340" font-size="24">${esc(route || 'Research with a wallet.')}</text><text x="64" y="580" font-size="20">XRPL Testnet · evidence and honest limits</text></g><path d="M1000 360H950V470H1000M1050 360H1100V470H1050M1000 445L1050 390" fill="none" stroke="#24211E" stroke-width="8"/></svg>\n`
    const svgPath = join(site, `brand/og/${slug}.svg`), pngPath = join(site, `brand/og/${slug}.png`)
    const sha = data => createHash('sha256').update(data).digest('hex')
    const cardStale = !existsSync(svgPath) || readFileSync(svgPath, 'utf8') !== card || !existsSync(pngPath) || manifest[slug] !== sha(readFileSync(pngPath))
    if (next !== source || cardStale) {
      if (check) { console.error(`site-meta: stale ${file}`); stale++; continue }
      writeFileSync(path, next)
      if (cardStale) { writeFileSync(svgPath, card); await page.goto(pathToFileURL(svgPath).href); await page.screenshot({ path: pngPath }); manifest[slug] = sha(readFileSync(pngPath)) }
    }
  }
  if (!check) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
} finally { await browser?.close() }
if (stale) process.exit(1)
console.log('site-meta: all pages have descriptions and distinct OG cards')
