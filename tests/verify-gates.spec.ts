// Production UI with recorded simulated receipts. No live question, provider or ledger call.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { evidencePath } from './evidence-path'
import { initialJsGzip } from '../scripts/bundle-budget.mjs'

const trace = JSON.parse(readFileSync('demo/traces/UC2.json', 'utf8'))
const bundle = JSON.parse(readFileSync('docs/evidence/round4-j1/replays/simulated/UC2.receipts.json', 'utf8'))
const status = { questionCapMinor: 200, state: 'ready', csrfToken: 'layout-only', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'fixture models', rail: 'SIMULATED · no real value' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' } }

for (const width of [1280, 390]) test(`lazy summary inside Spend at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  const chunks: string[] = []
  page.on('request', request => { if (request.url().includes('/assets/')) chunks.push(request.url()) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (path === '/api/demo/status') return route.fulfill({ json: status })
    if (path === '/api/health') return route.fulfill({ json: trace.health })
    if (path === '/api/runs') return route.fulfill({ json: [] })
    if (path.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: '' })
    if (path.endsWith('/receipts.json')) return route.fulfill({ json: bundle })
    if (path.startsWith('/runs/')) return route.fulfill({ json: trace.run })
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.ra-hwork')).toBeVisible()
  expect(await page.locator('.ra-hsteps, .ra-composer, .ra-hwork').count()).toBe(3)
  await page.goto(`/?run=${trace.run.runId}`)
  await expect(page.locator('.ra-q')).toBeVisible()
  expect(await page.locator('.ra-spend:visible').count()).toBe(width === 390 ? 0 : 1)
  expect(await page.locator('.ra-side > .ra-hv')).toHaveCount(0)
  if (width === 390) await page.locator('.ra-mobile-spend > button').click()
  const spend = page.locator(width === 390 ? '.ra-mobile-spend-sheet .ra-spend' : '.ra-side .ra-spend')
  await expect(spend.locator('.ra-spending-proof')).not.toHaveAttribute('open', '')
  await spend.locator('.ra-spending-proof > summary').click()
  await spend.locator('.ra-run-proof > summary').click()
  expect(chunks.some(chunk => /\/gates-/.test(chunk))).toBe(false)
  await spend.getByRole('button', { name: 'Run the checks' }).click()
  await expect(spend.locator('.ra-hv-head')).toContainText(/passed/, { timeout: 15000 })
  const gates = spend.locator('.ra-gates')
  await expect(gates).toHaveAttribute('open', '')
  await expect(gates).toContainText('browser summary of the anchored audit log')
  await expect(gates).not.toContainText('Same checks as')
  await expect(gates.locator('li')).toHaveCount(5)
  await expect(gates.locator('li strong')).toHaveText(['Not checked', 'Passed', 'Passed', 'Passed', 'Passed'])
  await expect(gates.locator('li').last()).toContainText(bundle.label)
  await gates.locator('li').last().getByText('Technical details', { exact: true }).click()
  await expect(gates.locator('li').last().getByText(bundle.label, { exact: false })).toBeVisible()
  expect(chunks.some(chunk => /\/gates-/.test(chunk))).toBe(true)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
  expect(violations).toEqual([])
  await gates.scrollIntoViewIfNeeded()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))
  })
  if (width === 1280) await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: evidencePath(`p5-gates/run-${width}.png`), fullPage: true })
  writeFileSync(evidencePath(`p5-gates/metrics-${width}.json`), JSON.stringify({ width, homeBoxes: 3, runBoxes: width === 390 ? 1 : 2, seriousCritical: violations.length, overflow, initialJsGzip: initialJsGzip().reduce((sum, c) => sum + c.gzip, 0) }, null, 2) + '\n')
})
