import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

test('optional conversation loads on demand and preserves replies and keyboard focus', async ({ page }) => {
  await page.route('**/api/scope', route => route.fulfill({ json: { questions: [], plan: { restatement: 'Greeting', subqueries: ['Greeting'] }, chat: { reply: 'A fixture greeting.' }, label: 'fixture' } }))
  let requested = false
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  await page.route('**/ChatThread-*.js', async route => { requested = true; await blocked; await route.continue() })
  await page.goto('/?record=1')
  const question = page.getByRole('textbox', { name: 'Your question' })
  await expect(question).toBeEditable()
  expect(requested).toBe(false)
  await question.fill('Hello')
  await question.press('Control+Enter')
  try {
    await expect(page.getByRole('status')).toHaveText('Loading conversation…')
    expect(requested).toBe(true)
  } finally { release() }
  await expect(page.getByRole('log', { name: 'Conversation' })).toContainText('A fixture greeting.')
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeFocused()
  await expect(page.getByRole('log')).toContainText('no sources searched · nothing bought')
})

for (const width of [1280, 390]) for (const [module, label, ready] of [['ReceiptSheet', 'Receipt', 'Simulated payment · no ledger entry'], ['ShowWork', 'Show work', 'What the agent did, in order.']] as const) {
  test(`optional ${label} at ${width}px loads only on demand and keeps its loading sheet accessible`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const snapshot = JSON.parse(readFileSync('src/fixtures/uc/uc2.json', 'utf8'))
    await page.route('**/runs/fixture-uc2', route => route.fulfill({ json: snapshot }))
    await page.route('**/runs/fixture-uc2/events', route => route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' }))
    let requested = false
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    await page.route(`**/${module}-*.js`, async route => { requested = true; await blocked; await route.continue() })
    await page.goto('/?run=fixture-uc2&pace=real')
    await expect(page).toHaveTitle(/Answer ready/)
    expect(requested).toBe(false)
    if (width === 390 && label === 'Receipt') await page.getByRole('button', { name: /^Net cost/ }).click()
    await page.getByRole('button', { name: label, exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: label, exact: true })
    try {
      await expect(dialog.getByRole('status')).toHaveText(`Loading ${label.toLowerCase()}…`)
      expect(requested).toBe(true)
      expect((await dialog.boundingBox())!.height).toBeGreaterThanOrEqual(420)
    } finally { release() }
    await expect(dialog).toContainText(ready)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })
}

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
  await expect(page.getByRole('button', { name: /Simulated demo · fixture models · no real value/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /Payment: NotFinancialTimes/ })).toContainText('Verified')
  await tabTo(page, 'Receipt')
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
  await expect(page.getByText('Finishing after a restart…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume answer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Partial answer · interrupted' })).toBeVisible()
  snapshot = { ...snapshot, phase: 'STOPPED', stopped: true, answers: snapshot.answers.slice(0, 1) }
  await page.reload()
  await expect(page.getByText(/An earlier payment completed/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Partial answer · stopped' })).toBeVisible()
  snapshot = { ...snapshot, phase: 'BUY', stopped: false, labels: { ...snapshot.labels, settlement: XRPL_LABEL }, intents: [{ ...snapshot.intents[0], status: 'SUBMITTING' }], receipts: [], grants: [], events: [], spentMinor: 0, reservedMinor: 90 }
  await page.reload()
  await expect(page.locator('.ra-side').getByText(/Waiting/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'XRPL Testnet demo · fixture models · no real value', exact: true })).toBeVisible()
  snapshot = { ...ucRuns.UC2, intents: [], receipts: [], grants: [], spentMinor: 0, decisions: ucRuns.UC2.decisions.map(round => ({ ...round, rows: round.rows.map(row => ({ ...row, verdict: 'SKIP_OVER_BUDGET' as const })) })) }
  await page.reload()
  await expect(page.getByText(/Budget too small for eligible sources/)).toBeVisible()
})
