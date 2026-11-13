// Export the SingHacks finals deck to PDF, plus one PNG per slide for a visual check.
//   node docs/submission/deck/export.mjs                  → docs/submission/ResearchAgent-SFF-deck.pdf
//                                                           and scratch/deck-png/slide-NN.png (ignored)
//   node docs/submission/deck/export.mjs --refresh-shots → imports the original public-view browser
//                                                           captures after REDEPLOYED; zero questions.
//                                                           Includes the existing recorded answer and payment view.
//   node docs/submission/deck/export.mjs --replay-shots   → offline fallback: the same shots from the
//                                                           /demo/ replay of the recorded Testnet run
//   node docs/submission/deck/export.mjs --no-png         → PDF only
// Offline: fonts come from node_modules (@fontsource-variable), images from the repo. Capture manifests bind hosted shots to their deployed release.
// --refresh-shots imports shared-browser views (including an existing recorded run), with a pinned capture manifest. --replay-shots instead uses the /demo/ replay
// build of the current app (src/), served by Vite on an ephemeral loopback port: a recorded XRPL Testnet run
// with fictional writers, light theme, 2x, with every non-loopback request blocked.
// Fails, without replacing the PDF, if: a fact marker is stale (run `node scripts/facts.mjs`), any
// "{{" appears in the HTML, the rendered slides or the PDF text, an image is missing, or a slide's
// content overflows its 1920 × 1080 frame.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, fill } from '../../../scripts/facts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const deck = join(here, 'index.html')
const pdfPath = join(root, 'docs/submission/ResearchAgent-SFF-deck.pdf')
const pngDir = join(root, 'scratch/deck-png')
const assets = join(here, 'assets')
const wantPng = !process.argv.includes('--no-png')
const refresh = process.argv.includes('--refresh-shots'), replay = process.argv.includes('--replay-shots')
const fail = message => { console.error(`deck: ${message}`); process.exit(1) }

// The replay trace and viewport behind the offline fallback (`--replay-shots`).
export const SHOTS = {
  trace: 'demo/traces/UC3-key-reveal.json',
  transactions: 'docs/evidence/replay-nov11/key-reveal/transactions.json',
  viewport: { width: 1120, height: 1000 },
  deviceScaleFactor: 2,
  main: { file: 'ux-answer.png', height: 690 },
  zoom: { file: 'ux-payment.png', region: 'Payment: The Fab Floor', pad: 18 },
  // The README hero: the same replay at the width GitHub shows it, sidebar hidden, the refunded article's promise list collapsed.
  readme: { file: join(root, 'docs/media/readme-answer.png'), viewport: { width: 1280, height: 1160 }, height: 920, refunded: /Payment: AlphaLeak/ },
}

