// Local production UI, recorded no-show replay and synthetic layout data. No question, paid provider or ledger write.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { evidencePath } from './evidence-path'
import { initialJsGzip } from '../scripts/bundle-budget.mjs'
const trace = JSON.parse(readFileSync('demo/traces/UC-key-reveal.json', 'utf8'))
const bundle = JSON.parse(readFileSync('docs/evidence/round4-j1/replays/simulated/UC2.receipts.json', 'utf8'))
const provenance = 'ResearchAgent builders · XRPL explainers (team-authored) · team-authored explainer · sources cited · not an independent writer · Testnet'
const status = { questionCapMinor: 200, state: 'ready', csrfToken: 'layout-only', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'fixture models', rail: 'Shared XRPL Testnet demo · no real value' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' } }
const before = process.env.UI_A_BEFORE === '1'
const recordedBundlePath = before ? '/judge/hosted-run-nov11.receipts.json' : JSON.parse(readFileSync('shared/judge-run.json', 'utf8')).bundleUrl
for (const width of [1280, 390]) test(`UI-A fixes at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
  const run = structuredClone(trace.run)
  const paid = run.candidates.find((c: { resourceId: string; tier: string }) => c.tier === 'PAID' && run.contents.some((s: { resourceId: string }) => s.resourceId === c.resourceId))
  paid.publisher = provenance // layout-only provenance fixture; no receipt or signed data is changed
  const requests: string[] = []
  const metrics: { screen: string; seriousCritical: number; overflow: boolean }[] = []
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/demo/status') return route.fulfill({ json: status })
    if (path === '/api/health') return route.fulfill({ json: trace.health })
    if (path === '/api/reputation') return route.fulfill({ json: { publishers: [] } })
    if (path === '/api/runs') return route.fulfill({ json: [] })
    if (path === '/api/writers/earnings') return route.fulfill({ json: { scope: 'Your purchases and trust come from your retained history. Sales on this demo since 11 Nov include all visitors.', writers: [{ slug: 'team-builder-notes', publisherSlug: 'team-builder-notes', name: 'ResearchAgent builders · Build notes (team-authored)', authorship: 'Team-authored', articleCount: 24, articles: [], priceRange: [40, 40], sales: [], trust: [], demoSales: 24 }] } })
    if (path.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: '' })
    if (path.endsWith('/receipts.json') || path === recordedBundlePath) return route.fulfill({ json: bundle })
    if (path.startsWith('/runs/')) return route.fulfill({ json: run })
    if (path.startsWith('/api/')) return route.fulfill({ status: 404, json: {} })
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort()
    return route.continue()
  })
  page.on('request', request => { if (request.method() === 'POST' && /\/(runs|api\/scope)$/.test(new URL(request.url()).pathname)) requests.push(request.url()) })
  const capture = async (screen: string) => {
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    metrics.push({ screen, seriousCritical: violations.length, overflow })
    expect(violations, screen).toEqual([])
    expect(overflow, screen).toBe(false)
    await page.screenshot({ path: evidencePath(`ui-a/${before ? 'before' : 'after'}-${screen}-${width}.png`), fullPage: true })
  }
  await page.goto('/')
  await expect(page.locator('.ra-hwork')).toBeVisible()
  expect(await page.locator('.ra-hsteps, .ra-composer, .ra-hwork').count()).toBe(3)
  await capture('home')
  if (!before) {
    await page.getByRole('button', { name: 'Verify a recorded run, no question used' }).click()
    await expect(page.locator('.ra-hwork')).toHaveAttribute('open', '')
    await page.getByRole('button', { name: 'Run the checks' }).click()
    await expect(page.locator('.ra-hv-head')).toContainText('passed', { timeout: 15000 })
    await expect(page.locator('.ra-gates')).toHaveAttribute('open', '')
    await expect(page.locator('.ra-gates > ul > li strong')).toHaveText(['Not checked', 'Passed', 'Passed', 'Passed', 'Passed'])
    await expect(page.getByRole('link', { name: /View key-release transaction/ })).toBeVisible()
    await capture('verify')
    await page.locator('.ra-gates > ul > li').last().getByText('Technical details', { exact: true }).click()
    await expect(page.locator('.ra-gates > ul > li').last().locator('details')).toContainText('decision: fixture')
    await capture('verify-details')
  }
  await page.goto(`/?run=${run.runId}`)
  await expect(page.locator('.ra-q')).toBeVisible()
  await page.locator('.ra-activity-details > summary').click()
  if (!before) {
    await expect(page.locator('.ra-run-status')).toContainText('Paid for 1 article.')
    await expect(page.locator('.ra-run-status')).toContainText('1 attempt cancelled, funds returned')
  }
  await capture('activity')
  // A citation opens the delivered article, including the full layout-only provenance string.
  await page.locator('.ra-cite').first().click()
  await expect(page.locator('.ra-passage')).toBeVisible()
  if (!before) {
    await expect(page.locator('.ra-passage .ra-provenance > summary')).toHaveText('Team-authored · Testnet')
    await page.locator('.ra-passage .ra-provenance > summary').click()
    await expect(page.locator('.ra-passage .ra-provenance > p')).toHaveText(provenance)
    expect(await page.locator('.ra-passage .ra-provenance').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await capture('passage')
  await page.getByRole('button', { name: 'Close source passage' }).click()
  if (width === 390) await page.locator('.ra-mobile-spend > button').click()
  else await page.locator('.ra-side .ra-spending-proof > summary').click()
  await capture('payments')
  await page.goto('/')
  if (width === 390) await page.getByRole('button', { name: 'Show sidebar' }).click()
  await page.getByRole('button', { name: 'Writers', exact: true }).click()
  await expect(page.getByText('24 sales')).toBeVisible()
  if (!before) {
    await expect(page.getByText('Your purchases and demo-wide sales are shown separately.', { exact: false })).toBeVisible()
    await expect(page.getByText('Sales on this demo since 11 Nov', { exact: true })).toBeVisible()
    await expect(page.getByText('You haven’t bought from this writer yet')).toBeVisible()
    await expect(page.getByText('No sales yet', { exact: true })).toHaveCount(0)
  }
  await capture('writers')
  expect(requests).toEqual([])
  const bytes = initialJsGzip(before ? '/tmp/ui-a-before-dist' : 'dist').reduce((sum, chunk) => sum + chunk.gzip, 0)
  expect(bytes).toBeLessThan(160000)
  writeFileSync(evidencePath(`ui-a/${before ? 'before' : 'after'}-metrics-${width}.json`), JSON.stringify({ width, initialJsGzip: bytes, admissions: requests.length, metrics }, null, 2) + '\n')
})
