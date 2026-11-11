// Judges' corner (T2) and the builders' row (P2) on the hosted home, in hosted mode against the local stack:
// run with `npx playwright test --config tests/playwright/hosted.config.ts judges-corner`. No hosted question is asked.
// LIVE_LEDGER=1 also re-checks the recorded run against the public Testnet node (read-only); UPDATE_EVIDENCE=1 refreshes docs/evidence/judges-corner/.
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { evidencePath } from './evidence-path'

const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const statusAs = (page: Page, patch: (status: Record<string, unknown>) => Record<string, unknown>) => page.route('**/api/demo/status', async route => {
  const response = await route.fetch()
  await route.fulfill({ response, json: patch(await response.json()) })
})
const admissionsOpen = Date.now() < Date.parse('2026-11-19T16:00:00Z')
test.skip(!admissionsOpen, 'The hosted demo’s admission window has closed.')

const strip = (page: Page) => page.getByRole('region', { name: 'Check our work without asking a question' })

for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844]] as const) {
  test(`${name}: the strip sits under the composer and above the examples, the builders’ row below them, nothing overflows, axe is clean`, async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Research with a wallet.' })).toBeVisible()
    await expect(strip(page)).toBeVisible()
    await expect(page.getByText('It buys only to fill a gap')).toBeVisible()
    // The visitor's own question comes first; the strip sits under the composer and above the examples.
    const boxes = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!
    const composer = await boxes(page.getByRole('textbox', { name: 'Your question' })), corner = await boxes(strip(page)), examples = await boxes(page.getByRole('group', { name: 'Demo questions' }))
    expect(corner.y).toBeGreaterThan(composer.y + composer.height - 1)
    expect(corner.y + corner.height).toBeLessThanOrEqual(examples.y + 1)
    // Desktop: three items in one row. Phone: stacked.
    const items = strip(page).locator(':scope > ul > li')
    expect(await items.count()).toBe(2)
    const rects = await items.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width } }))
    if (width > 780) expect(Math.abs(rects[0].y - rects[1].y)).toBeLessThan(2); else expect(rects[1].y).toBeGreaterThan(rects[0].y)
    expect(await noOverflow(page)).toBe(true)
    expect(await serious(page)).toEqual([])
    await page.screenshot({ path: evidencePath(`judges-corner/home-${width}.png`), fullPage: true })

    // The builders' row is collapsed under the examples; open, it still fits.
    const row = page.locator('details.ra-hbuild')
    await expect(row).toBeVisible()
    expect(await row.evaluate(node => (node as HTMLDetailsElement).open)).toBe(false)
    await row.getByText('Use it from your own agent').click()
    await expect(row.getByRole('button', { name: /^Copy: / })).toHaveCount(3)
    await row.scrollIntoViewIfNeeded()
    expect(await noOverflow(page)).toBe(true)
    expect(await serious(page)).toEqual([])
    await row.screenshot({ path: evidencePath(`judges-corner/builders-${width}.png`) })
    await context.close()
  })
}

test('it works with the sandbox busy, paused or ended: the recorded run is served, byte for byte, and the strip stays', async ({ browser }) => {
  for (const state of ['busy', 'paused', 'ended'] as const) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await statusAs(page, status => ({ ...status, state, capabilities: { ...(status.capabilities as object), ask: false } }))
    await page.goto('/')
    await expect(strip(page)).toBeVisible()
    await expect(strip(page).getByRole('button', { name: 'Run the checks' })).toBeEnabled()
    const served = await page.request.get('/judge/hosted-run-nov11.receipts.json')
    expect(served.status()).toBe(200)
    expect(createHash('sha256').update(await served.body()).digest('hex')).toBe('1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee')
    expect(Buffer.compare(await served.body(), readFileSync('docs/evidence/hosted-export-nov11/receipts.json'))).toBe(0)
    expect(await serious(page)).toEqual([])
    expect(await noOverflow(page)).toBe(true)
    await context.close()
  }
})

test('using the strip costs no question: no run, scope or admission request is made', async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const calls: string[] = []
  page.on('request', request => { if (/\/api\//.test(request.url()) && !/\/api\/(demo\/status|health)/.test(request.url())) calls.push(`${request.method()} ${new URL(request.url()).pathname}`); if (request.method() !== 'GET' && /\/api\//.test(request.url())) calls.push(`${request.method()} ${new URL(request.url()).pathname}`) })
  await page.goto('/')
  await expect(page.getByText('5 of 5 questions left today · test funds only')).toBeVisible()
  calls.length = 0 // whatever the app loaded on arrival is not what the strip does
  // The verifier's public-node lookups and the explorer are outside the app; keep this test off the network.
  await page.route(/rippletest\.net/, route => route.abort())
  await strip(page).getByRole('button', { name: 'Run the checks' }).click()
  await expect(strip(page).locator('.ra-hv-head, [role=alert]').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('5 of 5 questions left today · test funds only')).toBeVisible()
  const link = strip(page).getByRole('link', { name: /Open the EscrowFinish/ })
  await expect(link).toHaveAttribute('href', /testnet\.xrpl\.org\/transactions\/4CCB4E56137D738847E853535B068329562AD490DA4D9F5551CEC2EB1AC70638$/)
  expect(calls).toEqual([])
  await context.close()
})

test('LIVE_LEDGER: the recorded run re-checks against the public Testnet node with nothing failed', async ({ browser }) => {
  test.skip(process.env.LIVE_LEDGER !== '1', 'reads the public Testnet node; opt in with LIVE_LEDGER=1')
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto('/')
  await strip(page).getByRole('button', { name: 'Run the checks' }).click()
  const head = strip(page).locator('.ra-hv-head')
  await expect(head).toBeVisible({ timeout: 60000 })
  const text = (await head.textContent()) ?? ''
  console.log(`JUDGES-CORNER LIVE: ${text}`)
  expect(text).toMatch(/^\d+ passed · \d+ not checked$|^All \d+ checks passed$/)
  expect(text).not.toMatch(/failed/)
  const node = strip(page).getByText(/Ran in this browser, reading/)
  await expect(node).toContainText('s.altnet.rippletest.net')
  console.log(`JUDGES-CORNER NODE: ${await node.textContent()}`)
  await expect(strip(page).getByText('Recorded on this sandbox, 11 Nov')).toBeVisible()
  await page.screenshot({ path: evidencePath('judges-corner/verified-1280.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await noOverflow(page)).toBe(true)
  expect(await serious(page)).toEqual([])
  await page.screenshot({ path: evidencePath('judges-corner/verified-390.png'), fullPage: true })
  await context.close()
})
