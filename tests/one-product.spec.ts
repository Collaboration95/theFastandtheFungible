// Layout evidence from recorded responses only. No admission, purchase or live ledger request.
import { test, expect } from '@playwright/test'
import { evidencePath } from './evidence-path'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { renderProofPage, renderProofMissing } from '../server/proof-page'
import type { ProofSnapshot } from '../shared/refusal-proof'
// Synthetic proof-page layout, never represented as a live or verified transaction.
const proof: ProofSnapshot = {
  version: 'refusal-proof-v1', bought: { count: 0, spentMinor: 0, currency: 'SGD' }, id: 'a'.repeat(32), question: 'Layout fixture', askedAt: '2026-11-11T07:06:00Z', createdAt: '2026-11-11T07:07:00Z',
  environment: { surface: 'hosted', models: 'fixture', network: 'XRPL Testnet', label: '' }, found: { paid: 0, free: 0, writers: 0, items: [], more: 0 },
  anchor: { version: 'anchor-v1', network: 'xrpl:1', runIdHash: 'c'.repeat(64), feeDrops: '12', txHash: 'ABCDEF01'.repeat(8), account: 'rTestAccount', head: 'b'.repeat(64), ledgerIndex: 1 },
  verification: { ok: true, at: '2026-11-11T07:07:00Z', passed: 13, skipped: 4, total: 17 }, outcome: { summary: 'Nothing was bought.' }, bundle: {} as ProofSnapshot['bundle'],
}
const trace = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8'))
const phase = process.env.L12R_PHASE ?? 'after'
const dir = evidencePath('l12r/checks.json').replace(/\/checks.json$/, '')
const results: unknown[] = []
for (const width of [1280, 390]) test(`home, one purchase and key check at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const run = structuredClone(trace.run)
  const intent = run.intents.find((i: { status: string }) => i.status === 'VERIFIED')
  run.intents = [intent]; run.receipts = run.receipts.filter((r: { intentId: string }) => r.intentId === intent.intentId)
  run.events = run.events.filter((e: { data?: { intentId?: string } }) => !e.data?.intentId || e.data.intentId === intent.intentId)
  run.spentMinor = intent.amountMinor; run.refundedMinor = 0
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname === '/api/demo/status') return route.fulfill({ json: { questionCapMinor: 200, state: 'ready', csrfToken: 'recorded-layout-only', queue: [], capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'deepseek · fixture purchase decisions', rail: 'XRPL Testnet' }, links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: '', video: '', progress: '', replay: '' } } })
    if (url.pathname === '/api/health') return route.fulfill({ json: trace.health })
    if (url.pathname === '/api/runs') return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: '' })
    if (url.pathname.startsWith('/runs/')) return route.fulfill({ json: run })
    return route.continue()
  })
  const capture = async (scene: string) => {
    await page.evaluate(async () => { await document.fonts.ready })
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
    expect(issues).toEqual([])
    for (const weight of await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).fontWeight))) expect(weight).toBe('600')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: `${dir}/${phase}-${scene}-${width}.png`, fullPage: !await page.locator('dialog[open]').count() })
    results.push({ scene, width, seriousCritical: issues.length, sourceHead: process.env.L12R_HEAD, provenance: 'recorded UI fixture; no live ledger check' })
  }
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Research with a wallet.')
  await capture('hosted-home')
  await page.goto(`/?run=${run.runId}`)
  await expect(page.locator('.ra-q')).toBeVisible()
  await capture('one-purchase')
  if (width === 390) await page.locator('.ra-mobile-spend > button').click()
  const spend = page.locator(width === 390 ? '.ra-mobile-spend-sheet .ra-spend' : '.ra-side .ra-spend')
  await spend.locator('.ra-spending-proof > summary').click()
  await expect(spend.getByRole('button', { name: 'Check the key yourself' })).toBeVisible()
  await spend.locator('.ra-key-reveal details > summary').click()
  await capture('key-check')
})
test.afterAll(() => writeFileSync(`${dir}/${phase}-checks.json`, JSON.stringify(results, null, 2) + '\n'))

// Exercise the shipped CSS and self-hosted font files, not just source declarations.
test('current site and proof pages load Geist and render headings at 600', async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname === '/__proof-full') return route.fulfill({ contentType: 'text/html', body: renderProofPage(proof, { mode: 'page', nonce: 'LAYOUT' }) })
    if (url.pathname === '/__proof') return route.fulfill({ contentType: 'text/html', body: renderProofMissing() })
    if (url.pathname.startsWith('/__site/')) {
      const rel = url.pathname.slice('/__site/'.length), file = resolve('site', !rel || rel.endsWith('/') ? rel + 'index.html' : rel)
      if (!file.startsWith(resolve('site') + '/')) return route.abort()
      try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) }) }
      catch { return route.abort() }
    }
    return route.continue()
  })
  for (const path of ['/__site/', '/__site/developers/', '/__site/proof/', '/__site/ledger/', '/__site/progress/', '/__site/builder-feedback/', '/__proof', '/__proof-full']) {
    await page.goto(path)
    await page.evaluate(async () => { await document.fonts.ready })
    const headings = await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, weight: getComputedStyle(n).fontWeight, family: getComputedStyle(n).fontFamily })))
    expect(headings.length, path).toBeGreaterThan(0)
    for (const heading of headings) { expect(heading.weight, `${path}: ${heading.text}`).toBe('600'); expect(heading.family, path).toContain('Geist') }
    expect(await page.evaluate(() => [...document.fonts].some(f => /Geist/.test(f.family) && f.status === 'loaded')), path).toBe(true)
    const monoVisible = await page.locator('code,.mono').evaluateAll(nodes => nodes.some(n => n.getClientRects().length && /Geist.*Mono/.test(getComputedStyle(n).fontFamily)))
    if (monoVisible) expect(await page.evaluate(() => [...document.fonts].some(f => /Geist.*Mono/.test(f.family) && f.status === 'loaded')), `${path}: Geist Mono loaded`).toBe(true)
  }
})
