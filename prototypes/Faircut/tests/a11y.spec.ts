import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${label}: axe violations`).toEqual([])
}

test.describe('FairCut accessibility states', () => {
  test('has no automated accessibility violations in desktop journey states', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await page.getByRole('button', { name: /Scenario/ }).click()
    await page.getByRole('menuitem', { name: 'Reset demo' }).click()
    await expect(page.getByRole('button', { name: 'Run guided demo' })).toBeVisible()
    await expectAccessible(page, 'initial')

    await page.getByRole('button', { name: 'Run guided demo' }).click()
    await page.getByRole('button', { name: 'Next step' }).click()
    await expect(page.getByText('Blocked before signing', { exact: true }).first()).toBeVisible()
    await expectAccessible(page, 'blocked')

    await page.getByRole('button', { name: 'Next step' }).click()
    await expect(page.getByRole('heading', { name: 'Dawn Current — 12s sting', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /License for 8,000 drops/i }).click()
    await expect(page.getByText(/Fixture purchase recorded/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Selected' })).toBeEnabled()
    await expectAccessible(page, 'payment')

    await page.getByRole('button', { name: /Verify delivered stem/i }).click()
    await expect(page.getByRole('heading', { name: 'Hear the difference.' })).toBeVisible()
    await expectAccessible(page, 'final')

    await page.getByRole('button', { name: 'Open rights receipt' }).click()
    await expect(page.getByRole('dialog', { name: 'Evidence drawer' })).toBeVisible()
    await expectAccessible(page, 'receipt')
    await page.keyboard.press('Escape')
  })

  test('keeps the page inside the viewport at a zoom-equivalent width', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    await page.goto('/demo')
    await expect(page.getByRole('heading', { name: /Leah needs one usable cue/i })).toBeVisible()
    const geometry = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(geometry.scrollWidth).toBe(geometry.clientWidth)
  })

  test('keeps the mobile navigation accessible when opened', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/demo')
    await page.getByRole('button', { name: 'Open project navigation' }).click()
    await expect(page.getByRole('button', { name: 'Close project navigation' })).toBeFocused()
    await expectAccessible(page, 'mobile navigation')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Open project navigation' })).toBeFocused()
  })
})
