import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'

const dir = process.env.UX_CAPTURE === '1' ? 'docs/design/after' : '.playwright/evidence/ux1'
test('UX-1: honest labels, UC1/2/3 money, receipts, reflow and recovery', async ({ page }) => {
  test.setTimeout(180_000)
  await page.request.post('/api/reputation/reset')
  await mkdir(dir, { recursive: true })
  const shot = async (name: string) => { await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 65, animations: 'disabled' }) }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?pace=real')
  const env = page.getByRole('button', { name: /Simulated demo · fixture models · no real value/ })
  await expect(env).toBeVisible()
  const pop = page.getByRole('region', { name: "What’s real here" })
  await expect(pop).toBeVisible()
  for (const label of ['fictional writers and labelled team-authored notes', 'Simulated payment · no ledger entry', 'Keyword search only', 'Offline rules']) await expect(pop).toContainText(label)
  await page.keyboard.press('Escape')
  await shot('01-home')
  const presets = [/^Bank of Japan decision/, /^Kestrel–TSMC outlook/, /^Malaysia packaging lead times/]
  for (let i = 0; i < presets.length; i++) {
    if (i) await page.keyboard.press('Control+n')
    await page.getByRole('button', { name: presets[i] }).click()
    await page.getByRole('button', { name: /^Ask/ }).click()
    if (i === 1) { await expect(page.getByRole('button', { name: 'pricing & margins' })).toBeVisible(); await shot('02-clarify'); await page.getByRole('button', { name: 'pricing & margins' }).click() }
    await expect(page.getByRole('button', { name: 'Start now' })).toBeFocused()
    if (i === 1) { const box = await page.getByRole('dialog', { name: 'Search plan' }).boundingBox(); expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(2); await shot('03-plan-confirm') }
    await page.getByRole('button', { name: 'Start now' }).click()
    if (i === 1) { await expect(page.locator('.ra-q')).toBeVisible(); await shot('04-running-search') }
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
    await shot(i === 0 ? '22-uc1-done-no-purchase' : i === 1 ? '07-done-uc2' : '12-uc3-done')
    const spend = page.getByRole('region', { name: 'Spend', exact: true }).first()
    await expect(spend.locator('.ra-net')).toHaveText(['S$0.00','S$0.90','S$0.40'][i])
    if (i === 0) await expect(spend).toContainText('Answered from free sources')
    if (i === 1) { await spend.getByRole('button', { name: 'Receipt' }).click(); await shot('13-receipt-paid'); await page.keyboard.press('Escape') }
  }
  await expect(page.getByText(/AlphaLeak’s article didn’t contain/)).toBeVisible()
  await expect(page.locator('.ra-side .ra-spend')).toContainText('Paid S$0.70 · Refunded S$0.30')
  const leak = page.locator('.ra-side').getByRole('region', { name: 'Payment: AlphaLeak' })
  await expect(leak).toContainText('Refunded S$0.30 · simulated')
  await expect(leak).toContainText('Not found')
  await expect(leak.locator('a[href*="transactions"]')).toHaveCount(0)
  const count = async () => page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n: Node | null, count = 0
    while ((n = walker.nextNode())) { const el = n.parentElement; if (!el || !el.checkVisibility()) continue; count += (n.textContent?.match(/simulated|fixture|synthetic|testnet/gi) ?? []).length }
    return count
  })
  const labels = { indicators: await page.locator('.ra-env-trigger:visible').count(), rawText: await count(), receipt: 0 }
  expect(labels.indicators).toBe(1)
  // Includes the mandatory refund rail and explicit unanchored simulated label (#366).
  expect(labels.rawText).toBe(3)
  await leak.getByRole('button', { name: 'Receipt' }).click()
  const receipt = page.getByRole('dialog', { name: 'Receipt', exact: true })
  await expect(receipt).toContainText('None (simulated)')
  await expect(receipt).toContainText('Simulated payment · no ledger entry')
  await expect(receipt).toContainText('Net costS$0.00')
  await expect(receipt).toContainText('RefundedS$0.30 · Simulated')
  labels.receipt = await count()
  await expect(receipt).toHaveCSS('opacity', '1')
  await shot('14-receipt-refunded')
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious','critical'].includes(v.impact ?? ''))).toEqual([])
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k'); await shot('17-palette'); await page.keyboard.press('Escape')
  for (const width of [320,360,390,768,1024,1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 390) { expect((await page.locator('.ra-q').boundingBox())!.width).toBeLessThanOrEqual(358); await shot('26-mobile-done'); await page.locator('.ra-mobile-spend > button').click(); await shot('25-mobile-spend'); await page.getByRole('button', { name: 'Close spend' }).click() }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.ra-net').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.addStyleTag({ content: 'html { font-size: 200% }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Control+2')
  await expect(page.getByText('Each writer carries an authorship label. Sales and trust below come from your history.')).toBeVisible()
  await page.keyboard.press('Control+1')
  await page.locator('.ra-decision-details > summary').click()
  await expect(page.getByText('Decided by Offline rules').first()).toBeVisible()
  await writeFile('.playwright/evidence/ux-labels.json', JSON.stringify(labels, null, 2))
})

