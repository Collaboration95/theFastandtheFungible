// Proof of refusal (lane W1) in hosted mode: run with `npx playwright test --config tests/playwright/hosted.config.ts`.
// Fixture models and the simulated rail, so the anchor is a test stand-in: the stack promotes one finished decline to
// "anchored" with a synthetic transaction, and the page's read-only Testnet lookups are answered by the same stand-in.
// UPDATE_EVIDENCE=1 refreshes docs/evidence/w1-proof/hosted-*.png (1440 and 390 px).
import { test, expect, type Browser, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { evidencePath } from './evidence-path'

const QUESTION = 'Which Singapore banks are piloting RLUSD settlement in 2026?'
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: evidencePath(`w1-proof/${name}.png`), fullPage })
const visitor = async (browser: Browser, width = 1440, height = 900) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } })
  return { context, page: await context.newPage() }
}
/** Answers the page's `tx` lookups the way a Testnet node would for the stand-in anchor. */
const stubLedger = (page: Page) => page.routeWebSocket(/s\.altnet\.rippletest\.net/, ws => ws.onMessage(async message => {
  const request = JSON.parse(String(message)) as { id: number; transaction: string }
  const response = await page.request.get(`/__test/tx/${request.transaction}`)
  ws.send(JSON.stringify(response.ok() ? { id: request.id, status: 'success', type: 'response', result: await response.json() } : { id: request.id, status: 'error', error: 'txnNotFound' }))
}))
test.skip(Date.now() >= Date.parse('2026-11-19T16:00:00Z'), 'The hosted demo’s admission window has closed.')

