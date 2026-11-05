import { test, expect } from '@playwright/test'
import { DEMO_QUESTIONS } from '../shared/contracts/examples'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const dir = process.env.UX2_SCREENSHOTS ?? '.playwright/evidence/ux2'
test('UX-2: UC4, exact lead citation, export, supporting screens and mobile Spend', async ({ page }) => {
  await mkdir(dir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?pace=real')
  await expect(page.getByRole('region', { name: "What's real here" })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Your question' }).fill(DEMO_QUESTIONS.find(q => q.id === 'UC4')!.text)
  await page.getByRole('button', { name: /^Ask/ }).click()
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page).toHaveTitle(/Answer ready/)
  await expect(page.locator('.ra-activity-details')).not.toHaveAttribute('open', '')
  await page.locator('.ra-activity-details > summary').click()
  await expect(page.locator('.ra-activity-details')).toHaveAttribute('open', '')
  await page.locator('.ra-activity-details > summary').click()
  await expect(page.locator('.ra-vtext')).toContainText('15 August 2026')
  await expect(page.getByRole('region', { name: 'Requested facts' })).toHaveCount(0) // native details, not a redundant landmark
  await expect(page.getByText('3 of 3 answered', { exact: false })).toBeVisible()
  await page.screenshot({ path: `${dir}/uc4.jpg`, quality: 70 })
  await page.locator('.ra-vtext .ra-cite').first().click()
  await expect(page.getByRole('dialog')).toContainText('Passage')
  await expect(page.locator('.ra-passage mark')).toContainText('15 August 2026')
  await page.keyboard.press('Escape')
  await page.getByRole('region', { name: 'Sources', exact: true }).getByRole('button', { name: 'View all' }).click()
  await expect(page.getByRole('dialog', { name: 'All sources' })).toContainText('Writer / access')
  await page.keyboard.press('Escape')
  await page.getByText('Export ⋯', { exact: true }).click()
  // UC4 is fully covered by free evidence; no paid comparison should be offered.
  await expect(page.getByRole('button', { name: 'See what changed after the purchase' })).toHaveCount(0)
  await page.getByText('Export ⋯', { exact: true }).click()
  await page.getByRole('tab', { name: /Writers/ }).click()
  await expect(page.getByRole('columnheader', { name: 'Checked / failed' })).toBeVisible()
  await page.screenshot({ path: `${dir}/writers.jpg`, quality: 70 })
  await page.keyboard.press('Control+1')
  await page.keyboard.press('w')
  await expect(page.getByText('What the agent did, in order.')).toBeVisible()
  await page.screenshot({ path: `${dir}/show-work.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('combobox')).toHaveAttribute('placeholder','Search actions, runs and examples')
  await expect(page.getByRole('dialog')).not.toContainText('UC2')
  await page.screenshot({ path: `${dir}/palette.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.ra-mobile-spend > button').click()
  const sheet = page.getByRole('dialog', { name: 'Spend and payments' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('S$0.00')
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious','critical'].includes(v.impact ?? ''))).toEqual([])
  await page.screenshot({ path: `${dir}/mobile-spend.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Show sidebar' }).click()
  await page.getByRole('button', { name: 'Writers', exact: true }).click()
  await expect(page.getByText('All writers and articles are fictional.')).toBeVisible()
  await writeFile(`${dir}/environment.txt`, 'Local Chromium; offline demo; simulated payments; no live providers or Testnet.\n')
})

test('paid UC2 export opens the before/after comparison and returns to the answer', async ({ page }) => {
  await page.goto('/?pace=real')
  await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page).toHaveTitle(/Answer ready/)
  await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('1 kept · 0 refunded')
  await page.getByText('Export ⋯', { exact: true }).click()
  await page.getByRole('button', { name: 'See what changed after the purchase' }).click()
  await expect(page.getByRole('region', { name: 'What changed after the purchase' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to answer' }).click()
  await expect(page.locator('.ra-vtext')).toContainText('55.2%')
})

test('completed Testnet answer gets its anchor without a reload and polling stops', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  // Use the contract's exact settlement label, with fixture content and stubbed ledger evidence.
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  run.labels.settlement = XRPL_LABEL
  run.events.at(-1).at = new Date().toISOString()
  let reads = 0
  let ready = false
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => {
    reads++
    return route.fulfill({ json: { ...run, ...(ready ? { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', txHash: 'A'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', head: 'b'.repeat(64), runIdHash: 'c'.repeat(64), ledgerIndex: 123, feeDrops: '12' } } : {}) } })
  })
  await page.goto(`/?run=${run.runId}&pace=real`)
  await expect(page.getByText('Anchoring…', { exact: true }).first()).toBeVisible()
  ready = true
  const anchor = page.getByRole('link', { name: 'Anchored on XRPL · ledger 123' }).first()
  await expect(anchor).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${'A'.repeat(64)}`)
  const stoppedAt = reads
  await page.waitForTimeout(4500)
  expect(reads).toBe(stoppedAt)
})

test('anchor waiting ends after its bounded deadline', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  run.labels.settlement = XRPL_LABEL
  run.events.at(-1).at = new Date().toISOString()
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => route.fulfill({ json: run }))
  await page.clock.install()
  await page.goto(`/?run=${run.runId}&pace=real`)
  await expect(page.getByText('Anchoring…', { exact: true }).first()).toBeVisible()
  await page.clock.fastForward(91_000)
  await expect(page.getByText('No anchor recorded for this Testnet run (anchoring was off or unavailable)', { exact: true }).first()).toBeVisible()
})
