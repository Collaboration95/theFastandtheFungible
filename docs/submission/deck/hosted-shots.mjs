// Capture the README hero and slide 10's two product shots from ONE live run on the hosted judge demo,
// and save that run's own receipts.json (the file a judge gets from Export).
//   node docs/submission/deck/hosted-shots.mjs [--question XRPL2] [--url https://…run.app] [--dry]
// Uses one of the visitor's 5 daily questions on the shared XRPL Testnet demo (test funds, no real value,
// inside the demo's own caps). It never changes the deployment. --dry opens the home page only.
// Writes:
//   docs/media/readme-answer.png                     README hero, 1440 CSS px wide at 2x, light theme
//   docs/submission/deck/assets/ux-answer.png        slide 10 main shot (1120 CSS px wide at 2x)
//   docs/submission/deck/assets/ux-payment.png       slide 10 zoom: the kept article's key-reveal steps
//   docs/submission/deck/assets/shots.json           capture manifest (source, labels, transactions)
//   docs/evidence/hosted-export-nov11/receipts.json  the run's exported receipts (release acceptance verifies it)
// Nothing in an image is edited. The manifest records the app's own environment chip and model labels.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TESTNET_QUESTIONS } from '../../../shared/contracts/examples.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback }
const base = arg('--url', 'https://ra-front-651013803640.asia-southeast1.run.app').replace(/\/$/, '')
const preset = TESTNET_QUESTIONS.find(q => q.id === arg('--question', 'XRPL2'))
if (!preset) throw Error('--question must be XRPL1, XRPL2 or XRPL3')
const evidence = join(root, 'docs/evidence/hosted-export-nov11')
const assets = join(here, 'assets')
export const HOSTED_SHOTS = {
  readme: { file: join(root, 'docs/media/readme-answer.png'), viewport: { width: 1440, height: 1200 }, height: 960 },
  deck: { viewport: { width: 1120, height: 1000 }, main: { file: 'ux-answer.png', height: 690 }, zoom: { file: 'ux-payment.png', pad: 18 } },
  deviceScaleFactor: 2,
}

