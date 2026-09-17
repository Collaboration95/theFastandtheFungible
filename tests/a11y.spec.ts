import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('ready desk has no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
})
