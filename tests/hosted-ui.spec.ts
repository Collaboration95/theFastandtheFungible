// Hosted judge UI (lane HU), in hosted mode: run with `npx playwright test --config tests/playwright/hosted.config.ts`.
// Fixture models, the simulated rail and a local HTTPS origin (tests/helpers/hosted-stack.ts). UPDATE_EVIDENCE=1
// refreshes docs/evidence/hosted-ui/ screenshots at 1440 and 390 px.
import { test, expect, type Browser, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evidencePath } from './evidence-path'

const stack = process.env.HOSTED_STACK_DIR!
const control = (patch: Record<string, unknown>) => writeFileSync(join(stack, 'control.json'), JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'hosted_ui_test', expiresAt: '2026-11-19T16:00:00Z', ...patch }))
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: evidencePath(`hosted-ui/${name}.png`), fullPage })
const visitor = async (browser: Browser, width = 1440, height = 900) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } })
  return { context, page: await context.newPage() }
}
/** Rewrites what the gateway reports, to show a state the local stack can't reach on its own. */
const statusAs = (page: Page, patch: (status: Record<string, unknown>) => Record<string, unknown>) => page.route('**/api/demo/status', async route => {
  const response = await route.fetch()
  await route.fulfill({ response, json: patch(await response.json()) })
})
const question = (page: Page) => page.getByRole('textbox', { name: 'Your question' })
/** The sidebar rests as a rail on the run screen and on phones. */
const openNav = async (page: Page) => {
  await expect(page.getByRole('button', { name: /^(?:Show|Hide) sidebar$/ })).toBeVisible()
  const show = page.getByRole('button', { name: 'Show sidebar' })
  if (await show.count()) await show.click()
  return page.getByRole('navigation', { name: 'Questions' })
}
const admissionsOpen = Date.now() < Date.parse('2026-11-19T16:00:00Z')
// The gateway refuses hosted mode past its admission window (20 Nov 00:00 SGT): the live demo has ended, so nothing here can run.
test.skip(!admissionsOpen, 'The hosted demo’s admission window has closed.')

test.afterEach(() => { control({}); rmSync(join(stack, 'degraded'), { force: true }) })

