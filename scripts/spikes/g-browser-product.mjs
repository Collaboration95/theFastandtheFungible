// Browser-local visitor key + real identity API and product purchase, all on Testnet.
// Development component harness; run admission uses HTTP, not the app's Ask/modal UI.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Wallet } from 'xrpl'
import { connect, funded, submit, save } from './lib.mjs'
const require = createRequire(import.meta.url)
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const { chromium } = require('playwright')
const c = await connect(), children = [], records = [], token = randomBytes(32).toString('hex')
const api = 'http://127.0.0.1:9588'
const question = 'Can an XRPL escrow hold RLUSD today, and what must the issuer enable before a buyer can lock it?'
let vite, browser
try {
  const agent = await funded(c), writer = Wallet.generate()
  const funding = await submit(c, agent, { TransactionType: 'Payment', Account: agent.address, Destination: writer.address, Amount: '6000000' }, { label: 'fund fresh writer' })
  assert.equal(funding.record.result, 'tesSUCCESS'); records.push(funding.record)
  const backend = { target: api, changeOrigin: true, configure: proxy => proxy.on('proxyReq', req => req.setHeader('Authorization', `Bearer ${token}`)) }
  vite = await createServer({ envFile: false, logLevel: 'silent', cacheDir: 'scratch/r3-browser-product-cache', server: { host: '127.0.0.1', port: 0, proxy: { '/api': backend, '/runs': backend } },
    plugins: [{ name: 'browser-product', configureServer(server) {
      server.middlewares.use('/__browser-product', async (req, res) => {
        const html = '<div id="root"></div><script type="module">import React from "react";import{createRoot}from"react-dom/client";import Wallet from "/src/components/DelegatedWallet.tsx";createRoot(document.getElementById("root")).render(React.createElement(Wallet,{onReady:()=>{}}));</script>'
        res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml(req.url, html))
      })
    } }] })
  await vite.listen()
  const origin = vite.resolvedUrls.local[0].replace(/\/$/, '')
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, DOTENV_CONFIG_PATH: '.spike-no-env',
    HOST: '127.0.0.1', PORT: '9588', PUBLISHER_PORT: '9590', DEMO_PORT_OFFSET: '800', PUBLISHER_URL: 'http://127.0.0.1:9590', RA_WEB_ORIGIN: origin,
    RA_API_TOKEN: token, LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0',
    SETTLEMENT_RAIL: 'xrpl-testnet', ESCROW_MODE: 'key-reveal', ESCROW_ASSET: 'XRP', WALLET_MODE: 'delegated',
    XRPL_PAYER_SEED: agent.seed, APP_DB: ':memory:', PUBLISHER_DB: ':memory:', REPORT_DIR: 'scratch/r3-browser-product', PUBLISHER_SECRET: randomBytes(32).toString('hex') }
  const slugs = ['team-builder-notes','team-xrpl-explainers','alphaleak','the-fab-floor','notfinancialtimes','basis-points','load-factor','kopi-contrarian','marketpulse-digest','grid-operators-report','open-records']
  env.ESCROW_WRITERS = slugs.join(',')
  for (const slug of slugs) env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-', '_')}_SEED`] = writer.seed
  const ready = async (url, headers = {}) => {
    for (let i = 0; ; i++) { try { if ((await fetch(url, { headers })).ok) return } catch { /* starting */ } if (i > 100 || children.some(p => p.exitCode !== null)) throw Error('Local stack startup failed'); await new Promise(r => setTimeout(r, 200)) }
  }
  children.push(spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env, stdio: 'ignore' })); await ready(env.PUBLISHER_URL + '/health')
  children.push(spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env, stdio: 'ignore' })); await ready(api + '/api/runs', { Authorization: `Bearer ${token}` })
  browser = await chromium.launch({ headless: true }); const page = await browser.newPage()
  let publicProofKeys
  page.on('request', req => { if (new URL(req.url()).pathname === '/api/wallet/delegation/connect') publicProofKeys = Object.keys(req.postDataJSON()).sort() })
  const started = performance.now()
  await page.goto(origin + '/__browser-product')
  await page.getByRole('button', { name: 'Create or import wallet' }).click()
  await page.getByText(/Connected/).waitFor({ timeout: 120000 })
  const status = await page.evaluate(async () => (await fetch('/api/wallet/delegation')).json())
  const visitor = status.address; assert.ok(visitor)
  assert.deepEqual(publicProofKeys, ['address','publicKey','signature'])
  const local = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('researchagent.Testnet.wallet.v1') ?? '{}'); return { network: w.network, seedPresent: typeof w.seed === 'string' && w.seed.length > 0 } })
  assert.deepEqual(local, { network: 'Testnet', seedPresent: true })
  const purchaseStarted = performance.now()
  const initial = await page.evaluate(async question => { const r = await fetch('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, budgetMinor: 100, escrow: true }) }); if (r.status !== 201) throw Error(`Admission HTTP ${r.status}`); return r.json() }, question)
  let run
  for (let i = 0; ; i++) { run = await page.evaluate(async id => (await fetch(`/runs/${id}`)).json(), initial.runId); if (['DONE','FAILED','STOPPED'].includes(run.phase)) break; if (i > 600) throw Error('Purchase timeout'); await new Promise(r => setTimeout(r, 500)) }
  const released = run.intents.filter(i => i.status === 'VERIFIED' && i.escrow?.state === 'RELEASED')
  assert.equal(released.length, 1); assert.equal(run.spentMinor, 40); assert.equal(released[0].escrow.owner, visitor)
  const purchaseMs = Math.round(performance.now() - purchaseStarted)
  save('g-browser-product-receipt', await page.evaluate(async id => (await fetch(`/runs/${id}/receipts.json`)).json(), initial.runId))
  for (const [label, hash] of [['product create', released[0].escrow.createHash], ['writer finish', released[0].escrow.finishHash]]) {
    const { result } = await c.request({ command: 'tx', transaction: hash, api_version: 2 })
    assert.ok(result.validated); assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
    if (label === 'product create') { assert.equal(result.tx_json.Account, visitor); assert.equal(result.tx_json.Delegate, agent.address) }
    records.push({ label, hash, tx: result.tx_json, meta: result.meta, ledger: result.ledger_index, validated: result.validated })
  }
  await page.getByRole('button', { name: 'Revoke', exact: true }).click(); await page.getByText(/Access not connected/).waitFor({ timeout: 120000 })
  const after = await page.evaluate(async question => { const status = await (await fetch('/api/wallet/delegation')).json(); const r = await fetch('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, budgetMinor: 100, escrow: true }) }); return { status, admissionStatus: r.status } }, question)
  assert.equal(after.status.address, undefined); assert.equal(after.admissionStatus, 409)
  const history = (await c.request({ command: 'account_tx', account: visitor, ledger_index_min: -1, ledger_index_max: -1, limit: 20, api_version: 2 })).result.transactions
  for (const r of history.filter(r => !records.some(record => record.hash === r.hash))) records.push({ label: r.tx_json.TransactionType, hash: r.hash, tx: r.tx_json, meta: r.meta, ledger: r.ledger_index, validated: r.validated })
  assert.equal(history.filter(r => r.tx_json.TransactionType === 'DelegateSet').length, 2)
  assert.ok(records.every(r => r.validated && (r.result ?? r.meta?.TransactionResult) === 'tesSUCCESS'))
  const result = { verdict: 'works', at: new Date().toISOString(), scope: 'Browser wallet component, real identity API and real product HTTP admission; development build; fixture models; Testnet XRP; Ask/modal UI and hosted deployment not tested', browser: browser.version(), visitor, agent: agent.address, writer: writer.address, local, publicProofKeys, purchaseMs, totalMs: Math.round(performance.now() - started), labels: run.labels, phase: run.phase, spentMinor: run.spentMinor, intents: run.intents, afterRevocation: after, records }
  save('g-browser-product', result); console.log(JSON.stringify({ verdict: result.verdict, visitor, purchaseMs, spentMinor: run.spentMinor, revokedAdmission: after.admissionStatus, hashes: records.map(r => r.hash) }))
} finally {
  await browser?.close(); await vite?.close()
  for (const child of children) child.kill('SIGTERM')
  await Promise.all(children.map(child => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(() => child.kill('SIGKILL'), 3000).unref() })))
  await c.disconnect()
}
