// Headless first-touch walk: landing → every demo tab → ledger → release link.
// Run with `npm run test:judge` (builds the demo first). Hermetic: XRPL sockets and GitHub are stubbed.
import { test, expect, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'

const TAG = 'https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.0.0-rc.1'
const SIMULATED: Record<string, RegExp> = { 'Testnet UC3 · payment': /^Malaysia packaging lead times/, 'Simulated UC1': /^Bank of Japan decision/, 'Simulated UC2': /^Kestrel–TSMC outlook/, 'Simulated UC3': /^Malaysia packaging lead times/ }
const TABS = ['Testnet UC3 · key reveal', 'Testnet UC3 · payment', 'Testnet · writer no-show', 'Simulated UC1', 'Simulated UC2', 'Simulated UC3'] as const
let server: ChildProcess, base: string

// eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured first argument.
test.beforeAll(async ({}, info) => {
  const root = info.outputPath('pages')
  await mkdir(root, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  const [chunk] = await once(server.stdout!, 'data')
  base = `http://127.0.0.1:${String(chunk).match(/port (\d+)/)![1]}/theFastandtheFungible`
})
test.afterAll(async () => { server.kill('SIGTERM'); await once(server, 'exit') })
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
  await page.route('https://github.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>release</title>' }))
})

/** Watch one replay to completion; report every forbidden string seen on the way. */
async function walk(page: Page, tab: string) {
  await page.goto(`${base}/demo/`)
  if (tab !== TABS[0]) await page.getByRole('navigation', { name: 'Recorded scenarios' }).getByRole('link', { name: tab, exact: true }).click()
  // The payment and simulated replays wait for the judge to pick their recorded question.
  if (SIMULATED[tab]) {
    await page.getByRole('button', { name: SIMULATED[tab] }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
  }
  const seen = new Set<string>()
  let ready = false
  for (let second = 0; second < 60 && !ready; second++) {
    const text = await page.locator('body').innerText()
    for (const bad of ['v0.8.0', 'twenty twenty', 'Failed', 'could not finish']) if (text.includes(bad)) seen.add(bad)
    ready = /Answer ready/.test(await page.title())
    if (!ready) await page.waitForTimeout(1000)
  }
  return { seen, ready }
}
const contrast = async (page: Page) => !(await page.locator('.ra-payment').count()) ? [] : new AxeBuilder({ page }).include('.ra-payment').withRules(['color-contrast']).analyze().then(r => r.violations)

test('landing points at the release candidate, never the stale Latest', async ({ page }) => {
  await page.goto(`${base}/`)
  await expect(page.locator('body')).not.toContainText('v0.8.0')
  expect(await page.locator('a[href*="releases/latest"]').count()).toBe(0)
  const mac = page.getByRole('link', { name: 'Download for Mac', exact: true })
  await expect(mac).toHaveAttribute('href', TAG)
  await mac.click()
  expect(page.url()).toBe(TAG)
})

for (const tab of TABS) {
  test(`demo tab "${tab}": never shows Failed, stale or spelled-out text, and finishes`, async ({ page }) => {
    test.setTimeout(120_000)
    const { seen, ready } = await walk(page, tab)
    expect(ready, 'replay reached Answer ready').toBe(true)
    expect([...seen]).toEqual([])
    expect(await contrast(page), 'axe color-contrast on payment cards').toEqual([])
    if (tab === TABS[0]) {
      const banner = page.locator('.demo-banner')
      await banner.locator('summary').click()
      await expect(banner).toContainText('researchagent-mcp-1.0.0-rc.1.tgz')
      await expect(banner.getByRole('link', { name: /Release candidate/ })).toHaveAttribute('href', TAG)
      expect(await banner.locator('a[href*="releases/latest"]').count()).toBe(0)
    }
  })
}

test('ledger: live-check progress replaces the stale snapshot text within 3 s', async ({ page }) => {
  const initial = await (await page.request.get(`${base}/ledger/`)).text()
  expect(initial).toContain('Checking 25 hashes live… 0/25')
  expect(initial).not.toContain('Principal amount not recorded in this evidence</td><td>12 drops')
  await page.goto(`${base}/ledger/`)
  await page.waitForTimeout(3000)
  await expect(page.locator('body')).not.toContainText('not freshly verified')
  await expect(page.getByRole('status')).toContainText(/Read-only check finished: \d+\/25/)
  await expect(page.getByText('Memo = audit head 2861e38da5e3…; answer anchor')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Real writers' })).toBeVisible()
  await expect(page.getByText('real person · Testnet · no real value', { exact: true })).toBeVisible()
  await expect(page.getByText('No consenting writers listed yet.')).toBeVisible()
})
