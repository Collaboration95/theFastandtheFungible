// Before/after screenshots for lane FIX-A (sweep findings S5–S27) at 1440 and 390.
// Usage: node docs/evidence/fix-a-nov11/capture.mjs <base-url> <before|after>
// Offline only: point it at a fixture app (`DEMO_PORT_OFFSET=N npm run demo`). Recorded runs come from demo/traces
// through route stubs, exactly as tests/ui-nov11.spec.ts does, so no keys, no Testnet and no money are involved.
// The hosted shell is simulated by stubbing GET /api/demo/status; the local app answers that route itself.
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [base = 'http://127.0.0.1:8700', label = 'after'] = process.argv.slice(2)
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const out = join(here, label)
mkdirSync(out, { recursive: true })
const trace = name => JSON.parse(readFileSync(join(root, 'demo/traces', name), 'utf8'))
const keyReveal = trace('UC3-key-reveal.json')
const receipts = JSON.parse(readFileSync(join(root, 'docs/evidence/replay-nov11/key-reveal/UC3.receipts.json'), 'utf8'))
const status = (patch = {}) => ({ questionCapMinor: 200, state: 'ready', csrfToken: 'fix-a', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'fixture models', rail: 'SIMULATED · no real value' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' }, ...patch })
// A finished run that bought nothing (the RLUSD question), built from the uc2 fixture the way tests/ux2.spec.ts builds its decline.
const uc2 = JSON.parse(readFileSync(join(root, 'src/fixtures/uc/uc2.json'), 'utf8'))
const verdicts = [['SKIP_LOW_VALUE', 'Covers ground the free sources already cover.'], ['SKIP_REWRITE', 'A rewrite of evidence it already has.'], ['SKIP_LOW_TRUST', 'The writer failed an earlier proof check.']]
const declineRun = count => {
  const paid = uc2.decisions[0].rows.filter(row => row.candidate.tier === 'PAID')
  const rows = Array.from({ length: count }, (_, i) => { const row = paid[i % paid.length]; const [verdict, reason] = verdicts[i % verdicts.length]; return { ...row, wouldBuy: false, value: 0.16 + i / 100, verdict, reason, candidate: { ...row.candidate, resourceId: `${row.candidate.resourceId}-${i}` } } })
  const free = uc2.candidates.filter(candidate => candidate.tier === 'FREE').slice(0, 4)
  const id = `decline-${count}`
  return { health: keyReveal.health, scope: keyReveal.scope, run: { ...uc2, runId: id, question: 'Which Singapore banks are piloting RLUSD settlement in 2026?', phase: 'DONE', stopped: false, contents: [], grants: [], checkpoint: {}, spentMinor: 0, reservedMinor: 0, refundedMinor: 0, answers: [], intents: [], receipts: [], candidates: [...free, ...rows.map(row => row.candidate)], decisions: [{ ...uc2.decisions[0], threshold: 0.2, rows }],
    events: [{ id: 1, runId: id, type: 'FREE_DRAFT', label: 'Recorded fixture', at: '2026-11-07T00:00:03Z', data: { elapsedMs: 3000 } }, { id: 2, runId: id, type: 'DONE', label: 'Recorded fixture', at: '2026-11-07T00:00:05Z' }] } }
}
const decline = declineRun(12), fewRows = declineRun(4)
// A long decline sentence beside the run status (S18) at the desktop window width.
const log = { label, base, consoleErrors: {}, axe: {}, notes: [] }

const browser = await chromium.launch()
for (const mode of ['local', 'hosted']) for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const key = `${mode}-${width}`
  log.consoleErrors[key] = []
  page.on('console', message => { if (message.type() === 'error') log.consoleErrors[key].push(`${message.text()} ${message.location().url}`) })
  page.on('pageerror', error => log.consoleErrors[key].push(`pageerror ${error.message}`))
  let current = keyReveal
  if (mode === 'hosted') await page.route('**/api/demo/status', route => route.fulfill({ json: status() }))
  const stub = async () => {
    await page.route('**/api/health', route => route.fulfill({ json: keyReveal.health }))
    await page.route('**/runs/*/receipts.json', route => route.fulfill({ json: receipts }))
    await page.route('**/runs/*/events*', route => route.fulfill({ contentType: 'text/event-stream', body: '' }))
    await page.route('**/runs/*', route => route.fulfill({ json: current.run }))
    await page.route('**/api/scope', route => route.fulfill({ json: { ...keyReveal.scope, questions: [] } }))
    await page.route('**/api/ledger', route => route.fulfill({ status: 503, json: {} }))
    await page.route('**/api/runs/*/proof', route => route.fulfill({ json: { eligible: false, code: 'simulated', message: 'Simulated payments leave nothing on the ledger, so there is nothing to prove.' } }))
  }
  const shot = async (name, full = true) => {
    try {
      const audit = await new AxeBuilder({ page }).analyze()
      log.axe[`${mode}-${name}-${width}`] = { violations: audit.violations.map(item => item.id), noHorizontalScroll: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) }
    } catch (error) { log.axe[`${mode}-${name}-${width}`] = { error: String(error).split('\n')[0] } }
    try { await page.screenshot({ path: join(out, `${mode}-${name}-${width}.jpg`), fullPage: full, type: 'jpeg', quality: 78 }); console.log('ok  ', mode, name, width) }
    catch (error) { console.log('MISS', mode, name, width, String(error).split('\n')[0]) }
  }
  const step = async (name, run) => { try { await run() } catch (error) { console.log('FAIL', mode, name, width, String(error).split('\n')[0]); log.notes.push(`${key} ${name}: ${String(error).split('\n')[0]}`) } }
  const open = async url => { await page.goto(base + url); await page.waitForLoadState('networkidle') }
  const dismiss = async () => { const got = page.getByRole('button', { name: 'Got it' }); if (await got.isVisible().catch(() => false)) await got.click() }
  const run = async trace => { current = trace; await open(`/?run=${trace.run.runId}`); await page.locator('.ra-q').waitFor({ timeout: 8000 }) }

  // Home, empty (S15 console, S16 chip, S22 sprites, S27 footer, S14 hosted ready).
  await step('home', async () => { await open('/'); await page.locator('.ra-qbox').waitFor(); await shot('home', true) })
  if (mode === 'local') await step('home-dismissed', async () => { await dismiss(); await shot('home-dismissed', false) })
  if (width === 390) await step('sidebar', async () => { await page.getByRole('button', { name: 'Show sidebar' }).click(); await page.waitForTimeout(250); await shot('sidebar', false); await page.getByRole('button', { name: 'Hide sidebar' }).click().catch(() => {}) })

  // Hosted shell states that cannot take a question (S14).
  if (mode === 'hosted') for (const [name, patch] of [['paused', { state: 'paused', capabilities: { ask: false, scope: false, history: true, receipts: true, pdf: false, settings: false, faultControls: false } }], ['usedup', { state: 'degraded', remaining: { questions: 0, minor: 0 }, capabilities: { ask: false, scope: false, history: true, receipts: true, pdf: false, settings: false, faultControls: false } }], ['ended', { state: 'ended', capabilities: { ask: false, scope: false, history: true, receipts: true, pdf: false, settings: false, faultControls: false } }]]) {
    await step(`state-${name}`, async () => {
      await page.unroute('**/api/demo/status'); await page.route('**/api/demo/status', route => route.fulfill({ json: status(patch) }))
      await open('/'); await page.locator('.ra-hstate').waitFor({ timeout: 6000 }); await shot(`state-${name}`, true)
      await page.unroute('**/api/demo/status'); await page.route('**/api/demo/status', route => route.fulfill({ json: status() }))
    })
  }

  await stub()
  // Plan modal (S20).
  await step('plan', async () => {
    await open('/'); await dismiss()
    await page.locator('.ra-presets button').first().click(); await page.getByRole('button', { name: /^Ask/ }).click()
    await page.getByRole('button', { name: 'Start now' }).waitFor({ timeout: 8000 }); await shot('plan', false)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  })
  // The refund run: summary against strip (S5), citation numbers (S7), the bottom Show work (S21), mobile order (S19).
  await step('answer-refund', async () => { await run(keyReveal); await shot('answer-refund', true); await shot('answer-refund-top', false) })
  await step('showwork', async () => { await run(keyReveal); await page.getByRole('button', { name: 'Show work', exact: true }).first().click(); await page.waitForTimeout(250); await shot('showwork', false); await page.keyboard.press('Escape') })
  await step('receipt', async () => { await run(keyReveal); if (width === 390) await page.locator('.ra-mobile-spend > button').click(); await page.getByRole('button', { name: /Receipt/ }).first().click(); await page.waitForTimeout(300); await shot('receipt', false); await page.keyboard.press('Escape') })
  // The decline: 8 rows collapsed, 4 rows open (S8).
  await step('decline-12', async () => { await run(decline); await shot('decline-12', true) })
  await step('decline-4', async () => { await run(fewRows); await shot('decline-4', true) })
  // The desktop window width (S18).
  if (width === 1440) await step('decline-1280', async () => { await page.setViewportSize({ width: 1280, height: 800 }); await run(decline); await shot('decline-1280', false); await page.setViewportSize({ width, height: 900 }) })
  // Writers (S9). The real local server answers /api/writers/earnings.
  await step('writers', async () => {
    await page.unroute('**/runs/*'); await page.unroute('**/api/health')
    await open('/')
    if (width === 390) { await page.getByRole('button', { name: 'Show sidebar' }).click(); await page.locator('.ra-mobile-views').getByRole('button', { name: 'Writers' }).click() }
    else await page.keyboard.press('ControlOrMeta+2')
    await page.locator('.ra-writer-card').first().waitFor({ timeout: 8000 }); await shot('writers', width === 1440 ? false : true)
  })
  await context.close()
}
await browser.close()
writeFileSync(join(out, 'console.json'), JSON.stringify(log, null, 2))
console.log('axe violations:', Object.entries(log.axe).filter(([, v]) => v.violations?.length || v.error || v.noHorizontalScroll === false).map(([k, v]) => `${k}: ${v.violations?.join(',') ?? v.error ?? 'horizontal scroll'}`))
console.log('console errors:', Object.fromEntries(Object.entries(log.consoleErrors).map(([k, v]) => [k, v.length])))
