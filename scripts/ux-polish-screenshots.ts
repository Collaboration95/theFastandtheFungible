/** Lane J before/after screenshots. Fixture wrapper, stubbed window.desktop, ephemeral loopback ports only.
 *  Usage: node --import tsx scripts/ux-polish-screenshots.ts <before|after> */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createServer as http } from 'node:http'
import { extname, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium, type Page } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const prefix = process.argv[2]
if (prefix !== 'before' && prefix !== 'after') throw new Error('usage: <before|after>')
const out = 'docs/evidence/round2-j'
await mkdir(out, { recursive: true }); await mkdir('scratch', { recursive: true })
await writeFile('scratch/lane-j-proof.tsx', `import React from 'react'; import {createRoot} from 'react-dom/client'; import ReceiptSheet from '../src/components/ReceiptSheet'; import {exampleRun} from '../shared/contracts/examples'; import useful from '../docs/evidence/round2-g/useful.receipts.json'; import redundant from '../docs/evidence/round2-g/redundant.receipts.json'; import refunded from '../docs/evidence/round2-g/refunded.receipts.json'; import '../src/styles.css'; const name=location.hash.slice(1).split('-')[0];const b=({useful,redundant,refunded})[name]??useful;const run={...exampleRun,runId:b.runId,labels:{...exampleRun.labels,settlement:b.receipts[0]?.label??exampleRun.labels.settlement},contents:b.sources,candidates:b.candidates,answers:b.answers,intents:b.intents,grants:b.grants,receipts:b.receipts}; const receipt=name==='refunded'?b.receipts.find(r=>b.intents.some(i=>i.intentId===r.intentId&&i.refund)):b.receipts[0];createRoot(document.getElementById('root')!).render(<main><h1>Fixture receipt inspection</h1><p>Synthetic content · offline proof · historical refunds retain original rail labels</p><ReceiptSheet run={run} receipt={receipt} onClose={()=>document.querySelector('dialog').close()}/></main>);`)
await writeFile('scratch/lane-j-proof.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>Receipt fixture</title><div id="root"></div><script type="module" src="/scratch/lane-j-proof.tsx"></script></html>')

const root = resolve('.')
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const statics = http(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname
  const file = path === '/recovery' ? 'desktop/recovery.html' : path === '/preferences' ? 'desktop/preferences.html' : path.slice(1)
  if (!file.startsWith('desktop/') || !mime[extname(file)]) { res.writeHead(404).end(); return }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] }).end(await readFile(resolve(root, file)))
}).listen(0, '127.0.0.1')
await new Promise(r => statics.once('listening', r))
const staticPort = (statics.address() as { port: number }).port

const desktopStub = `(() => {
  const state = { live: true, sameKeyDecisions: true, maxMinor: 100, dailyMinor: 500, walletDailyMinor: 300, emergencyPaused: false, provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', backend: 'local', remoteUrl: '', coldStartMs: 612, wallet: { wallet: { dailyMinor: 300, spentMinor: 120, paused: false }, labels: { settlement: 'XRPL Testnet · test funds' } } }
  const keys = { available: true, present: true }
  window.desktop = {
    state: async () => state, agents: async () => ({ url: 'http://127.0.0.1:49152/mcp', agents: [] }),
    presence: async () => keys, test: async () => ({ ok: true, latencyMs: 412, inputTokens: 18, outputTokens: 4, costUsd: 0.00002 }),
    recover: async () => undefined, save: async () => undefined, secret: async () => ({ saved: true, ...keys }),
    deleteSecret: async () => ({ deleted: true, available: true, present: false }), pause: async () => undefined, wallets: async () => [{ address: 'rFixtureBuyer' }], mcp: async () => 'claude mcp add researchagent -- node mcp.mjs',
  }
})()`

const vite = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await vite.listen()
const vitePort = (vite.httpServer!.address() as { port: number }).port
const browser = await chromium.launch()
const serious = async (page: Page, label: string) => {
  const v = (await new AxeBuilder({ page }).analyze()).violations.filter(x => ['serious', 'critical'].includes(x.impact ?? ''))
  if (v.length) throw new Error(`${label}: ${JSON.stringify(v.map(x => [x.id, x.nodes.map(n => n.target)]))}`)
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1500 } }); const page = await ctx.newPage()
  const payments: Record<string, unknown[]> = { pending: [{ kind: 'royalty', status: 'SIGNED_UNCONFIRMED', amountDrops: '5000', policyVersion: 'hire-v1' }], confirmed: [{ kind: 'royalty', status: 'CONFIRMED', amountDrops: '5000', policyVersion: 'hire-v1' }] }
  let scenario = ''
  await page.route('**/runs/**/receipts.json', route => route.fulfill({ json: { payments: payments[scenario.split('-')[1] ?? ''] ?? [] } }))
  for (const name of ['useful', 'redundant', 'refunded', 'useful-pending']) {
    scenario = name
    await page.goto(`http://127.0.0.1:${vitePort}/scratch/lane-j-proof.html#${name}`); await page.reload()
    await page.getByRole('dialog', { name: 'Receipt', exact: true }).waitFor()
    await page.waitForTimeout(200)
    const sec = page.locator('section[aria-label="What your money bought"]')
    if (prefix === 'before') { const d = sec.locator('details').first(); if (await d.count()) await d.locator(':scope > summary').click() }
    else { const first = sec.locator('button[aria-expanded]').first(); if (await first.count()) await first.click(); const v = sec.getByRole('button', { name: /verify/i }).first(); if (name === 'useful' && await v.count()) await v.click() }
    await serious(page, name)
    await page.screenshot({ path: `${out}/${prefix}-receipt-${name}.png`, fullPage: true })
  }
  await ctx.close()
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const d = await desktop.newPage()
  d.on('pageerror', e => console.error('pageerror', e.message)); await d.addInitScript(desktopStub)
  await d.goto(`http://127.0.0.1:${staticPort}/preferences`); await d.waitForFunction(() => document.getElementById('status')?.textContent?.startsWith('Ready'))
  await d.locator('#test').click(); await d.locator('#testResult').filter({ hasText: 'Connected' }).waitFor()
  await serious(d, 'settings'); await d.setViewportSize({ width: 1280, height: await d.evaluate(() => document.documentElement.scrollHeight) }); await d.screenshot({ path: `${out}/${prefix}-settings.png` }); await d.setViewportSize({ width: 1280, height: 800 })
  await d.goto(`http://127.0.0.1:${staticPort}/recovery`); await serious(d, 'recovery')
  await d.screenshot({ path: `${out}/${prefix}-recovery.png` })
  await desktop.close()
} finally { await browser.close(); await vite.close(); statics.close() }