test('first visit: orientation, the visitor’s own question first, one environment indicator, no owner controls', async ({ browser }) => {
  const { context, page } = await visitor(browser)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/?settings=1&record=1')
  await expect(page.getByRole('heading', { level: 1, name: 'Research with a wallet.' })).toBeVisible()
  await expect(page).toHaveURL(url => !url.searchParams.has('record'))
  await expect(page.locator('html')).not.toHaveAttribute('data-record', /.*/)
  // Ask is the first thing to use: nothing modal, nothing floating over it.
  await expect(question(page)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'How it works' }).getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('group', { name: 'Demo questions' }).getByRole('button')).toHaveCount(3)
  await expect(page.getByText('5 of 5 questions left today · test funds only')).toBeVisible()
  await expect(page.getByText('Don’t enter personal or confidential information.', { exact: false })).toBeVisible()
  // Budget control: hosted questions hold at most S$2.00 of test funds.
  await page.locator('.ra-budget-chip').click()
  const budget = page.getByRole('dialog', { name: 'Budget' })
  await expect(budget.getByRole('group', { name: 'Budget choices' }).getByRole('button')).toHaveText(['Free', 'S$0.5', 'S$1', 'S$2'])
  await expect(budget.getByRole('spinbutton', { name: 'Custom budget (S$)' })).toHaveAttribute('max', '2')
  await page.keyboard.press('Escape')
  // One environment indicator; details on demand, and nothing else says SIMULATED on Home.
  const pill = page.getByRole('button', { name: 'Shared demo · simulated payments · fixture models · no real value' })
  await expect(pill).toBeVisible()
  await expect(page.locator('main')).not.toContainText('SIMULATED')
  await pill.click()
  const about = page.getByRole('region', { name: 'About this demo' })
  await expect(about).toContainText('24 hours')
  await expect(about).toContainText('20 November, 00:00 SGT')
  await page.keyboard.press('Escape')
  await expect(about).toBeHidden()
  await expect(pill).toBeFocused()
  // Owner and developer controls are absent, not just disabled.
  await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0)
  await expect(page.getByText('Connect your agent')).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+,')
  await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await expect(palette.getByRole('combobox')).toBeVisible()
  for (const hidden of [/Record/i, /Presenter/i, /Settings/i, /Connect/i]) await expect(palette.getByRole('option', { name: hidden })).toHaveCount(0)
  await page.keyboard.press('Escape')
  // Footer links open the public pages.
  const links = page.getByRole('navigation', { name: 'Project links' })
  for (const name of ['Source code', 'Pitch deck', 'Progress since SingHacks', 'Recorded walkthrough: writer no-show and refund', 'How to verify a receipt']) await expect(links.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', /^https:\/\//)
  await expect(links.getByRole('link', { name: /Demo video/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Questions' })).toContainText('Your questions appear here.')
  expect(await serious(page)).toEqual([])
  await shot(page, 'home-1440')
  // Keyboard: the composer is reachable and the examples fill it.
  await question(page).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(question(page)).toBeFocused()
  expect(errors).toEqual([])
  await context.close()
})

test('390 px: orientation, composer and examples fit with no horizontal scroll', async ({ browser }) => {
  const { context, page } = await visitor(browser, 390, 844)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(question(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const box = await question(page).boundingBox()
  expect(box!.y + box!.height).toBeLessThan(844 * 1.6) // within the first screen and a half on a phone
  expect(await serious(page)).toEqual([])
  await shot(page, 'home-390', true)
  await context.close()
})

test('a visitor asks, gets a verified answer and checks it in the browser; another visitor sees none of it', async ({ browser }) => {
  const a = await visitor(browser)
  const page = a.page
  await page.goto('/')
  // The example that buys: one escrowed article, so there are receipts to verify.
  await page.getByRole('group', { name: 'Demo questions' }).getByRole('button', { name: /^Kestrel–TSMC/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  const chip = page.getByRole('button', { name: 'pricing & margins' })
  const start = page.getByRole('button', { name: 'Start now' })
  await expect(chip.or(start).first()).toBeVisible({ timeout: 30000 })
  if (await chip.isVisible()) await chip.click()
  await expect(start).toBeVisible({ timeout: 30000 })
  // Hosted re-plans on the server, so the plan offers no Edit there.
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await start.click()
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60000 })
  const runUrl = page.url()
  // Receipts and their marker stay labelled; the shared-demo footer is gone from the run screen.
  const verify = page.getByRole('region', { name: 'Verify in your browser' })
  await expect(verify).toBeVisible()
  await verify.getByRole('button', { name: 'Run the checks' }).click()
  await expect(verify.getByRole('status')).toContainText(/All \d+ checks passed|\d+ passed · \d+ not checked/, { timeout: 30000 })
  await expect(verify).toContainText('ledger checks skipped: simulated payments')
  await expect(verify).toContainText('Writer signatures')
  await expect(page.getByRole('button', { name: /PDF/ })).toHaveCount(0)
  expect(await serious(page)).toEqual([])
  await expect(verify).not.toContainText('XRPL Testnet') // simulated payments never claim a ledger
  await verify.scrollIntoViewIfNeeded()
  await shot(page, 'run-verified-1440')
  const nav = await openNav(page)
  await expect(nav.getByRole('button', { name: /^Run: / })).toHaveCount(1)

  // A second browser is a different visitor: no shared sidebar, and A's run link opens nothing.
  const b = await visitor(browser, 390, 844)
  await b.page.goto('/')
  await expect(await openNav(b.page)).toContainText('Your questions appear here.')
  await expect(b.page.getByRole('navigation', { name: 'Questions' }).getByRole('button', { name: /^Run: / })).toHaveCount(0)
  await b.page.goto(runUrl)
  await expect(b.page.getByText('That question isn’t available here.', { exact: false })).toBeVisible()
  // The public recorded run is available to everyone; A's private run verifier is not.
  await expect(b.page.getByRole('region', { name: 'Verify in your browser', exact: true })).toHaveCount(0)
  await expect(b.page.getByRole('region', { name: 'Check our work without asking a question', exact: true })).toBeVisible()
  await b.context.close()

  // The visitor's own allowance went down by one; Clear my history hides the finished run.
  await page.goto('/')
  await expect(page.getByText('4 of 5 questions left today', { exact: false })).toBeVisible()
  await openNav(page)
  await nav.getByRole('button', { name: 'Clear my history' }).click()
  await nav.getByRole('group', { name: 'Clear my history' }).getByRole('button', { name: 'Clear' }).click()
  await expect(nav.getByRole('button', { name: /^Run: / })).toHaveCount(0)
  await expect(nav).toContainText('Your questions appear here.')
  await a.context.close()
})

test('paused, ended, used-up, on-hold and offline each say what happened and what still works', async ({ browser }) => {
  const { context, page } = await visitor(browser)
  // Paused: the operator's control file, read on every request.
  control({ admissionsPaused: true, spendingPaused: true })
  await page.goto('/')
  const card = page.locator('.ra-hstate')
  await expect(card).toContainText('The shared Testnet demo is paused. No new purchases will start. You can still view your receipts or watch the recorded walkthrough.')
  // A demo that cannot take a question shows the state card and its links, with no composer or examples to tempt a click.
  await expect(page.getByRole('button', { name: /^Ask/ })).toHaveCount(0)
  await expect(question(page)).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Demo questions' })).toHaveCount(0)
  await expect(card.getByRole('link', { name: /Watch the recorded walkthrough/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /paused/ })).toBeVisible()
  await shot(page, 'paused-1440')
  control({})
  // Recovers on its own once the control file is back to ready.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(card).toHaveCount(0, { timeout: 20000 })

  // A provider or the ledger isn't responding: the gateway reports degraded.
  writeFileSync(join(stack, 'degraded'), '')
  await page.reload()
  await expect(card).toContainText('New questions are on hold')
  rmSync(join(stack, 'degraded'), { force: true })

  // Offline in the browser: nothing generic.
  await page.reload()
  await expect(question(page)).toBeVisible()
  await context.setOffline(true)
  await expect(card).toContainText('You’re offline')
  await expect(page.locator('body')).not.toContainText('Can’t reach the server')
  await expect(page.locator('body')).not.toContainText(/Can[’']t reach the ResearchAgent server/)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(card).toHaveCount(0, { timeout: 20000 })

  // The server stops answering after the page loaded.
  await page.route('**/api/demo/status', route => route.abort('connectionrefused'))
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(card).toContainText('The demo server isn’t responding')
  await page.unroute('**/api/demo/status')

  // Used-up allowance and the end of the event come from the status the gateway reports.
  await statusAs(page, status => ({ ...status, state: 'degraded', remaining: { questions: 0, minor: 0 }, capabilities: { ...(status.capabilities as object), ask: false, scope: false } }))
  await page.reload()
  await expect(card).toContainText('You’ve used today’s questions')
  await expect(card).toContainText('08:00 SGT')
  await page.unroute('**/api/demo/status')
  await statusAs(page, status => ({ ...status, state: 'ended', capabilities: { ...(status.capabilities as object), ask: false, scope: false } }))
  await page.reload()
  await expect(card).toContainText('New questions closed on 20 November, 00:00 SGT.')
  await expect(page.getByRole('button', { name: /ended/ })).toBeVisible()
  expect(await serious(page)).toEqual([])
  await context.close()
})

test('a busy shared demo queues the question with a cancel, and reduced motion stops the spinner', async ({ browser }) => {
  const { context, page } = await visitor(browser, 390, 844)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/scope', route => route.request().method() === 'POST' ? route.fulfill({ status: 429, json: { error: 'busy' } }) : route.continue())
  await page.goto('/')
  await question(page).fill('How does XRPL escrow release funds?')
  await page.getByRole('button', { name: /^Ask/ }).click()
  const waiting = page.getByRole('status', { name: 'Waiting for a turn' })
  await expect(waiting).toContainText('Waiting for a turn on the shared demo')
  await expect(waiting).toContainText(/nothing is reserved or spent until then/i)
  expect(await waiting.locator('.ra-spin').evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  expect(await serious(page)).toEqual([])
  await shot(page, 'waiting-390', true)
  await waiting.getByRole('button', { name: 'Cancel' }).click()
  await expect(waiting).toHaveCount(0)
  await expect(question(page)).toHaveValue('How does XRPL escrow release funds?')
  await context.close()
})

test('hosted writers have public pages, honest earnings and narrow reads in two contexts', async ({ browser }) => {
  const a = await visitor(browser), b = await visitor(browser, 390, 844)
  for (const [index, v] of [a, b].entries()) {
    await v.page.goto('/')
    if (index) { await openNav(v.page); await v.page.getByRole('button', { name: 'Writers', exact: true }).click() }
    else await v.page.getByRole('navigation', { name: 'Workspace views' }).getByRole('button', { name: /^Writers/ }).click()
    const catalogue = v.page.locator('.ra-writer-earnings')
    // One badge per card (S9): the kind and the identity check in one phrase, not two lines.
    await expect(catalogue.getByText('Team-authored · unverified', { exact: true }).first()).toBeVisible()
    await expect(catalogue.getByText('unverified writer')).toHaveCount(0)
    await expect(catalogue).toContainText('Your retained history only')
    await expect(catalogue.getByRole('link', { name: 'Publish your notes ↗' })).toHaveAttribute('href', /docs\/publishing.md$/)
    await expect(catalogue).not.toContainText('real independent writers')
    expect(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await v.page.screenshot({ path: evidencePath(`writers-nov11/writers-${index ? 390 : 1440}.png`), fullPage: true })
    const link = catalogue.locator('.ra-writer-card').filter({hasText:'Team-authored'}).locator('h2 a').first()
    const path = await link.getAttribute('href')
    const response = await v.context.request.get(path!)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('TEAM-AUTHORED')
    expect((await v.context.request.get(path! + '/.well-known/agent-publisher.json')).status()).toBe(200)
    for (const suffix of ['/search', '/articles/private', '/facilitator/supported', '/__faults']) expect((await v.context.request.get(path! + suffix)).status()).toBe(404)
    const articles = catalogue.locator('details').first()
    await articles.locator('summary').click()
    const article = await articles.locator('a').first().getAttribute('href')
    expect((await v.context.request.get(article!)).status()).toBe(200)
    await v.context.close()
  }
})

test('hosted budgets render a smaller server-authoritative question cap', async ({ browser }) => {
  const { context, page } = await visitor(browser)
  await statusAs(page, status => ({ ...status, questionCapMinor: 100 }))
  await page.goto('/')
  await expect(page.getByText('Up to S$1.00 in test funds')).toBeVisible()
  await expect(page.locator('.ra-budget-chip')).toContainText('1.00')
  await page.locator('.ra-budget-chip').click()
  const slider = page.getByRole('dialog', { name: 'Budget' }).getByRole('spinbutton')
  await expect(slider).toHaveAttribute('max', '1')
  await context.close()
})

// A11Y sprint: local HOSTED=1 only. No live hosted questions.
for (const delay of [6000, 12000]) test(`A11Y status delayed ${delay} ms keeps the connecting shell and the first request`, async ({ browser }) => {
  const { context, page } = await visitor(browser, 390, 844)
  let calls = 0, failed = 0, landed = 0
  page.on('requestfailed', request => { if (request.url().endsWith('/api/demo/status')) failed++ })
  await page.route('**/api/demo/status', async route => {
    calls++
    const response = await route.fetch()
    await new Promise(resolve => setTimeout(resolve, delay))
    landed = Date.now()
    await route.fulfill({ response })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Connecting to the demo…' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Watch the recorded walkthrough' })).toBeVisible()
  await expect(question(page)).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0)
  expect(await serious(page)).toEqual([])
  await expect(page.getByRole('status')).toContainText('Your network is slow; still trying.', { timeout: 7000 })
  await expect(question(page)).toBeVisible({ timeout: 16000 })
  const renderMs = Date.now() - landed
  expect(renderMs).toBeLessThan(1000)
  await test.info().attach('status-timing', { body: JSON.stringify({ delayMs: delay, hostedRenderMs: renderMs, statusCalls: calls, failedRequests: failed }), contentType: 'application/json' })
  expect(calls).toBe(1); expect(failed).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await context.close()
})

test('A11Y keyboard Ask → plan → result → verify, idle prefetch, offline recovery and phone targets', async ({ browser }) => {
  const { context, page } = await visitor(browser, 390, 844)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const verifierLoads: string[] = [], verifierTitles: string[] = []
  page.on('request', request => { if (/\/assets\/browser-[^/]+\.js$/.test(request.url())) { verifierLoads.push(request.url()); void page.title().then(title => verifierTitles.push(title)) } })
  await page.goto('/')
  await expect(question(page)).toBeVisible()
  // Test actual hit areas, including transparent pseudo-elements, rather than only visual boxes.
  const smallTargets = async () => page.locator('button, summary, a').evaluateAll(nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
    if (!rect.width || !rect.height || style.visibility === 'hidden' || (node as HTMLButtonElement).disabled) return false
    const after = getComputedStyle(node, '::after')
    return Math.max(rect.height, after.content !== 'none' ? parseFloat(after.height) || 0 : 0) < 44 || Math.max(rect.width, after.content !== 'none' ? parseFloat(after.width) || 0 : 0) < 44
  }).map(node => `${node.tagName}: ${node.textContent?.trim().slice(0, 60)}`))
  expect(await smallTargets()).toEqual([])
  await page.getByRole('group', { name: 'Demo questions' }).getByRole('button', { name: /^Kestrel–TSMC/ }).click()
  let releaseScope!: () => void, releaseStart!: () => void
  const scopeHeld = new Promise<void>(resolve => { releaseScope = resolve }), startHeld = new Promise<void>(resolve => { releaseStart = resolve })
  await page.route('**/api/scope', async route => { const response = await route.fetch(); await scopeHeld; await route.fulfill({ response }) })
  await page.route('**/runs', async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); await startHeld; await route.fulfill({ response }) })
  await page.getByRole('button', { name: /^Ask/ }).focus(); await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused(); releaseScope()
  const chip = page.getByRole('button', { name: 'pricing & margins' }), start = page.getByRole('button', { name: 'Start now' })
  await expect(chip.or(start).first()).toBeVisible({ timeout: 30000 })
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
  if (await chip.isVisible()) { await expect(page.locator('.ra-chip-opt').first()).toBeFocused(); await chip.focus(); await page.keyboard.press('Enter') }
  await expect(start).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Search plan' })).toContainText('Planning uses one of your daily questions')
  expect(verifierLoads).toEqual([]) // No verifier request during home, clarify or plan.
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused(); releaseStart()
  const title = page.locator('h1.ra-q')
  await expect(title).toBeFocused({ timeout: 30000 })
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Show work', exact: true })).toBeFocused()
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60000 })
  await expect.poll(() => verifierLoads.length).toBe(1)
  await expect.poll(() => verifierTitles.length).toBe(1)
  expect(verifierTitles[0]).toMatch(/Answer ready/)
  expect(await smallTargets()).toEqual([])
  expect(await serious(page)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const verify = page.getByRole('region', { name: 'Verify in your browser' })
  await context.setOffline(true)
  await expect(page.locator('.ra-banner')).toContainText("You're offline. This result is final")
  await verify.getByRole('button', { name: 'Run the checks' }).focus(); await page.keyboard.press('Enter')
  await expect(verify.getByRole('alert')).toContainText("You're offline: the checker couldn't load")
  await expect(verify.locator('.is-ok')).toHaveCount(0)
  await expect(verify.getByRole('button', { name: 'Try again' })).toBeFocused()
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
  await context.setOffline(false)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 })
  await page.evaluate(() => {
    const verify = document.querySelector('.ra-hv')!
    const begin = () => {
      const at = performance.now()
      new MutationObserver((_, observer) => { if (verify.querySelector('[role=status]')) { (window as unknown as { verifyProgressMs: number }).verifyProgressMs = performance.now() - at; observer.disconnect() } }).observe(verify, { childList: true, subtree: true })
    }
    verify.querySelector('button')!.addEventListener('click', begin, { once: true })
  })
  await verify.getByRole('button', { name: 'Try again' }).focus(); await page.keyboard.press('Enter')
  await expect(verify.getByRole('status')).toContainText(/passed/, { timeout: 30000 })
  await expect(verify.locator('.ra-hv-head')).toBeFocused()
  const firstProgressMs = await page.evaluate(() => (window as unknown as { verifyProgressMs: number }).verifyProgressMs)
  expect(firstProgressMs).toBeLessThan(300)
  await test.info().attach('verification-timing', { body: JSON.stringify({ firstProgressMs, verifierChunkRequests: verifierLoads.length, smallVisiblePhoneTargets: 0, horizontalOverflow: false }), contentType: 'application/json' })
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
  expect(await serious(page)).toEqual([])
  await context.close()
})

