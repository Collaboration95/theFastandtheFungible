import { test, expect, type Page } from '@playwright/test'
import { Store } from '../server/store.js'
import { readFile } from 'node:fs/promises'

// Fixture mode (npm run demo): UC2 and UC3 from the story bible, driven through the browser (#159).
// Demo-question buttons are named by their short label, then the full question (src/components/Ask.tsx PRESET_LABEL).
const ask = async (page: Page, preset: RegExp) => {
  await page.getByRole('button', { name: preset }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
}
const finished = async (page: Page) => {
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
}

test('UC2: clarify chip → plan card → paid purchase with proof ✓ → STRENGTHENS, PDF', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?pace=real')
  await ask(page, /^Kestrel–TSMC outlook/)
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  // The plan card confirms the plan before any spending; it is not a purchase approval.
  await page.getByRole('button', { name: 'Start now' }).click()
  await finished(page)
  await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('1 kept · 0 refunded')
  await expect(page.getByRole('region', { name: /Purchase: NotFinancialTimes/ }).getByText(/Verified/)).toBeVisible()
  await expect(page.locator('.ra-vtext')).toContainText('55.2%')
  await expect(page.getByRole('button', { name: /MarketPulse.*bought/ })).toHaveCount(0)

  const download = page.waitForEvent('download')
  await page.getByText('Export ⋯', { exact: true }).click()
  await page.getByRole('button', { name: 'Download report (PDF)' }).click()
  const file = await (await download).path()
  expect((await readFile(file!)).subarray(0, 5).toString()).toBe('%PDF-')

  // The web server never serves corpus files, paid bodies included (D18: the v2 writer corpus).
  const corpus = await page.request.get('/data/corpus/v2/articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json')
  expect(corpus.status()).toBe(403)
})

test('UC3: AlphaLeak bought → proof fails → refunded → quarantined; The Fab Floor bought', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?pace=real')
  await ask(page, /^Malaysia packaging lead times/)
  await page.getByRole('button', { name: 'Start now' }).click()
  await finished(page)
  const leak = page.getByRole('region', { name: /Purchase: AlphaLeak/ })
  await expect(leak.getByText(/Not found/)).toBeVisible()
  await expect(leak.getByText(/Checked against the writer/)).toBeVisible()
  await expect(leak.getByText(/Refunded S\$0.30/).first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Purchase: The Fab Floor' })).toContainText('Verified')
  await page.getByRole('tab', { name: 'Writers' }).click()
  await expect(page.getByText(/quarantined/i).first()).toBeVisible()
  await page.getByRole('button', { name: 'AlphaLeak' }).click()
  await expect(page.getByText(/Honesty 0\.40/)).toBeVisible()
})

for (const width of [1280, 390]) {
  test(`writer blog pages never scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of ['/w/notfinancialtimes/', '/w/the-fab-floor/blog/fab-floor-kestrel-penang-lead-times']) {
      await page.goto(path)
      await expect(page.getByText(/SYNTHETIC/).first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}

test('a terminal snapshot above the SSE limit recovers the same browser run without another admission (#345)', async ({ page }) => {
  let admissions = 0
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/runs') admissions++
  })
  await page.goto('/?pace=real')
  await ask(page, /^Kestrel–TSMC outlook/)
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  await page.getByRole('button', { name: 'Start now' }).click()
  await finished(page)
  const id = new URL(page.url()).searchParams.get('run')!
  // Make the transport boundary explicit: corpus ranking must not control snapshot size.
  const store = new Store('.playwright/app.db')
  try { store.appendEvent(id, { type: 'COVERAGE', label: 'Oversized fixture recovery probe', data: { padding: 'fixture-only '.repeat(24000) } }) }
  finally { store.close() }
  const response = await page.request.get('/runs/' + encodeURIComponent(id))
  const bytes = await response.body()
  expect(bytes.byteLength).toBeGreaterThan(256 * 1024)
  const terminal = JSON.parse(bytes.toString())
  expect(terminal.phase).toBe('DONE')
  await page.reload()
  await finished(page)
  expect(new URL(page.url()).searchParams.get('run')).toBe(id)
  expect(admissions).toBe(1)
  const again = await (await page.request.get('/runs/' + encodeURIComponent(id))).json()
  expect(again.receipts).toEqual(terminal.receipts)
  expect(again.spentMinor).toBe(terminal.spentMinor)
  await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('1 kept · 0 refunded')
})

test('migrates stored stage pace, shows terminal purchases immediately and clears reconnect errors', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const full = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  await page.addInitScript(() => { localStorage.setItem('researchagent.pace','stage'); localStorage.setItem('researchagent.environment-seen','1') })
  await page.route('**/runs/fixture-uc2', route => route.fulfill({json:full}))
  await page.addInitScript(snapshot => {
    window.EventSource = class extends EventTarget {
      constructor() {
        super()
        setTimeout(() => this.dispatchEvent(new MessageEvent('snapshot',{data:'invalid'})),500)
        setTimeout(() => this.dispatchEvent(new MessageEvent('snapshot',{data:JSON.stringify(snapshot)})),1500)
      }
      close() {}
    } as unknown as typeof EventSource
  }, full)
  await page.goto('/?run=fixture-uc2')
  await expect(page.getByRole('region',{name:'Sources',exact:true})).toContainText('1 kept · 0 refunded')
  await expect(page.getByRole('button',{name:/Stop buying/})).toHaveCount(0)
  expect(await page.evaluate(()=>localStorage.getItem('researchagent.pace'))).toBe('real')
  await expect(page.getByText('Connection lost. Reconnecting…')).toBeVisible()
  await expect(page.getByText('Connection lost. Reconnecting…')).toHaveCount(0)
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('button', {name:/Stop buying/})).toHaveCount(0)
})

test('keyboard plan cancellation admits zero runs; Go now admits exactly once', async ({ page }) => {
  let admissions = 0
  page.on('request', r => { if (r.method()==='POST' && new URL(r.url()).pathname==='/runs') admissions++ })
  await page.goto('/')
  await ask(page, /^Kestrel–TSMC outlook/)
  await page.getByRole('button',{name:'pricing & margins'}).click()
  await expect(page.getByRole('dialog',{name:'Search plan'})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog',{name:'Search plan'})).toHaveCount(0)
  expect(admissions).toBe(0)
  await page.goto('/')
  await ask(page, /^Kestrel–TSMC outlook/)
  await page.getByRole('button',{name:'pricing & margins'}).click()
  await page.getByRole('button',{name:'Start now'}).click()
  await finished(page)
  expect(admissions).toBe(1)
})
