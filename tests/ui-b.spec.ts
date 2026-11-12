// Committed recordings only; no hosted questions or live ledger checks.
import { test as base, expect, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import recordingIndex from '../demo/recording-index.json' with { type: 'json' }
import { evidencePath } from './evidence-path'
import { dateSGT } from '../shared/presentation'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp } from 'node:fs/promises'
const test = base.extend<object, { replayURL: string }>({
  replayURL: [async ({ browserName }, use, info) => {
    const root = `${info.project.outputDir}/ui-b-${browserName}-${info.workerIndex}`
    await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
    await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
    const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
    try {
      const [chunk] = await once(server.stdout!, 'data')
      const port = String(chunk).match(/port (\d+)/)?.[1]
      if (!port) throw Error('Replay server did not choose a port')
      await use(`http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
    } finally { server.kill('SIGTERM'); await once(server, 'exit') }
  }, { scope: 'worker' }],
})
const baseline = process.env.UI_B_BASELINE === '1'
const dir = evidencePath(`ui-b/${baseline ? 'before' : 'after'}`)
const provenance = 'Recorded run · fixture answers · fictional writers and content · '
test.describe('UI-B recorded fixtures', () => {
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
  mkdirSync(dir, { recursive: true })
})
for (const entry of recordingIndex) test(`UI-B replay provenance and dates: ${entry.scenario}`, async ({ page, replayURL }) => {
  test.skip(baseline)
  const { run } = JSON.parse(readFileSync(`demo/traces/${entry.scenario}.json`, 'utf8'))
  const date = dateSGT(run.events[0].at)
  await page.goto(`${replayURL}?scenario=${entry.scenario}`)
  await expect(page.locator('.ra-replay-provenance')).toHaveText(provenance + (entry.testnet ? 'XRPL Testnet, no real value' : 'simulated payments, no real value'))
  await expect(page).toHaveTitle(new RegExp(`^Replay · ${date} · `))
  await expect(page.locator('.demo-shell > summary .demo-label')).toContainText(date)
  await expect(page).toHaveTitle(/Answer ready/)
  await expect(page).toHaveTitle(new RegExp(`^Replay · ${date} · `))
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.demo-short')).toContainText(date)
})
for (const width of [1280, 390]) test(`UI-B targets, drawers and axe at ${width}`, async ({ page, replayURL }) => {
  await page.setViewportSize({ width, height: 844 })
  await page.goto(`${replayURL}?scenario=UC3-key-reveal`)
  await expect(page.locator('.ra-q')).toBeVisible()
  const sizes: Record<string, { width: number; height: number }[]> = {}
  const audits: unknown[] = []
  const capture = async (state: string) => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const result = await new AxeBuilder({ page }).analyze()
    const serious = result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
    audits.push({ state, serious })
    if (!baseline) expect(serious).toEqual([])
    await page.screenshot({ path: `${dir}/${state}-${width}.png`, fullPage: true })
  }
  const measure = async (name: string, locator: Locator) => {
    const visible = locator.filter({ visible: true })
    await expect(visible.first(), name).toBeVisible()
    sizes[name] = []
    for (const el of await visible.all()) {
      const box = (await el.boundingBox())!
      sizes[name].push({ width: box.width, height: box.height })
      if (!baseline && width === 390) {
        expect(box.width, name).toBeGreaterThanOrEqual(44)
        expect(box.height, name).toBeGreaterThanOrEqual(44)
        // Check the enlarged area belongs to this target, rather than a neighbour.
        await el.scrollIntoViewIfNeeded()
        expect(await el.evaluate(e => {
          const b = e.getBoundingClientRect()
          return [[b.left + 2, b.top + b.height / 2], [b.right - 2, b.top + b.height / 2], [b.left + b.width / 2, b.bottom - 2]].every(([x,y]) => e.contains(document.elementFromPoint(x,y)))
        }), `${name} owns its hit area`).toBe(true)
      }
    }
  }
  await measure('answer ledger anchor', page.locator('.ra-verdict .ra-caption > a[href*="testnet.xrpl.org/transactions"]'))
  await capture('answer')
  if (width === 390) await page.locator('.ra-mobile-spend > button').click()
  const spend = page.locator('.ra-spend:visible')
  await spend.locator('.ra-spending-proof > summary').click()
  await measure('payment external icon', spend.getByRole('link', { name: 'View payment on XRPL Testnet', exact: true }))
  await measure('payment tx', spend.getByRole('link', { name: 'tx', exact: true }))
  await capture('payments')
  await page.getByRole('button', { name: /Receipt/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Receipt', exact: true })).toBeVisible()
  await measure('ledger anchor', page.locator('.ra-receipt-sheet .ra-caption > a[href*="testnet.xrpl.org/transactions"]'))
  await measure('receipt tx', page.getByRole('dialog', { name: 'Receipt', exact: true }).getByRole('link', { name: 'tx', exact: true }))
  await measure('receipt ledger links', page.locator('.ra-receipt-sheet dl a[href*="testnet.xrpl.org"]'))
  await capture('receipt')
  await page.keyboard.press('Escape')
  if (width === 390) await page.keyboard.press('Escape')
  const showSidebar = page.getByRole('button', { name: 'Show sidebar', exact: true })
  if (await showSidebar.count()) await showSidebar.click()
  await measure('history row', page.locator('.ra-nav-run'))
  await measure('options', page.locator('.ra-nav-more'))
  await measure('new question', page.getByRole('button', { name: 'New question', exact: true }))
  if (width === 390) await measure('Run', page.locator('.ra-mobile-views button').filter({ hasText: /^Run$/ }))
  await capture('sidebar')
  if (!baseline) await page.getByRole('button', { name: 'New question', exact: true }).click()
  if (!baseline && width === 390) {
    await expect(page.locator('.ra-nav-scrim')).toHaveCount(0)
    await expect(page.locator('.ra-qbox')).toBeVisible()
    await page.getByRole('button', { name: 'Show sidebar', exact: true }).click()
    await page.locator('.ra-nav-run').first().click()
    await expect(page.locator('.ra-nav-scrim')).toHaveCount(0)
    await expect(page.locator('.ra-q')).toBeVisible()
  }
  writeFileSync(`${dir}/metrics-${width}.json`, JSON.stringify({ width, sizes, audits, evidence: 'Committed fixture recordings; browser viewport emulation; ledger sockets closed.' }, null, 2))
})

})
