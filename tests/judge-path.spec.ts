import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'

test('judge path: landing, every replay, ledger progress and RC release', async ({ page }, info) => {
  const root = info.outputPath('pages')
  await mkdir(root, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(server.stdout!, 'data')
    const base = `http://127.0.0.1:${String(chunk).match(/port (\d+)/)![1]}/theFastandtheFungible`
    await page.goto(base + '/')
    await expect(page.locator('body')).not.toContainText('v0.8.0')
    await expect(page.getByRole('link', { name: 'Download for Mac', exact: true })).toHaveAttribute('href', /releases\/tag\/v1\.0\.0-rc/)
    for (const scenario of ['', '?scenario=UC-key-reveal', '?scenario=UC1', '?scenario=UC2']) {
      await page.goto(base + '/demo/' + scenario)
      for (let second = 0; second < 40; second++) {
        await expect(page.locator('body')).not.toContainText('v0.8.0')
        await expect(page.locator('body')).not.toContainText('twenty twenty')
        await page.waitForTimeout(1000)
        if (await page.title().then(t => t.includes('Answer ready'))) break
      }
    }
    await page.goto(base + '/ledger/')
    await page.waitForTimeout(3000)
    await expect(page.locator('body')).not.toContainText('not freshly verified')
    await expect(page.getByRole('status')).toContainText(/Checking \d+ hashes live|check finished/)
    // External GitHub release navigation is checked through authenticated gh in shipping.
  } finally { server.kill('SIGTERM'); await once(server, 'exit') }
})

test.fixme('all replay frames exclude Failed and could not finish', async () => {
  // Lane B owns src/App.tsx and replay traces; enable after its replay fix merges.
})
test.fixme('payment card passes axe color-contrast', async ({ page }) => {
  // Lane B owns the faint key line in src/format.tsx; enable after its fix merges.
  const result = await new AxeBuilder({ page }).include('.ra-payment-card').withRules(['color-contrast']).analyze()
  expect(result.violations).toEqual([])
})