const browser = await chromium.launch()
let page
try {
  // --reopen re-captures the last run from its saved visitor session (no new question). The session file holds only
  // the demo's anonymous visitor cookie and lives outside the repo.
  const session = arg('--session', join(root, 'scratch/hosted-shots-session.json'))
  const reopen = process.argv.includes('--reopen')
  const saved = reopen ? JSON.parse(readFileSync(session, 'utf8')) : undefined
  const context = await browser.newContext({ viewport: HOSTED_SHOTS.readme.viewport, deviceScaleFactor: HOSTED_SHOTS.deviceScaleFactor, reducedMotion: 'reduce', colorScheme: 'light', acceptDownloads: true, ...(saved ? { storageState: saved.state } : {}) })
  page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  if (process.argv.includes('--trace')) page.on('response', r => { if (/\/(api|runs)\//.test(new URL(r.url()).pathname + '/')) r.text().catch(() => '').then(t => console.log(`  ${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}${r.status() >= 400 ? ' ' + t.slice(0, 200) : ''}`)) })
  await page.goto(saved?.url ?? `${base}/`, { waitUntil: 'domcontentloaded' })
  if (!saved) await page.getByRole('heading', { level: 1, name: 'Research with a wallet.' }).waitFor({ timeout: 60_000 })
  else await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 60_000 })
  const chip = (await page.getByRole('button', { name: /Testnet demo|Shared demo|Shared XRPL/ }).first().innerText().catch(() => '')).trim()
  console.log(`hosted: ${base} · chip "${chip}"`)
  if (process.argv.includes('--dry')) process.exit(0)

  if (!saved) {
  // Ask the way a visitor does: type the preset question, keep the default budget, confirm the plan.
  const box = page.getByRole('textbox', { name: 'Your question' })
  await box.fill(preset.text)
  const refused = page.waitForResponse(r => /\/api\/scope$/.test(new URL(r.url()).pathname), { timeout: 150_000 }).then(async r => r.status() >= 400 ? `${r.status()} ${await r.text().catch(() => '')}` : '')
  await page.getByRole('button', { name: /^Ask/ }).click()
  const why = await refused
  if (why) throw Error(`the demo refused the question: ${why.slice(0, 200)}`)
  const start = page.getByRole('button', { name: 'Start now' })
  const clarify = page.getByRole('region', { name: 'Clarifying questions' })
  await page.waitForFunction(() => document.querySelector('[aria-label="Clarifying questions"]') || [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Start now'), null, { timeout: 150_000 })
  if (await clarify.isVisible()) { await clarify.locator('.ra-chip-opt').first().click(); await start.waitFor({ timeout: 120_000 }) }
  const started = Date.now()
  if (await start.isVisible()) await start.click()
  await page.waitForFunction(() => /Answer ready|Stopped|Couldn.t finish/.test(document.title), null, { timeout: 300_000 })
  if (!/Answer ready/.test(await page.title())) throw Error(`run did not finish: ${await page.title()}`)
  console.log(`answer ready in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  mkdirSync(dirname(session), { recursive: true })
  writeFileSync(session, JSON.stringify({ url: page.url(), state: await context.storageState() }), { mode: 0o600 })
  }
  await page.getByText(/^Anchored on XRPL/).first().waitFor({ timeout: 120_000 })
  const notices = await page.getByText(/planner was unavailable|offline rules/i).count()
  if (notices) console.warn('warning: the run shows an offline-plan notice; consider --question XRPL3')

  // Export → Download receipts.json, exactly as a judge does.
  await page.locator('details.ra-export > summary').first().click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download receipts.json' }).click()])
  mkdirSync(evidence, { recursive: true })
  const receiptsFile = join(evidence, 'receipts.json')
  await download.saveAs(receiptsFile)
  await page.locator('details.ra-export > summary').first().click()
  const bundle = JSON.parse(readFileSync(receiptsFile, 'utf8')), b = bundle.verification ?? bundle
  const purchases = b.payments.filter(p => p.kind === 'purchase')
  if (!purchases.length || !b.ledgerAnchor) throw Error('the run bought nothing or has no anchor; pick another preset')

  // Frame: sidebar hidden, kept article's promise list collapsed so its escrow steps fit, pointer away.
  const tidy = async () => {
    const hide = page.getByRole('button', { name: 'Hide sidebar' })
    if (await hide.isVisible().catch(() => false)) await hide.click()
    for (const summary of await page.locator('[aria-label^="Payment:"] details[open] > summary').all()) if (await summary.isVisible()) await summary.click()
    await page.mouse.move(0, 0)
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
    await page.waitForTimeout(700)
  }
  const header = async () => (await page.locator('header.ra-top').first().boundingBox()) ?? (await page.locator('#root header').first().boundingBox())
  await tidy()
  const top = await header()
  if (!top) throw Error('app header not found')
  await page.screenshot({ path: HOSTED_SHOTS.readme.file, clip: { x: 0, y: top.y, width: HOSTED_SHOTS.readme.viewport.width, height: HOSTED_SHOTS.readme.height } })

  await page.setViewportSize(HOSTED_SHOTS.deck.viewport)
  await tidy()
  const deckTop = await header()
  const main = { x: 0, y: deckTop.y, width: HOSTED_SHOTS.deck.viewport.width, height: HOSTED_SHOTS.deck.main.height }
  await page.screenshot({ path: join(assets, HOSTED_SHOTS.deck.main.file), clip: main })
  const kept = page.locator('[aria-label^="Payment:"]').filter({ hasText: /Paid by key reveal|Article unlocked/ }).first()
  await kept.scrollIntoViewIfNeeded()
  const region = await kept.getAttribute('aria-label')
  const row = await kept.boundingBox()
  if (!row) throw Error('no kept payment row')
  const p = HOSTED_SHOTS.deck.zoom.pad
  await page.screenshot({ path: join(assets, HOSTED_SHOTS.deck.zoom.file), clip: { x: row.x - p, y: row.y + 2, width: row.width + 2 * p, height: row.height - 2 + p } })
  if (errors.length) console.warn(`page errors: ${errors.join('; ')}`)

  const lead = (await page.getByRole('region', { name: 'Research answer' }).locator('p').first().innerText().catch(() => '')).trim()
  const transactions = [...purchases.flatMap(x => [x.escrowCreateHash, x.txHash, x.refundTxHash]).filter(Boolean), b.ledgerAnchor.txHash]
  const manifest = {
    note: 'Generated by node docs/submission/deck/hosted-shots.mjs; do not edit.',
    source: `hosted judge demo ${base} (live run, no edits)`,
    captured: new Date().toISOString().slice(0, 10),
    label: `Hosted demo · XRPL Testnet · no real value · ${chip}`,
    labels: b.label, models: b.labels ?? undefined,
    question: preset.text, lead,
    receipts: 'docs/evidence/hosted-export-nov11/receipts.json',
    transactions, anchorLedger: b.ledgerAnchor.ledgerIndex,
    viewport: HOSTED_SHOTS.deck.viewport, readmeViewport: HOSTED_SHOTS.readme.viewport, deviceScaleFactor: HOSTED_SHOTS.deviceScaleFactor, colorScheme: 'light',
    shots: { [HOSTED_SHOTS.deck.main.file]: main, [HOSTED_SHOTS.deck.zoom.file]: { region, padding: p }, 'docs/media/readme-answer.png': { y: top.y, width: HOSTED_SHOTS.readme.viewport.width, height: HOSTED_SHOTS.readme.height } },
  }
  writeFileSync(join(assets, 'shots.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ question: preset.text, lead, purchases: purchases.length, spentMinor: b.payments.reduce((s, x) => s + Number(x.kind === 'purchase' ? x.amountMinor : 0), 0), transactions, anchor: b.ledgerAnchor.ledgerIndex }, null, 2))
  await context.close()
} catch (error) {
  // Leave a picture of the failure outside the repo, then fail.
  await page?.screenshot({ path: join(root, 'scratch/hosted-shots-failure.png'), fullPage: true }).catch(() => undefined)
  throw error
} finally { await browser.close() }
