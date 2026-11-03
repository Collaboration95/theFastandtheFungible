import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp, readdir, stat } from 'node:fs/promises'
// Python chooses an ephemeral port. Serve the actual Pages subpath, without a backend.
test('static Pages UC3: draft, verified upgrade, refund, receipt, citation and Writers', async ({ page }, info) => {
  const assets = await readdir('site/demo/assets')
  let jsBytes = 0
  for (const file of assets.filter(f => f.endsWith('.js') || f.endsWith('.json'))) jsBytes += (await stat(`site/demo/assets/${file}`)).size
  expect(jsBytes).toBeLessThan(2_000_000)
  const root = info.outputPath('pages')
  await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  const python = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(python.stdout!, 'data')
    const port = String(chunk).match(/port (\d+)/)?.[1]
    expect(port).toBeTruthy()
    const errors: string[] = [], requests: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
    await expect(page.getByText('Replay of a recorded run · fictional writers · simulated payments')).toBeVisible()
    await page.getByRole('button', { name: /^Malaysia packaging lead times/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page.getByText('Draft · free sources only', { exact: true })).toBeVisible()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByText('Updated with paid evidence', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: /Purchase: AlphaLeak/ })).toContainText('Refunded S$0.30')
    await expect(page.getByRole('region', { name: 'Purchase: The Fab Floor' })).toContainText('Verified')
    await page.screenshot({ path: info.outputPath('uc3.png'), fullPage: true })
    await page.getByRole('button', { name: /Receipt/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.locator('.ra-cite').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').locator('mark')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Writers' }).click()
    await expect(page.getByText(/quarantined/i).first()).toBeVisible()
    await page.getByRole('button', { name: 'AlphaLeak' }).click()
    await expect(page.getByText(/Honesty 0\.40/)).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByText('Run it yourself', { exact: true }).click()
    await expect(page.getByText(/claude mcp add researchagent/)).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
    await page.keyboard.press('Meta+k')
    await page.getByRole('button', { name: /What's the analyst outlook/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByRole('region', { name: /Purchase: NotFinancialTimes/ })).toContainText('Verified')
    expect(errors).toEqual([])
    expect(requests.every(url => url.startsWith(`http://127.0.0.1:${port}/theFastandtheFungible/`))).toBe(true)
  } finally { python.kill('SIGTERM'); await once(python, 'exit') }
})
