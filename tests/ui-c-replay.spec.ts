import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { evidencePath } from './evidence-path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp } from 'node:fs/promises'
for (const width of [1280, 390]) test(`UC3 stepper in the actual replay build at ${width}`, async ({ page }, info) => {
  const root = info.outputPath('pages')
  await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
  await cp('site/demo', `${root}/theFastandtheFungible/demo`, { recursive: true })
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(server.stdout!, 'data')
    const port = String(chunk).match(/port (\d+)/)?.[1]
    if (!port) throw Error('Replay server did not choose a port')
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/?scenario=UC3-key-reveal`)
    await expect(page.locator('.ra-replay-provenance')).toContainText('Recorded run · fixture answers · fictional writers and content · XRPL Testnet, no real value')
    const steppers = page.locator('.ra-brief .ra-payment-stepper')
    await expect(steppers).toHaveCount(2)
    for (const stepper of await steppers.all()) {
      await stepper.locator(':scope > summary').click()
      for (const step of ['Locked', 'Key published', 'Unlocked']) await expect(stepper.getByRole('list').getByText(step, { exact: true })).toBeVisible()
      for (const name of ['EscrowCreate', 'EscrowFinish']) await expect(stepper.getByRole('link', { name })).toHaveAttribute('href', /^https:\/\/testnet.xrpl.org\/transactions\/[A-F0-9]{64}$/)
      await expect(stepper.getByRole('button', { name: 'Check the key yourself' })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
    await page.screenshot({ path: evidencePath(`ui-c/after/replay-${width}.png`), fullPage: true })
  } finally { server.kill('SIGTERM'); await once(server, 'exit') }
})