test('UX-1 stage screenshots and a single actionable scope error', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const { staged } = await import('../src/stage')
  const full = JSON.parse(await readFile('src/fixtures/uc/uc3.json', 'utf8')) as import('../shared/contracts').RunSnapshot
  const uc2 = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8')) as import('../shared/contracts').RunSnapshot
  let shown = full
  await page.addInitScript(() => localStorage.setItem('researchagent.environment-seen', '1'))
  await page.route('**/runs/fixture-uc3', route => route.fulfill({ json: shown }))
  await page.route('**/runs/fixture-uc3/events', route => route.fulfill({ contentType: 'text/event-stream', body: ': screenshot replay\n\n' }))
  await page.setViewportSize({ width: 1440, height: 900 })
  const capture = async (name: string) => {
    await page.goto('/?run=fixture-uc3&pace=real')
    await expect(page.locator('.ra-q')).toBeVisible()
    await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 65, animations: 'disabled' })
  }
  const at = (run: typeof full, predicate: (e: typeof full.events[number]) => boolean) => run.events.find(predicate)!.id
  shown = staged(uc2, at(uc2, e => e.type === 'SEARCH'))
  await capture('04-running-search')
  shown = staged(uc2, at(uc2, e => e.type === 'PURCHASE' && e.data?.status === 'RESERVED'))
  await capture('05-running-buying')
  shown = staged(uc2, at(uc2, e => e.type === 'PROOF'))
  await capture('06-running-verifying')
  shown = staged(full, at(full, e => e.type === 'PROOF'))
  await capture('10-uc3-proof-failed')
  shown = staged(full, at(full, e => e.type === 'REFUND'))
  await capture('11-uc3-refund')
  shown = { ...uc2, phase: 'FAILED', checkpoint: { ...uc2.checkpoint, nextAction: 'retry-delivery' }, answers: uc2.answers.slice(0,1) }
  await capture('21-recovering-run')
  await expect(page.getByText('Finishing after a restart…', { exact: true })).toBeVisible()
  await page.route('**/api/scope', route => route.fulfill({ status: 500, json: { error: 'test' } }))
  await page.goto('/?pace=real')
  await page.getByRole('button', { name: /^Bank of Japan decision/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  await expect(page.getByRole('alert')).toHaveCount(1)
  await page.screenshot({ path: `${dir}/20-error-single.jpg`, type: 'jpeg', quality: 65, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?pace=real')
  await page.screenshot({ path: `${dir}/24-mobile-home.jpg`, type: 'jpeg', quality: 65, animations: 'disabled' })
  await page.goto('/?record=1')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.ra-env-trigger')).toBeVisible()
  await expect(page.getByRole('region', { name: "What’s real here" })).toHaveCount(0)
  await page.screenshot({ path: `${dir}/23-record-home.jpg`, type: 'jpeg', quality: 65, animations: 'disabled' })
})
