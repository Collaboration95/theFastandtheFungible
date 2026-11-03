import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))

test('ready desk has no serious automated accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.ra-env-pop').evaluateAll(els => Promise.all(els.flatMap(el => el.getAnimations().map(a => a.finished))))
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
  await expect(page.getByRole('button', { name: 'Start now' })).toBeVisible()
  expect(await serious(page)).toEqual([])
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
  expect(await serious(page)).toEqual([])
  await page.getByRole('tab', { name: 'Writers' }).click()
  expect(await serious(page)).toEqual([])
})

test('all cast states have names, load artwork, reflow and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/design/cast/qa.html')
  const marks = page.getByRole('img')
  await expect(marks).toHaveCount(144)
  await expect(page.getByRole('img', { name: 'Purse · simulated', exact: true })).toHaveCount(3)
  await expect(page.getByRole('img', { name: /AlphaLeak · caught · fictional writer/ })).toHaveCount(3)
  const artwork = await page.locator('.ra-cast img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))
  expect(artwork).toBe(true)
  expect(await serious(page)).toEqual([])
  expect(await marks.first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addStyleTag({ content: 'html { font-size: 200% }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.reload()
  expect(await marks.first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
})
