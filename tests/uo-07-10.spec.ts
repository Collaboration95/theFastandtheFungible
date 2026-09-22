import { expect, test } from '@playwright/test'

async function approveCanonicalPlan(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('researchagent.setup-draft.v1'))
  await page.reload()
  await page.getByRole('button', { name: 'Use this example' }).click()
  await page.getByRole('button', { name: 'Continue to budget' }).click()
  await page.getByRole('button', { name: 'Continue to review' }).click()
  await page.getByRole('button', { name: 'Approve plan & start research' }).click()
}

test.describe('UO-07 through UO-10 workspace hardening', () => {
  test('centered workspace keeps budget, tabs, and source actions visible across widths', async ({ page }) => {
    await approveCanonicalPlan(page)
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Overview' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Sources/ })).toBeFocused()
    await expect(page.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#sources-panel')).toHaveAttribute('aria-labelledby', 'tab-sources')
    await expect(page.locator('#tab-sources')).toHaveAttribute('aria-controls', 'sources-panel')
    await page.getByRole('tab', { name: /Sources/ }).click()
    await expect(page.getByRole('heading', { name: '12 previews from approved fixture profiles' })).toBeVisible()
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.getByLabel('Persistent research budget')).toContainText('Cap 0.20 XRP · Spent 0.00 XRP · Remaining 0.20 XRP')
    await page.getByRole('button', { name: /Show .* more sources/ }).click()
    const widths = [360, 390, 768, 1024, 1440]
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await expect(page.locator('.source-row').filter({ hasText: 'Circuit Note' }).getByRole('button', { name: 'Skip S$0.30', exact: true })).toBeVisible()
      await page.screenshot({ path: `test-results/workspace-${width}.png`, fullPage: true })
    }
  })

  test('purchase approval is cancellable, focus-contained, and restores focus', async ({ page }) => {
    await approveCanonicalPlan(page)
    await page.getByRole('tab', { name: /Sources/ }).click()
    await expect(page.getByRole('heading', { name: '12 previews from approved fixture profiles' })).toBeVisible()
    await page.getByRole('button', { name: /Show .* more sources/ }).click()
    const row = page.locator('.source-row').filter({ hasText: 'Northstar Wire' })
    const action = row.getByRole('button', { name: 'Approve purchase S$0.20', exact: true })
    await action.click()
    const dialog = page.getByRole('dialog', { name: 'Confirm this purchase' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('0.02 XRP')
    await expect(dialog).toContainText('S$0.20')
    await expect(dialog).toContainText('0.18 XRP')
    await expect(dialog.getByLabel('Cancel purchase confirmation')).toBeFocused()
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(action).toBeFocused()
    await expect(page.getByLabel('Persistent research budget')).toContainText('Spent 0.00 XRP')
    await expect(page.getByText('Purchase review cancelled. No payment or access grant occurred.').last()).toBeVisible()
  })

  test('reduced motion and zoom keep the answer surface truthful', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await approveCanonicalPlan(page)
    await page.evaluate(() => { document.body.style.zoom = '2' })
    await expect(page.getByRole('heading', { name: 'What the evidence says so far' })).toBeVisible()
    await expect(page.getByText('FIXTURE RESEARCH · SYNTHETIC CORPUS', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/workspace-200-percent.png', fullPage: true })
  })

  test('pause, resume, stop, and reload preserve server-owned run state', async ({ page }) => {
    await approveCanonicalPlan(page)
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByText(/PAUSED/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'What the evidence says so far' })).toBeVisible()
    await expect(page.getByText('Research run restored from the server.').last()).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByText(/STOPPED/).first()).toBeVisible()
    await expect(page.getByText('This run is read-only; start a new run to continue.').last()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop' })).toBeDisabled()
  })
})
