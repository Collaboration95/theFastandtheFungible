import { expect, test } from '@playwright/test'

const draftKey = 'researchagent.setup-draft.v1'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate((key) => window.localStorage.removeItem(key), draftKey)
  await page.reload()
})

test('guided setup keeps one decision per step and preserves Back values', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Start with a question worth investigating.' })).toBeVisible()
  await page.getByRole('button', { name: 'Use this example' }).click()
  await expect(page.getByRole('heading', { name: 'Choose what the agent may read.' })).toBeVisible()

  const profiles = page.locator('.setup-source-option')
  const count = await profiles.count()
  for (let index = 0; index < count; index += 1) await profiles.nth(index).click()
  await page.getByRole('button', { name: 'Continue to budget' }).click()
  await expect(page.getByRole('alert')).toHaveText(/Choose at least one allowed-to-read source profile/)
  await profiles.first().click()
  await page.getByRole('button', { name: 'Continue to budget' }).click()
  await expect(page.getByRole('heading', { name: 'Set the maximum research spend.' })).toBeVisible()
  await page.getByLabel('Maximum research spend in XRP').fill('0.5')
  await expect(page.getByText('≈ S$5.00', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'Choose what the agent may read.' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to budget' }).click()
  await expect(page.getByLabel('Maximum research spend in XRP')).toHaveValue('0.5')
})

test('saved draft restores without repeating the first-run explainer', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Research question' }).fill('Will clean-energy investment be sustainable in 2028?')
  await page.getByRole('button', { name: 'Continue to sources' }).click()
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('contentinfo').getByText('Draft saved locally', { exact: false })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Resume your saved research setup.' })).toBeVisible()
  await expect(page.getByText('Will clean-energy investment be sustainable in 2028?', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Start with a question worth investigating.' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Resume setup' }).click()
  await expect(page.getByRole('heading', { name: 'Choose what the agent may read.' })).toBeVisible()
})

test('budget continues to readable plan review without silently forcing a horizon', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Research question' }).fill('Will clean-energy investment be sustainable in 2028?')
  await page.getByRole('button', { name: 'Continue to sources' }).click()
  await page.getByRole('button', { name: 'Continue to budget' }).click()
  await page.getByRole('button', { name: 'Continue to review' }).click()
  await expect(page.getByRole('heading', { name: 'Unsupported fixture scope' })).toBeVisible()
  await expect(page.getByText('Through 2028', { exact: true })).toHaveCount(0)
})

test('guided setup reflows at 320 CSS pixels without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Start with a question worth investigating.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/setup-320.png', fullPage: true })
})
