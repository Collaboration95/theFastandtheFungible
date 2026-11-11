// Local production bundle and recorded/synthetic layout fixtures. No question, purchase or live ledger call.
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { evidencePath } from './evidence-path'
import { initialJsGzip } from '../scripts/bundle-budget.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const key = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8'))
const simulated = JSON.parse(readFileSync('demo/traces/UC2.json', 'utf8'))
const dir = evidencePath('declutter/measurements.json').replace(/\/measurements.json$/, '')
mkdirSync(dir, { recursive: true })
const results: unknown[] = []
const baseline = process.env.DECLUTTER_BASELINE === '1'
const status = { questionCapMinor: 200, state: 'ready', csrfToken: 'layout-only', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'deepseek · fixture purchase decisions', rail: 'Shared XRPL Testnet demo · no real value' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' } }
async function setup(page: Page, run = key.run, sim = false) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    const path = url.pathname
    if (path === '/api/demo/status') return route.fulfill({ json: { ...status, ...(sim ? { labels: { models: 'fixture models', rail: 'SIMULATED · no real value' } } : {}) } })
    if (path === '/api/health') return route.fulfill({ json: sim ? simulated.health : key.health })
    if (path === '/api/runs') return route.fulfill({ json: [] })
    if (/\/events$/.test(path)) return route.fulfill({ contentType: 'text/event-stream', body: '' })
    if (/^\/runs\//.test(path)) return route.fulfill({ json: run })
    return route.continue()
  })
}
async function audit(page: Page, scene: string, width: number, boxes: number) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false); expect(violations).toEqual([])
  await page.evaluate(() => window.scrollTo(0, 0))
  const modal = await page.locator('dialog[open]').count() > 0
  await page.screenshot({ path: `${dir}/${scene}-${width}.png`, fullPage: !modal })
  results.push({ scene, width, boxes, seriousCritical: violations.length, horizontalOverflow: overflow })
}
async function keyboardOpen(page: Page, selector: string) {
  const control = page.locator(selector)
  for (let i = 0; i < 100 && !await control.evaluate(node => node === document.activeElement); i++) await page.keyboard.press('Tab')
  await expect(control).toBeFocused(); await page.keyboard.press('Enter')
}
test('initial JavaScript retains the declutter 160,000-byte target', () => {
  test.skip(baseline, 'The original bundle predates DEPLOY-FIX.')
  expect(initialJsGzip().reduce((sum, chunk) => sum + chunk.gzip, 0)).toBeLessThanOrEqual(160_000)
})