/** Capture slide 10's shots from the current app replaying the recorded Testnet key-reveal run. */
async function refreshShots(browser) {
  process.chdir(root) // demo/vite.config.ts resolves its root ('demo') from here
  const { createServer } = await import('vite')
  const vite = await createServer({ configFile: join(root, 'demo', 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
  await vite.listen()
  const { port } = vite.httpServer.address()
  const context = await browser.newContext({ viewport: SHOTS.viewport, deviceScaleFactor: SHOTS.deviceScaleFactor, reducedMotion: 'reduce', colorScheme: 'light' })
  try {
    const page = await context.newPage()
    const blocked = []
    await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => { blocked.push(route.request().url()); return route.abort() })
    await page.routeWebSocket(/.*/, socket => { blocked.push(socket.url()); socket.close() })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
    await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 120000 })
    const paid = page.getByRole('region', { name: SHOTS.zoom.region })
    await paid.getByText(/Paid by key reveal/).waitFor({ timeout: 30000 })
    const hide = page.getByRole('button', { name: 'Hide sidebar' })
    if (await hide.isVisible()) await hide.click()
    // The kept article's promise list is collapsed so its escrow steps fit; the refunded one stays open (it says why).
    for (const summary of await paid.locator('details[open] > summary').all()) await summary.click()
    await page.mouse.move(0, 0)
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
    await page.waitForTimeout(600)
    if (errors.length) throw new Error(`replay errors: ${errors.join('; ')}`)

    const header = await page.locator('header.ra-top').first().boundingBox() ?? await page.locator('#root header').first().boundingBox()
    if (!header) throw new Error('app header not found: the replay layout changed; update SHOTS in export.mjs')
    const main = { x: 0, y: header.y, width: SHOTS.viewport.width, height: SHOTS.main.height }
    if (main.y + main.height > SHOTS.viewport.height) throw new Error('main shot is taller than the viewport')
    await page.screenshot({ path: join(assets, SHOTS.main.file), clip: main })

    await paid.scrollIntoViewIfNeeded()
    const box = await paid.boundingBox()
    if (!box) throw new Error(`region "${SHOTS.zoom.region}" not found`)
    // Start just below the row's top rule; the row's own padding is the top margin.
    const p = SHOTS.zoom.pad
    await page.screenshot({ path: join(assets, SHOTS.zoom.file), clip: { x: box.x - p, y: box.y + 2, width: box.width + 2 * p, height: box.height - 2 + p } })

    const rows = JSON.parse(readFileSync(join(root, SHOTS.transactions), 'utf8')).transactions
    const manifest = {
      note: 'Generated by node docs/submission/deck/export.mjs --replay-shots; do not edit.',
      source: `${execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()} (app components in src/, built with demo/vite.config.ts)`,
      captured: new Date().toISOString().slice(0, 10),
      label: 'Recorded XRPL Testnet run replayed in the current app · fixture models · fictional writers · no real value',
      trace: SHOTS.trace,
      transactions: rows.map(row => row.hash ?? row.txHash ?? row.id).filter(Boolean),
      viewport: SHOTS.viewport, deviceScaleFactor: SHOTS.deviceScaleFactor, colorScheme: 'light',
      shots: { [SHOTS.main.file]: main, [SHOTS.zoom.file]: { region: SHOTS.zoom.region, padding: p } },
      blockedRequests: blocked.length,
    }
    writeFileSync(join(assets, 'shots.json'), JSON.stringify(manifest, null, 2) + '\n')
    console.log(`shots → ${SHOTS.main.file}, ${SHOTS.zoom.file} (${blocked.length} outside requests blocked)`)
    await readmeShot(browser, `http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
  } finally {
    await context.close()
    await vite.close()
  }
}

/** The README hero from the same replay: 1280 × 920 CSS px from the app header down, at 2x, light theme, nothing edited. */
async function readmeShot(browser, url) {
  const context = await browser.newContext({ viewport: SHOTS.readme.viewport, deviceScaleFactor: SHOTS.deviceScaleFactor, reducedMotion: 'reduce', colorScheme: 'light' })
  try {
    const page = await context.newPage()
    await page.route(u => !['127.0.0.1', 'localhost'].includes(u.hostname), route => route.abort())
    await page.routeWebSocket(/.*/, socket => socket.close())
    await page.goto(url)
    await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 120000 })
    await page.getByRole('region', { name: SHOTS.zoom.region }).getByText(/Paid by key reveal/).waitFor({ timeout: 30000 })
    const hide = page.getByRole('button', { name: 'Hide sidebar' })
    if (await hide.isVisible()) await hide.click()
    for (const summary of await page.getByRole('region', { name: SHOTS.readme.refunded }).locator('details[open] > summary').all()) await summary.click()
    await page.mouse.move(0, 0)
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
    await page.waitForTimeout(600)
    const header = await page.locator('header.ra-top').first().boundingBox()
    if (!header) throw new Error('app header not found: the replay layout changed; update SHOTS.readme in export.mjs')
    if (header.y + SHOTS.readme.height > SHOTS.readme.viewport.height) throw new Error('README shot is taller than the viewport')
    await page.screenshot({ path: SHOTS.readme.file, clip: { x: 0, y: header.y, width: SHOTS.readme.viewport.width, height: SHOTS.readme.height } })
    console.log(`README hero → ${SHOTS.readme.file}`)
  } finally { await context.close() }
}

// 1. Source checks: facts current, no template placeholders.
const html = readFileSync(deck, 'utf8')
const { facts } = build()
if (fill(html, facts, 'docs/submission/deck/index.html') !== html) fail('a fact marker is stale; run `node scripts/facts.mjs` first')
if (html.includes('{{')) fail(`"{{" in deck/index.html at line ${html.slice(0, html.indexOf('{{')).split('\n').length}`)

const browser = await chromium.launch()
const problems = []
try {
  if (refresh) execFileSync(process.execPath, ['--import', 'tsx', join(here, 'hosted-shots.mjs')], { cwd: root, stdio: 'inherit' })
  else if (replay) await refreshShots(browser)
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(deck).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  // 2. Rendered checks: images, placeholders, overflow, fonts.
  const missing = await page.$$eval('img', imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')))
  if (missing.length) problems.push(`missing image(s): ${missing.join(', ')}${missing.some(s => s.startsWith('assets/ux-')) ? ' (run with --refresh-shots or --replay-shots)' : ''}`)
  const text = await page.evaluate(() => document.body.innerText)
  if (text.includes('{{')) problems.push('"{{" in the rendered slides')
  const overflow = await page.$$eval('.slide', slides => slides.flatMap((s, i) => {
    const box = s.getBoundingClientRect()
    const bad = [...s.querySelectorAll('*')].filter(el => {
      if (el.closest('.src') || el.closest('.notes')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.bottom > box.bottom - 70 || r.right > box.right - 100)
    })
    return bad.length ? [`slide ${i + 1}: ${bad.length} element(s) overflow, e.g. <${bad[0].tagName.toLowerCase()}> "${bad[0].textContent.trim().slice(0, 60)}"`] : []
  }))
  problems.push(...overflow)
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))
  if (!fonts.some(f => f.includes('Geist'))) console.warn('warning: Geist did not load; run npm ci first')
  const count = await page.$$eval('.slide', s => s.length)

  if (wantPng) {
    mkdirSync(pngDir, { recursive: true })
    const slides = await page.$$('.slide')
    for (const [i, el] of slides.entries()) await el.screenshot({ path: join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`) })
    console.log(`${slides.length} PNGs → ${pngDir}`)
  }

  // 3. PDF, written beside the real one and moved into place only if its text is clean.
  const tmp = `${pdfPath}.tmp`
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: tmp, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true })
  let pdfText = ''
  try { pdfText = execFileSync('pdftotext', ['-layout', tmp, '-'], { encoding: 'utf8' }) } catch { console.warn('warning: pdftotext not found (brew install poppler); checked the rendered text only') }
  if (pdfText.includes('{{')) problems.push('"{{" in the PDF text')
  if (pdfText && (pdfText.match(/\f/g) ?? []).length !== count) problems.push(`PDF has ${(pdfText.match(/\f/g) ?? []).length} pages, deck has ${count} slides`)
  if (problems.length) {
    rmSync(tmp, { force: true })
    console.error(`deck: not exported:\n  ${problems.join('\n  ')}`)
    process.exitCode = 1
  } else {
    renameSync(tmp, pdfPath)
    console.log(`PDF → ${pdfPath} (${count} slides)`)
    // The browser copy at /deck/ follows every successful export.
    execFileSync(process.execPath, [join(here, 'web.mjs')], { cwd: root, stdio: 'inherit' })
  }
} finally {
  await browser.close()
}
