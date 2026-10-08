import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// Fixture mode (npm run demo): UC2 and UC3 from the story bible, driven through the browser (#159).
// Demo-question buttons are named by their short label, then the full question (src/components/Ask.tsx PRESET_LABEL).
const ask = async (page: Page, preset: RegExp) => {
  await page.getByRole('button', { name: preset }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
}
const finished = async (page: Page) => {
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
}

test('UC2: clarify chip → plan card → paid purchase with proof ✓ → STRENGTHENS, PDF', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?pace=real')
  await ask(page, /^Kestrel–TSMC outlook/)
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  // The plan card confirms the plan before any spending; it is not a purchase approval.
  await page.getByRole('button', { name: 'Go now' }).click()
  await finished(page)
  await expect(page.getByRole('button', { name: /NotFinancialTimes: .*bought S\$0\.90/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /Purchase: NotFinancialTimes/ }).getByText('verified')).toBeVisible()
  await expect(page.getByText('Strengthens the free answer').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /MarketPulse.*bought/ })).toHaveCount(0)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download report' }).click()
  const file = await (await download).path()
  expect((await readFile(file!)).subarray(0, 5).toString()).toBe('%PDF-')

  // The web server never serves corpus files, paid bodies included (D18: the v2 writer corpus).
  const corpus = await page.request.get('/data/corpus/v2/articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json')
  expect(corpus.status()).toBe(403)
})

test('UC3: AlphaLeak bought → proof fails → refunded → quarantined; The Fab Floor bought', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?pace=real')
  await ask(page, /^Malaysia packaging lead times/)
  await page.getByRole('button', { name: 'Go now' }).click()
  await finished(page)
  const leak = page.getByRole('region', { name: /Purchase: AlphaLeak/ })
  await expect(leak.getByRole('heading', { name: /Proof failed/ })).toBeVisible()
  await expect(leak.getByRole('list', { name: 'Challenge and refund' })).toBeVisible()
  await expect(leak.getByText('Refunded').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /The Fab Floor: .*bought S\$0\.(25|40)/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Writers' }).click()
  await expect(page.getByText(/quarantined/i).first()).toBeVisible()
  await expect(page.getByText(/0\.40/).first()).toBeVisible()
})

for (const width of [1280, 390]) {
  test(`writer blog pages never scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of ['/w/notfinancialtimes/', '/w/the-fab-floor/blog/fab-floor-kestrel-penang-lead-times']) {
      await page.goto(path)
      await expect(page.getByText(/SYNTHETIC/).first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}
