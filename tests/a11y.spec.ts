import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))

test('ready desk has no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/')
  expect(await serious(page)).toEqual([])
})

test('clarify chips, plan card, finished UC2 run and Writers tab have no serious violations', async ({ page }) => {
  test.setTimeout(120_000)
  // Reduced motion: axe must judge the settled colours, not a card mid-fade.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?pace=real')
  await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  await expect(page.getByRole('button', { name: 'pricing & margins' })).toBeVisible()
  expect(await serious(page)).toEqual([])
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  await expect(page.getByRole('button', { name: 'Go now' })).toBeVisible()
  expect(await serious(page)).toEqual([])
  await page.getByRole('button', { name: 'Go now' }).click()
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
  expect(await serious(page)).toEqual([])
  await page.getByRole('tab', { name: 'Writers' }).click()
  expect(await serious(page)).toEqual([])
})
