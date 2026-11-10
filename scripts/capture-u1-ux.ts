// Walks the fixture app as a first-time judge and captures every screen at three viewports.
// Usage: tsx scripts/capture-u1-ux.ts <base-url> <out-dir>
// Offline only: run against `npm run demo` in fixture mode (simulated payments, no keys).
import { chromium, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { DEMO_QUESTIONS } from '../shared/contracts/examples'

const [base = 'http://127.0.0.1:5173', out = '.playwright/u1/shots', replay = ''] = process.argv.slice(2)
const VIEWPORTS = [{ name: '1280x800', width: 1280, height: 800 }, { name: '1440x900', width: 1440, height: 900 }, { name: '390x844', width: 390, height: 844 }]
const DECLINE = 'Which Singapore banks are piloting RLUSD settlement in 2026?'

async function shot(page: Page, dir: string, name: string, step: () => Promise<void>) {
  try { await step(); await page.screenshot({ path: `${dir}/${name}.jpg`, quality: 72 }); console.log('ok', dir, name) }
  catch (error) { console.log('MISS', dir, name, String(error).split('\n')[0]) }
}
const fresh = async (page: Page, url = '/') => { await page.goto(base + url); await page.waitForLoadState('networkidle') }
const dismiss = async (page: Page) => { const got = page.getByRole('button', { name: 'Got it' }); if (await got.isVisible().catch(() => false)) await got.click() }
async function ask(page: Page, question: string, clarify?: string) {
  await dismiss(page)
  await page.getByRole('textbox', { name: 'Your question' }).fill(question)
  await page.getByRole('button', { name: /^Ask/ }).click()
  if (clarify) await page.getByRole('button', { name: clarify }).click({ timeout: 8000 }).catch(() => {})
  await page.getByRole('button', { name: 'Start now' }).click({ timeout: 8000 }).catch(() => {})
}
const showNav = async (page: Page) => { const b = page.getByRole('button', { name: 'Show sidebar' }); if (await b.isVisible().catch(() => false)) await b.click() }

const browser = await chromium.launch()
for (const vp of VIEWPORTS) {
  const dir = `${out}/${vp.name}`
  await mkdir(dir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await shot(page, dir, '01-first-screen', async () => { await fresh(page); await page.getByRole('region', { name: "What's real here" }).waitFor({ timeout: 5000 }) })
  await shot(page, dir, '02-home', async () => { await dismiss(page); await page.mouse.move(0, 0) })
  await shot(page, dir, '03-asking', async () => {
    await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
    await page.getByRole('button', { name: /^Ask/ }).click()
    await page.getByRole('button', { name: 'pricing & margins' }).waitFor({ timeout: 8000 })
  })
  await shot(page, dir, '04-plan', async () => { await page.getByRole('button', { name: 'pricing & margins' }).click(); await page.getByRole('button', { name: 'Start now' }).waitFor() })
  await shot(page, dir, '05a-live-search', async () => { await page.getByRole('button', { name: 'Start now' }).click(); await page.getByText(/Searching free sources|Choosing an article/).first().waitFor({ timeout: 20000 }) })
  await shot(page, dir, '05-live-run', async () => { await page.getByText(/Paying the writer|Checking the article|Updating the answer/).first().waitFor({ timeout: 60000 }) })
  await shot(page, dir, '06-answer', async () => { await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 60000 }) })
  await shot(page, dir, '06b-answer-scrolled', async () => { await page.locator('.ra-claims').scrollIntoViewIfNeeded() })
  await shot(page, dir, '07-export', async () => { await page.evaluate(() => scrollTo(0, 0)); const e = page.getByText('Export', { exact: true }); await e.scrollIntoViewIfNeeded(); await e.click() })
  await shot(page, dir, '08-receipt', async () => { await page.keyboard.press('Escape'); await page.getByText('Export', { exact: true }).click().catch(() => {}); const r = page.getByRole('button', { name: 'Receipt ›' }).first(); if (!await r.isVisible()) await page.locator('.ra-mobile-spend > button').click(); await page.getByRole('button', { name: 'Receipt ›' }).first().click(); await page.getByRole('dialog').waitFor() })
  await page.keyboard.press('Escape')
  // Refund path (UC3): the payment card walks pay → check → refund.
  await shot(page, dir, '09-refund-run', async () => { await fresh(page); await page.getByRole('button', { name: /^Malaysia packaging lead times/ }).click(); await ask(page, DEMO_QUESTIONS[2].text); await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 60000 }) })
  await shot(page, dir, '10-declined', async () => { await fresh(page); await ask(page, DECLINE); await page.waitForFunction(() => /Answer ready|Done|nothing bought/i.test(document.title + document.body.innerText.slice(0, 4000)) && !!document.querySelector('.ra-verdict') && !document.querySelector('.ra-verdict[aria-busy="true"]'), null, { timeout: 60000 }) })
  await shot(page, dir, '10b-declined-why', async () => { const why = page.getByText('Why nothing was bought'); await why.click({ timeout: 3000 }) })
  await shot(page, dir, '11-writers', async () => { await fresh(page); await dismiss(page); await showNav(page); const tab = page.getByRole('navigation', { name: 'Workspace views' }).getByRole('button', { name: /^Writers/ }); if (await tab.isVisible()) await tab.click(); else await page.getByRole('button', { name: 'Writers', exact: true }).first().click(); await page.waitForTimeout(600) })
  await shot(page, dir, '12-settings', async () => { await fresh(page, '/?settings=1'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor(); await page.waitForTimeout(400) })
  await shot(page, dir, '13-onboarding', async () => { await fresh(page, '/?onboarding=1'); await page.getByText('Make this workspace yours').waitFor(); await page.waitForTimeout(400) })
  // Recorded XRPL Testnet key-reveal run (browser replay build): escrow → key → anchor on the payment card.
  if (replay) {
    await shot(page, dir, '15-testnet-key-reveal-done', async () => { await page.goto(replay); await page.waitForFunction(() => /Answer ready/.test(document.title), null, { timeout: 150000 }); await page.waitForTimeout(800) })
  }
  await context.close()
}
await browser.close()
