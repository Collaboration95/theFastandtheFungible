// Export a pitch deck to one PNG per slide and one PDF (one slide per page, 16:9).
//   node scripts/pitch-export.mjs pitch                     → builds pitch/src first, then pitch/out/NN.png … and deck.pdf
//   --no-pdf / --no-png                                     → skip one output
//   --serve                                                 → force the http server even for a built deck
//
// Deck contract: the deck is <dir>/index.html; every slide is a <section class="slide">; `?print=1` lays all
// slides out one per 1920 × 1080 page with every animation or widget in its final state (the `print` media
// query must do the same, because the PDF is printed with media=print). PNGs are named by the slide number in
// the section id (s0 → 00.png), else by position (01.png …).
//
// A deck with <dir>/src/slides/ is built by scripts/pitch-build.mjs and must be self-contained: it is opened
// straight from file:// with no server, and any request other than the file itself or a data: URI is a
// problem, as is a font that fails to load. Other decks are served from the repo root on an ephemeral port
// (never 5100, 8788 or 8790); external requests are blocked and listed as warnings.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = root
const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const dirArg = args.find(a => !a.startsWith('--'))
const fail = message => { console.error(`pitch-export: ${message}`); process.exit(1) }
if (!dirArg) fail('usage: node scripts/pitch-export.mjs <deck dir, e.g. pitch> [--no-png] [--no-pdf] [--serve]')

const deckDir = resolve(dirArg)
const rel = relative(siteRoot, deckDir)
if (rel.startsWith('..') || resolve(rel) === rel) fail(`${dirArg} is not inside the repo`)
const built = existsSync(join(deckDir, 'src', 'slides'))
if (built) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'pitch-build.mjs'), deckDir], { stdio: 'inherit' })
  if (r.status !== 0) fail('build failed')
}
if (!existsSync(join(deckDir, 'index.html'))) fail(`${join(rel, 'index.html')} not found`)
const fileMode = built && !flags.has('--serve')
const outDir = join(deckDir, 'out')
const W = 1920, H = 1080

let server, base
if (fileMode) {
  base = pathToFileURL(join(deckDir, 'index.html')).href
} else {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.ico': 'image/x-icon' }
  server = createServer((req, res) => {
    const path = normalize(join(siteRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    if (!path.startsWith(siteRoot)) { res.statusCode = 403; return res.end() }
    let file = path
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html') } catch { res.statusCode = 404; return res.end() }
    try { const body = readFileSync(file); res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream'); res.end(body) } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(ok => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${server.address().port}/${rel.split(sep).join('/')}/index.html`
}

const browser = await chromium.launch()
const problems = [], warnings = []
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' })
  const bad = [], stray = []
  page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`) })
  page.on('requestfailed', r => { if (!r.url().startsWith('data:')) bad.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 120)}`) })
  page.on('request', r => { const u = r.url(); if (fileMode && !u.startsWith('data:') && u.split(/[?#]/)[0] !== base) stray.push(u.slice(0, 120)) })
  page.on('pageerror', e => problems.push(`page error: ${e.message}`))
  await page.route(url => fileMode ? /^https?:$/.test(url.protocol) : (/^https?:$/.test(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)),
    route => { warnings.push(`external request blocked: ${route.request().url()}`); return route.abort() })
  await page.goto(`${base}?print=1`, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { await document.fonts.ready })
  await page.waitForTimeout(400) // let any final-state render settle (widgets render synchronously in print mode)

  const fonts = await page.evaluate(() => [...document.fonts].map(f => ({ family: f.family.replace(/"/g, ''), status: f.status })))
  for (const f of fonts) if (f.status === 'error') problems.push(`font "${f.family}" failed to load`)
  if (fileMode && !fonts.some(f => f.family === 'Geist' && f.status === 'loaded')) problems.push('Geist did not load')
  if (stray.length) problems.push(`not self-contained, requested: ${[...new Set(stray)].join(', ')}`)

  const count = await page.$$eval('section.slide', s => s.length)
  if (!count) fail('no <section class="slide"> found; see the deck contract at the top of this file')
  const missing = await page.$$eval('img', imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => (i.getAttribute('src') ?? '').slice(0, 60)))
  if (missing.length) problems.push(`missing image(s): ${missing.join(', ')}`)
  if (bad.length) problems.push(`failed request(s): ${[...new Set(bad)].join(', ')}`)
  const text = await page.evaluate(() => document.body.innerText)
  if (text.includes('{{')) problems.push('"{{" placeholder in the rendered slides')
  const geometry = await page.$$eval('section.slide', slides => slides.map((s, i) => {
    const r = s.getBoundingClientRect(), m = s.id.match(/^s(\d+)$/)
    return { i: i + 1, n: m ? +m[1] : i + 1, w: Math.round(r.width), h: Math.round(r.height), sw: s.scrollWidth, sh: s.scrollHeight }
  }))
  for (const g of geometry) {
    if (g.w !== W || g.h !== H) problems.push(`slide ${g.n} is ${g.w}×${g.h} in ?print=1, expected ${W}×${H}`)
    else if (g.sw > W + 1 || g.sh > H + 1) problems.push(`slide ${g.n} content overflows its frame (${g.sw}×${g.sh})`)
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  if (!flags.has('--no-png')) {
    const slides = await page.$$('section.slide')
    for (const [i, el] of slides.entries()) await el.screenshot({ path: join(outDir, `${String(geometry[i].n).padStart(2, '0')}.png`) })
    console.log(`${slides.length} PNGs → ${join(rel, 'out')}/NN.png`)
  }
  if (!flags.has('--no-pdf')) {
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
    const pdf = await page.pdf({ width: `${W}px`, height: `${H}px`, printBackground: true, preferCSSPageSize: true })
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    writeFileSync(join(outDir, 'deck.pdf'), pdf)
    console.log(`PDF → ${join(rel, 'out', 'deck.pdf')} (${pages} pages, ${count} slides)`)
    if (pages !== count) problems.push(`PDF has ${pages} pages but the deck has ${count} slides (check break-after: page and slide height in @media print)`)
  }
  if (fileMode && !stray.length) console.log(`file:// load: no server, ${fonts.filter(f => f.status === 'loaded').map(f => f.family).join(' + ')} loaded, 0 external requests`)
} finally {
  await browser.close()
  server?.close()
}
for (const w of [...new Set(warnings)]) console.warn(`warning: ${w}`)
if (problems.length) { console.error(`pitch-export: problems:\n  ${problems.join('\n  ')}`); process.exitCode = 1 }