test('A11Y a cancelled start restores the question; coming online clears a stale offline notice', async ({ browser }) => {
  const { context, page } = await visitor(browser)
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/')
  await page.getByRole('group', { name: 'Demo questions' }).getByRole('button', { name: /^Kestrel–TSMC/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  const chip = page.getByRole('button', { name: 'pricing & margins' })
  await expect(chip.or(page.getByRole('button', { name: 'Start now' })).first()).toBeVisible()
  if (await chip.isVisible()) await chip.click()
  await page.keyboard.press('Escape')
  await expect(question(page)).toBeFocused()
  await page.getByRole('button', { name: /^Ask/ }).click()
  await expect(chip.or(page.getByRole('button', { name: 'Start now' })).first()).toBeVisible()
  if (await chip.isVisible()) await chip.click()
  const start = page.getByRole('button', { name: 'Start now' }); await expect(start).toBeVisible()
  await context.setOffline(true); await start.click()
  await expect(page.locator('.ra-banner')).toContainText('You’re offline. Your question is still here')
  await context.setOffline(false)
  await expect(page.locator('.ra-banner')).toHaveCount(0, { timeout: 1000 })
  await expect(question(page)).toBeVisible()
  await context.close()
})

test('A11Y an unreachable XRPL node reports infrastructure failure without a check mark', async ({ browser }) => {
  const { context, page } = await visitor(browser)
  // Synthetic ledger failure at the chunk boundary, independent of public Testnet availability.
  await page.route('**/assets/browser-*.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function verifyInBrowser(){return {ok:false,checks:[{check:"testnet",status:"FAIL",detail:"Read-only Testnet lookup unavailable"}],groups:[],endpoint:"",testnet:true}}' }))
  await page.goto('/')
  await page.getByRole('group', { name: 'Demo questions' }).getByRole('button', { name: /^Kestrel–TSMC/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  const chip = page.getByRole('button', { name: 'pricing & margins' }), start = page.getByRole('button', { name: 'Start now' })
  await expect(chip.or(start).first()).toBeVisible(); if (await chip.isVisible()) await chip.click(); await start.click()
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60000 })
  const verify = page.locator('.ra-hv'); await verify.getByRole('button', { name: 'Run the checks' }).click()
  await expect(verify.getByRole('alert')).toContainText("Couldn't reach a public XRPL node")
  await expect(verify.locator('.is-ok, .is-pass')).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
  await context.close()
})
