import { expect, test } from '@playwright/test'

test('canonical fixture run makes the budget decisions visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'What evidence is worth buying before the committee meets?' })).toBeVisible()
  await page.getByRole('button', { name: 'Run research' }).click()
  await expect(page.locator('#brief').getByText('Research map complete. Review which evidence earns the next dollar.')).toBeVisible()
  const row = (name: string) => page.locator('.source-row').filter({ hasText: name })
  await row('Northstar Wire').getByRole('button', { name: 'Buy', exact: true }).click()
  await row('Circuit Note').getByRole('button', { name: 'Skip', exact: true }).click()
  await row('The Meridian Ledger').getByRole('button', { name: 'Buy', exact: true }).click()
  await row('GridScope Asia').getByRole('button', { name: 'Block', exact: true }).click()
  await expect(page.locator('#brief').getByText('GridScope blocked: S$1.40 exceeds the remaining S$1.00.')).toBeVisible()
  await page.getByRole('button', { name: 'Synthesize dossier' }).click()
  await expect(page.locator('#brief').getByText('Dossier ready. Claims are linked to exact accessible spans.')).toBeVisible()
  await expect(page.getByText('FIXTURE RESEARCH · NOT INVESTMENT ADVICE')).toBeVisible()
  await expect(page.getByText('S$1.00', { exact: true }).first()).toBeVisible()
})

test('premium evidence is protected until its exact purchase', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('.source-row').filter({ hasText: 'Circuit Note' })
  await row.getByRole('button', { name: /Inspect Circuit Note/ }).click()
  await expect(page.getByText('Full text is protected')).toBeVisible()
  await expect(page.getByText('Only metadata, preview, price, and terms are visible before exact settlement.')).toBeVisible()
  await expect(page.getByText('Two switchgear suppliers said booked orders now extend beyond twelve months')).toHaveCount(0)
})
