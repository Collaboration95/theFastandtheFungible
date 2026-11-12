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

const strip = (page: Page) => page.getByRole('region', { name: 'Check the recorded evidence' })

for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844]] as const) {
  test(`${name}: the shared disclosure follows examples and contains the builders’ row, nothing overflows, axe is clean`, async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Research with a wallet.' })).toBeVisible()
    await expect(page.locator('.ra-hwork')).toBeVisible()
    await expect(page.getByText('It buys only to fill a gap')).toBeVisible()
    const composer = (await page.getByRole('textbox', { name: 'Your question' }).boundingBox())!
    const examples = (await page.getByRole('group', { name: 'Demo questions' }).boundingBox())!
    const disclosure = page.locator('.ra-hwork')
    expect((await disclosure.boundingBox())!.y).toBeGreaterThan(examples.y + examples.height - 1)
    expect(examples.y).toBeGreaterThan(composer.y)
    await expect(disclosure).not.toHaveAttribute('open', '')
    await disclosure.locator(':scope > summary').focus()
    await page.keyboard.press('Enter')
    await expect(strip(page)).toBeVisible()
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
    await page.locator('.ra-hwork > summary').click()
    await expect(strip(page)).toBeVisible()
    await expect(strip(page).getByRole('button', { name: 'Run the checks' })).toBeEnabled()
    const served = await page.request.get('/judge/hosted-run-nov12.receipts.json')
    expect(served.status()).toBe(200)
    expect(createHash('sha256').update(await served.body()).digest('hex')).toBe('8cedc67bdbdc51e2e13ad1bb68ed6a5b78e76d75afa7b47e37e7a97cec71f2ae')
    expect(Buffer.compare(await served.body(), readFileSync('docs/evidence/hosted-export-nov12/receipts.json'))).toBe(0)
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
  const arrivalHistory = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/runs')
  await page.goto('/')
  await arrivalHistory // finish the existing Home load before measuring strip actions
  await expect(page.getByText('5 of 5 questions left today')).toBeVisible()
  calls.length = 0 // whatever the app loaded on arrival is not what the strip does
  // The verifier's public-node lookups and the explorer are outside the app; keep this test off the network.
  await page.route(/rippletest\.net/, route => route.abort())
  await page.locator('.ra-hwork > summary').click()
  await strip(page).getByRole('button', { name: 'Run the checks' }).click()
  await expect(strip(page).locator('.ra-hv-head, [role=alert]').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('5 of 5 questions left today')).toBeVisible()
  const link = strip(page).getByRole('link', { name: /View key-release transaction/ })
  await expect(link).toHaveAttribute('href', /testnet\.xrpl\.org\/transactions\/01A6A7E07652216B102DFD1FED13462539D43475DFFBBA5A3C6E0FB12F643F1D$/)
  expect(calls).toEqual([])
  await context.close()
})

test('LIVE_LEDGER: the recorded run re-checks against the public Testnet node with nothing failed', async ({ browser }) => {
  test.skip(process.env.LIVE_LEDGER !== '1', 'reads the public Testnet node; opt in with LIVE_LEDGER=1')
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto('/')
  await page.locator('.ra-hwork > summary').click()
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
  await expect(strip(page).getByText('Recorded on this demo, 12 Nov 2026')).toBeVisible()
  await page.screenshot({ path: evidencePath('judges-corner/verified-1280.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await noOverflow(page)).toBe(true)
  expect(await serious(page)).toEqual([])
  await page.screenshot({ path: evidencePath('judges-corner/verified-390.png'), fullPage: true })
  await context.close()
})