test('a visitor shares a refusal; anyone can open and check it; nobody else’s data is in it', async ({ browser }) => {
  const a = await visitor(browser), page = a.page
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Your question' }).fill(QUESTION)
  await page.getByRole('button', { name: /^Ask/ }).click()
  const chip = page.getByRole('button', { name: 'pricing & margins' }), start = page.getByRole('button', { name: 'Start now' })
  await expect(chip.or(start).first()).toBeVisible({ timeout: 30000 })
  if (await chip.isVisible()) await chip.click()
  await start.click()
  const answer = page.getByRole('region', { name: 'Research answer' })
  await expect(answer).toContainText('Nothing was bought', { timeout: 60000 })
  const runId = new URL(page.url()).searchParams.get('run')!
  // Not anchored (the simulated rail leaves nothing on a ledger): it says why, and offers no share.
  await expect(answer).toContainText('nothing to prove')
  await expect(page.getByRole('button', { name: 'Share proof of refusal' })).toHaveCount(0)
  // Promote it to anchored (test stand-in), then the same screen offers the share.
  expect((await page.request.post(`/__test/anchor/${runId}`)).ok()).toBe(true)
  await page.reload()
  const share = page.getByRole('button', { name: 'Share proof of refusal' })
  await expect(share).toBeVisible({ timeout: 15000 })
  expect(await serious(page)).toEqual([])
  await shot(page, 'hosted-app-decline-1440')
  // Sharing is explicit, and says the question becomes public.
  await share.click()
  const confirm = page.getByRole('heading', { name: 'Publish this proof?' })
  await expect(confirm).toBeFocused()
  await expect(page.locator('.ra-share-confirm')).toContainText('anyone with the link')
  await expect(page.locator('.ra-share-confirm')).toContainText(QUESTION)
  expect((await page.request.get(`/api/runs/${runId}/proof`)).status()).toBe(200)
  expect((await (await page.request.get(`/api/runs/${runId}/proof`)).json()).proof).toBeUndefined() // nothing published yet
  await shot(page, 'hosted-app-share-confirm-1440')
  await page.getByRole('button', { name: 'Publish proof page' }).click()
  await expect(page.getByText('Proof page ready')).toBeVisible()
  await shot(page, 'hosted-app-share-done-1440')
  const href = (await page.getByRole('link', { name: 'Open proof page' }).getAttribute('href'))!
  expect(href).toMatch(/^\/proof\/[a-f0-9]{32}$/)

  // Anyone, with no session: the page, its preview metadata, the receipts, the card.
  const anon = await visitor(browser), proof = anon.page
  await stubLedger(proof)
  proof.on('console', m => { if (m.type() === 'error') console.log('PROOF PAGE CONSOLE', m.text()) })
  const response = await proof.goto(href)
  expect(response!.status()).toBe(200)
  expect(await anon.context.cookies()).toEqual([]) // reading a public proof mints no session
  await expect(proof.getByRole('heading', { level: 1, name: 'Refused to spend.' })).toBeVisible()
  await expect(proof.locator('blockquote')).toHaveText(QUESTION)
  await expect(proof.locator('.stats')).toContainText('S$0.00')
  await expect(proof.locator('.stats')).toContainText('Paid articles found')
  await expect(proof.getByRole('link', { name: /XRPL Testnet transaction/ })).toHaveAttribute('href', /^https:\/\/testnet\.xrpl\.org\/transactions\/[A-F0-9]{64}$/)
  await expect(proof.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Refused to spend · verified on XRPL')
  await expect(proof.locator('meta[property="og:description"]')).toHaveAttribute('content', /Which Singapore banks.*none bought\. S\$0\.00 spent\./)
  await expect(proof.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/refusal-proof\.png$/)
  const og = await proof.request.get('/og/refusal-proof.png')
  expect(og.status()).toBe(200); expect(og.headers()['content-type']).toBe('image/png')
  await proof.evaluate(() => document.fonts.ready)
  expect(await proof.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))).toContain('Geist Variable')
  expect(await proof.locator('#verify').evaluate(el => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.fontWeight] })).toEqual(['"Geist Variable", sans-serif', '13px', '600'])
  expect(await proof.locator('.eyebrow, .label').evaluateAll(elements => elements.map(el => getComputedStyle(el).textTransform))).not.toContain('uppercase')
  expect(await serious(proof)).toEqual([])
  await shot(proof, 'hosted-proof-1440')
  // One count: the total before the browser check is the total after it, and what the browser skips is named.
  const shared = (await proof.locator('.facts').innerText()).match(/(\d+) passed · (\d+) not checked/)!, total = String(Number(shared[1]) + Number(shared[2]))
  await expect(proof.locator('.chip .full')).toBeVisible(); await expect(proof.locator('.chip .short')).toBeHidden()
  await proof.getByRole('button', { name: 'Verify on XRPL in your browser' }).click()
  await expect(proof.locator('#vout .vhead')).toHaveText(new RegExp(`^(?:All ${total} checks passed|\\d+ passed · \\d+ not checked)$`), { timeout: 30000 })
  await expect(proof.locator('#vout .note')).toContainText('Skipped here: writer credentials')
  await expect(proof.locator('#vout')).toContainText('Answer anchored on XRPL Testnet')
  await expect(proof.locator('#vout')).toContainText('reading s.altnet.rippletest.net (read-only)')
  expect(await anon.context.cookies()).toEqual([])
  await proof.locator('#vout').scrollIntoViewIfNeeded()
  await shot(proof, 'hosted-proof-verified-1440')
  await proof.setViewportSize({ width: 1280, height: 900 })
  expect(await serious(proof)).toEqual([])
  // The card is a self-contained download: no scripts, no network.
  const [download] = await Promise.all([proof.waitForEvent('download'), proof.getByRole('link', { name: 'Download proof card' }).click()])
  expect(download.suggestedFilename()).toMatch(/^proof-of-refusal-[a-f0-9]{8}\.html$/)
  const card = await (await proof.request.get(`${href}/card.html`)).text()
  expect(card).not.toContain('<script'); expect(card).toContain(QUESTION)

  // The same page on a phone: nothing overflows, and the check still runs.
  const phone = await visitor(browser, 390, 844)
  await stubLedger(phone.page)
  await phone.page.emulateMedia({ reducedMotion: 'reduce' })
  await phone.page.goto(href)
  await expect(phone.page.getByRole('heading', { level: 1, name: 'Refused to spend.' })).toBeVisible()
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // The environment chip stays on a phone, in its short form, inside the header.
  await expect(phone.page.locator('.chip .short')).toHaveText('Testnet demo · no real value'); await expect(phone.page.locator('.chip .full')).toBeHidden()
  const box = (await phone.page.locator('.chip').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390); expect(box.y + box.height).toBeLessThanOrEqual(60)
  expect(await serious(phone.page)).toEqual([])
  await shot(phone.page, 'hosted-proof-390')
  await phone.page.getByRole('button', { name: 'Verify on XRPL in your browser' }).click()
  await expect(phone.page.locator('#vout .vhead')).toHaveText(new RegExp(`^(?:All ${total} checks passed|\\d+ passed · \\d+ not checked)$`), { timeout: 30000 })
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await shot(phone.page, 'hosted-proof-verified-390')

  // A different visitor can read the public link, but nothing else of A's.
  const b = await visitor(browser)
  expect((await b.page.goto(href))!.status()).toBe(200)
  expect((await b.page.request.get(`/api/runs/${runId}/proof`)).status()).toBe(404)
  expect((await b.page.request.post(`/api/runs/${runId}/proof`)).status()).toBe(403)
  expect((await b.page.request.get(`${href}?x=1`)).status()).toBe(404)
  expect(await b.page.content()).not.toMatch(/csrf|__Host-ra_session/i)
  expect(errors).toEqual([])
  await Promise.all([a.context.close(), anon.context.close(), phone.context.close(), b.context.close()])
})

test('an unknown or expired proof says so, in the same design, with no horizontal scroll at 390 px', async ({ browser }) => {
  const { context, page } = await visitor(browser, 390, 844)
  const missing = await page.goto(`/proof/${'0'.repeat(32)}`)
  expect(missing!.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'This proof isn’t here.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await context.close()
})
