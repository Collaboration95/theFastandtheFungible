// Recorded UC3 payment data and synthetic state cuts. No admission or ledger writes.
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { evidencePath } from './evidence-path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { initialJsGzip } from '../scripts/bundle-budget.mjs'
const trace = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8'))
const noShow = JSON.parse(readFileSync('demo/traces/UC-key-reveal.json', 'utf8'))
const baseline = process.env.UI_C_BASELINE === '1'
const dir = evidencePath(`ui-c/${baseline ? 'before' : 'after'}`)
mkdirSync(dir, { recursive: true })
const status = { questionCapMinor: 200, state: 'ready', csrfToken: 'layout-only', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'deepseek · fixture purchase decisions', rail: 'Shared XRPL Testnet demo · no real value' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' } }
async function setup(page: Page, run = trace.run) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
  await page.route('**/*', route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (path === '/api/demo/status') return route.fulfill({ json: status })
    if (path === '/api/health') return route.fulfill({ json: trace.health })
    if (path === '/api/runs') return route.fulfill({ json: [] })
    if (/\/events$/.test(path)) return route.fulfill({ contentType: 'text/event-stream', body: '' })
    if (/^\/runs\//.test(path)) return route.fulfill({ json: run })
    return route.continue()
  })
}
for (const width of [1280, 390]) {
  test(`Home and UC3 payment states at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const audits: unknown[] = []
    const capture = async (state: string) => {
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(overflow).toBe(false); expect(violations).toEqual([])
      audits.push({ state, seriousCritical: violations.length, overflow })
      await page.screenshot({ path: `${dir}/${state}-${width}.png`, fullPage: true })
    }
    await setup(page); await page.goto('/')
    await expect(page.locator('.ra-qbox')).toBeVisible()
    const text = await page.locator('body').innerText()
    const markers = text.split('\n').filter(line => /test funds|XRPL Testnet|rule-based buying|fictional demo writers/i.test(line)).length
    if (!baseline) {
      expect(markers).toBe(1)
      await expect(page.locator('.ra-env-trigger')).toHaveText('XRPL Testnet')
      await expect(page.locator('.ra-hv')).toHaveCount(0)
    }
    await capture('home')
    if (!baseline) {
      await page.getByRole('button', { name: 'Verify a recorded run' }).click()
      await expect(page.getByRole('button', { name: 'Run the checks' })).toHaveCount(1)
      await expect(page.locator('.ra-hv')).toHaveCount(1)
      await page.goto('/')
    }
    for (const state of ['settled', 'pending', 'no-show', 'quality-refund']) {
      const run = structuredClone(state === 'no-show' ? noShow.run : trace.run)
      const intent = run.intents.find((i: { status: string }) => state === 'no-show' ? (i as { escrow?: { state: string } }).escrow?.state === 'CANCELLED' : i.status === (state === 'quality-refund' ? 'REFUNDED' : 'VERIFIED'))
      run.intents = [intent]; run.receipts = run.receipts.filter((r: { intentId: string }) => r.intentId === intent.intentId)
      if (state === 'pending') {
        intent.status = 'SUBMITTING'
        intent.escrow.state = 'LOCKED'
        delete intent.escrow.finishHash; delete intent.escrow.keyVerified; delete intent.escrow.decryptVerified
        run.phase = 'BUY'; run.answers = []; run.receipts = []; run.grants = []
      }
      await page.unrouteAll(); await setup(page, run); await page.goto(`/?run=${run.runId}`)
      await expect(page.locator('.ra-q')).toBeVisible()
      if (!baseline) {
        const stepper = page.locator('.ra-brief .ra-payment-stepper')
        await expect(stepper).toHaveCount(1)
        if (state !== 'pending') await stepper.locator(':scope > summary').click()
        await expect(stepper.getByText('Locked', { exact: true })).toBeVisible()
        await expect(stepper.getByText('Key published', { exact: true })).toBeVisible()
        await expect(stepper.getByRole('list').getByText('Unlocked', { exact: true })).toBeVisible()
        await expect(stepper.getByRole('link', { name: 'EscrowCreate' })).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${intent.escrow.createHash}`)
        if (state === 'settled' || state === 'quality-refund') {
          await expect(stepper.getByRole('link', { name: 'EscrowFinish' })).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${intent.escrow.finishHash}`)
          await expect(stepper.getByRole('button', { name: 'Check the key yourself' })).toBeVisible()
        }
        if (state === 'no-show') {
          await expect(stepper).toContainText('Refunded: escrow cancelled after the deadline')
          await expect(stepper.getByRole('link', { name: 'EscrowCancel' })).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${intent.escrow.cancelHash}`)
        }
        if (state === 'quality-refund') await expect(stepper).toContainText('Quality refund: writer-signed')
        for (const target of await stepper.locator('a:visible, button:visible, summary:visible').all()) {
          const box = (await target.boundingBox())!
          expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44)
        }
      }
      await capture(state)
      if (!baseline) await page.locator('.ra-brief .ra-payment-stepper').screenshot({ path: `${dir}/stepper-${state}-${width}.png` })
    }
    writeFileSync(`${dir}/metrics-${width}.json`, JSON.stringify({ width, homeMarkers: markers, audits }, null, 2))
  })
}
test('initial JavaScript is below UI-C 162000-byte budget', () => {
  expect(initialJsGzip().reduce((sum, chunk) => sum + chunk.gzip, 0)).toBeLessThan(162000)
})
