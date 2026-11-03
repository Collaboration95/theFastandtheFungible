import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    if (await page.getByRole('button', { name, exact: true }).evaluateAll(elements => elements.some(element => element === document.activeElement))) return
  }
  throw new Error(`Cannot reach ${name} by keyboard`)
}
test('UC2 keyboard only: palette, ask, clarify, plan, receipt, top layer, views, new question', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?pace=real')
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeEditable()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  await page.keyboard.type('UC2 ·')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeFocused()
  await page.keyboard.press('Control+Enter')
  await tabTo(page, 'pricing & margins')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Search plan' })).toBeVisible()
  await page.keyboard.press('Control+Enter')
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
  await expect(page.getByRole('button', { name: /Demo · simulated payments/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /Purchase: NotFinancialTimes/ })).toContainText('Verified')
  await tabTo(page, 'Receipt ›')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Receipt', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Receipt', exact: true })).toContainText('Simulated payment · no ledger entry')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+2')
  await expect(page.getByRole('region', { name: 'Writers', exact: true })).toBeVisible()
  await page.keyboard.press('Control+1')
  await page.keyboard.press('w')
  await expect(page.getByRole('dialog', { name: /Show work/ })).toBeVisible()
  await page.keyboard.press('Escape')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
  await page.screenshot({ path: '.playwright/evidence/after-uc2.png' })
  await info.attach('UC2 after', { path: '.playwright/evidence/after-uc2.png', contentType: 'image/png' })
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.addStyleTag({ content: 'html { font-size: 200% }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.keyboard.press('Control+n')
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Your question' })).toHaveValue('')
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Your question' }).press('Tab')
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
})

test('first run, recoverable backend error, record mode and narrow reflow', async ({ page }) => {
  await page.route('**/api/health', route => route.abort())
  await page.goto('/?record=1')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('button', { name: /presenter/i })).toHaveCount(0)
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('failure recovery views: labelled fallback, slow Testnet, stopped unused payment and small budget (injected snapshots)', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const ucRuns = { UC2: JSON.parse(await readFile(new URL('../src/fixtures/uc/uc2.json', import.meta.url), 'utf8')) as import('../shared/contracts').RunSnapshot }
  const { XRPL_LABEL } = await import('../shared/contracts')
  let snapshot = structuredClone(ucRuns.UC2)
  await page.route('**/runs/fixture-uc2', route => route.fulfill({ json: snapshot }))
  await page.route('**/runs/fixture-uc2/events', route => route.fulfill({ contentType: 'text/event-stream', body: ': fixture test\n\n' }))
  await page.route('**/api/health', route => route.fulfill({ json: { labels: { ...snapshot.labels, research: 'DeepSeek · configured' } } }))
  await page.goto('/?run=fixture-uc2&pace=real')
  await expect(page.getByText('Written from offline extracts: the model was unavailable.')).toBeVisible()
  snapshot = { ...snapshot, phase: 'FAILED', checkpoint: { ...snapshot.checkpoint, nextAction: 'retry-delivery' } }
  await page.reload()
  await expect(page.getByText('Recovering', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume answer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Draft · free sources only' })).toBeVisible()
  snapshot = { ...snapshot, phase: 'STOPPED', stopped: true, answers: snapshot.answers.slice(0, 1) }
  await page.reload()
  await expect(page.getByText(/An earlier payment completed/).first()).toBeVisible()
  snapshot = { ...snapshot, phase: 'BUY', stopped: false, labels: { ...snapshot.labels, settlement: XRPL_LABEL }, intents: [{ ...snapshot.intents[0], status: 'SUBMITTING' }], receipts: [], grants: [], events: [], spentMinor: 0, reservedMinor: 90 }
  await page.reload()
  await expect(page.locator('.ra-side').getByText(/Waiting/)).toBeVisible()
  await expect(page.getByRole('button', { name: /XRPL Testnet · test funds/ })).toBeVisible()
  snapshot = { ...ucRuns.UC2, intents: [], receipts: [], grants: [], spentMinor: 0, decisions: ucRuns.UC2.decisions.map(round => ({ ...round, rows: round.rows.map(row => ({ ...row, verdict: 'SKIP_OVER_BUDGET' as const })) })) }
  await page.reload()
  await expect(page.getByText(/Budget too small for eligible sources/)).toBeVisible()
})