test.describe('after', () => {
test.skip(baseline, 'Baseline measurements use the original layout.')
for (const width of [1280, 390]) {
  test(`home hierarchy and keyboard at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    await setup(page); await page.goto('/')
    await expect(page.locator('.ra-hpromise')).toHaveText('Paid on delivery. Proven on the ledger.')
    const composer = (await page.locator('.ra-composer').boundingBox())!
    const example = (await page.locator('.ra-preset').first().boundingBox())!
    expect(composer.y + composer.height).toBeLessThanOrEqual(700)
    expect(example.y).toBeLessThan(width === 390 ? 844 : 800)
    await expect(page.locator('.ra-hwork')).not.toHaveAttribute('open', '')
    const boxes = await page.locator('.ra-hsteps, .ra-composer, .ra-hwork').count()
    expect(boxes).toBe(3)
    results.push({ scene: 'home positions', width, composerBottom: composer.y + composer.height, firstExampleY: example.y })
    await audit(page, 'home', width, boxes)
    await keyboardOpen(page, '.ra-hwork > summary')
    await expect(page.getByRole('button', { name: 'Run the checks' })).toBeVisible()
    await keyboardOpen(page, '.ra-hbuild > summary')
    await expect(page.getByRole('button', { name: /^Copy:/ })).toHaveCount(3)
    await audit(page, 'home-expanded', width, boxes)
  })
  for (const scene of ['run', 'ledger-topic', 'simulated', 'refund', 'pending', 'decrypt-failure']) test(`${scene} at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    const run = structuredClone(scene === 'simulated' ? simulated.run : key.run)
    if (!['simulated', 'refund'].includes(scene)) {
      const intent = run.intents.find((i: { status: string }) => i.status === 'VERIFIED')!
      run.intents = [intent]; run.receipts = run.receipts.filter((r: { intentId: string }) => r.intentId === intent.intentId)
      run.events = run.events.filter((e: { data?: { intentId?: string } }) => !e.data?.intentId || e.data.intentId === intent.intentId)
      run.spentMinor = intent.amountMinor; run.refundedMinor = 0
      if (scene === 'ledger-topic') run.question = 'How much XRP reserve does an XRPL account need?'
      if (scene === 'pending') { intent.status = 'SUBMITTING'; intent.escrow.state = 'LOCKED'; delete intent.escrow.finishHash; delete intent.escrow.keyVerified; delete intent.escrow.decryptVerified; run.spentMinor = 0; run.reservedMinor = intent.amountMinor; run.phase = 'BUY'; run.answers = []; run.receipts = [] }
      if (scene === 'decrypt-failure') { intent.status = 'DELIVERY_FAILED'; intent.escrow.decryptVerified = false }
    }
    await setup(page, run, scene === 'simulated'); await page.goto(`/?run=${run.runId}`)
    await expect(page.locator('.ra-q')).toBeVisible()
    await expect(page.locator('.ra-side > .ra-hv, .ra-side > .ra-ledger-check')).toHaveCount(0)
    const sources = page.getByRole('region', { name: 'Sources', exact: true })
    await expect(sources).toBeVisible()
    expect(await page.locator('.ra-spend:visible').count()).toBe(width === 390 ? 0 : 1)
    await audit(page, scene, width, width === 390 ? 1 : 2)
    if (width === 390) await page.locator('.ra-mobile-spend > button').click()
    if (width === 390) await audit(page, `${scene}-spend-closed`, width, 1)
    const spend = page.locator(width === 390 ? '.ra-mobile-spend-sheet .ra-spend' : '.ra-side .ra-spend')
    if (['refund', 'pending', 'decrypt-failure'].includes(scene)) {
      await expect(spend.locator('details.ra-payment-proof[open]')).toHaveCount(1)
      if (scene === 'refund') await expect(spend.getByText('Refund signed by the writer.', { exact: false })).toBeVisible()
      if (scene === 'decrypt-failure') await expect(spend.getByText('The article couldn’t be unlocked. It won’t be used.')).toBeVisible()
    } else {
      await expect(spend.getByText('Found in the checked passage').first()).toBeHidden()
      if (width === 1280) expect((await spend.boundingBox())!.height).toBeLessThanOrEqual(650)
      await keyboardOpen(page, `${width === 390 ? '.ra-mobile-spend-sheet' : '.ra-side'} .ra-spending-proof > summary`)
      if (scene !== 'simulated') await expect(spend.getByRole('button', { name: 'Check the key yourself' })).toBeVisible()
      await spend.locator('.ra-verification > summary').first().click()
      await expect(spend.getByText('Found in the checked passage').first()).toBeVisible()
      await spend.locator('.ra-run-proof > summary').click()
      await expect(spend.getByRole('button', { name: 'Run the checks' })).toBeVisible()
      if (scene === 'ledger-topic') {
        await spend.locator('.ra-public-fact > summary').click()
        await expect(spend.getByText('Live ledger read · read-only · not part of the paid answer')).toBeVisible()
      }
      if (scene === 'simulated') { await expect(spend.getByRole('button', { name: 'Check the key yourself' })).toHaveCount(0); await expect(page.getByText('not anchored (simulated)', { exact: false })).toBeVisible() }
    }
    await audit(page, `${scene}-spend`, width, width === 390 ? 1 : 2)
    if (width === 390) { await page.keyboard.press('Escape'); await expect(page.locator('.ra-mobile-spend > button')).toBeFocused() }
  })
}
})
test.afterAll(() => { writeFileSync(`${dir}/${baseline ? 'before-measurements' : 'measurements'}.json`, JSON.stringify(results, null, 2) + '\n') })

test('baseline counts from pinned production source', async ({ page }) => {
  test.skip(!baseline, 'Only runs against the pinned before bundle.')
  for (const width of [1280, 390]) for (const scene of ['home', 'run', 'ledger-topic']) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    const run = structuredClone(key.run)
    const intent = run.intents.find((i: { status: string }) => i.status === 'VERIFIED')!
    run.intents = [intent]; run.receipts = run.receipts.filter((r: { intentId: string }) => r.intentId === intent.intentId)
    run.events = run.events.filter((e: { data?: { intentId?: string } }) => !e.data?.intentId || e.data.intentId === intent.intentId)
    run.spentMinor = intent.amountMinor; run.refundedMinor = 0
    if (scene === 'ledger-topic') run.question = 'How much XRP reserve does an XRPL account need?'
    await page.unrouteAll(); await setup(page, run)
    await page.goto(scene === 'home' ? '/' : `/?run=${run.runId}`)
    await expect(page.locator(scene === 'home' ? '.ra-qbox' : '.ra-q')).toBeVisible()
    const boxes = scene === 'home' ? await page.locator('.ra-hsteps, .ra-hjc-list > li, .ra-composer, .ra-hbuild').count() + (width === 1280 ? 2 : 0) : await page.locator('.ra-strip:visible, .ra-spend:visible, .ra-hv:visible, .ra-ledger-check:visible').count()
    expect(boxes).toBe(scene === 'home' ? width === 1280 ? 7 : 5 : scene === 'run' ? width === 1280 ? 3 : 2 : width === 1280 ? 4 : 3)
    await audit(page, `before-${scene}`, width, boxes)
  }
})
