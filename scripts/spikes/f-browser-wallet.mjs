// Targeted browser component acceptance: real SDK/faucet/DelegateSet, public identity API stub.
import assert from 'node:assert/strict'
// Verification resource tooling only; no settlement logic is imported.
import { newScope } from '../local-gate.mjs'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { connect, funded, save } from './lib.mjs'
const require = createRequire(import.meta.url)
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const { chromium } = require('playwright')
const { deriveAddress, verify } = require('ripple-keypairs')
const c = await connect()
const scope = await newScope()
let vite, browser
try {
  const cacheDir = scope.tempDir('r3-wallet-vite-')
  const agent = await funded(c), message = randomBytes(64).toString('hex').toUpperCase()
  let address, publicProofKeys
  vite = await createServer({ envFile: false, logLevel: 'silent', cacheDir,
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: [{ name: 'wallet-acceptance', configureServer(server) {
      server.middlewares.use('/__wallet-acceptance', async (req, res) => {
        const html = '<div id="root"></div><script type="module">import React from "react";import{createRoot}from"react-dom/client";import Wallet from "/src/components/DelegatedWallet.tsx";createRoot(document.getElementById("root")).render(React.createElement(Wallet,{onReady:()=>{}}));</script>'
        res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml(req.url, html))
      })
    } }] })
  await vite.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  // Only public proof crosses this boundary; the generated visitor seed is never read by Node.
  await page.route('**/api/wallet/delegation**', async route => {
    const path = new URL(route.request().url()).pathname
    let data = { enabled: true, agent: agent.address, address }
    if (path.endsWith('/challenge')) data = { message }
    else if (path.endsWith('/connect')) {
      const body = route.request().postDataJSON(); publicProofKeys = Object.keys(body).sort()
      assert.deepEqual(publicProofKeys, ['address', 'publicKey', 'signature'])
      assert.equal(deriveAddress(body.publicKey), body.address)
      assert.equal(verify(message, body.signature, body.publicKey), true)
      address = body.address; data = { address }
    } else if (path.endsWith('/disconnect')) { address = undefined; data = { disconnected: true } }
    await route.fulfill({ json: data })
  })
  const started = performance.now()
  await page.goto(vite.resolvedUrls.local[0] + '__wallet-acceptance')
  await page.getByRole('button', { name: 'Create or import wallet' }).click()
  await page.getByText(/Connected/).waitFor({ timeout: 120000 })
  const visitor = address
  assert.ok(visitor)
  const local = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('researchagent.Testnet.wallet.v1') ?? '{}')
    return { network: saved.network, seedPresent: typeof saved.seed === 'string' && saved.seed.length > 0 }
  })
  assert.deepEqual(local, { network: 'Testnet', seedPresent: true })
  const grants = (await c.request({ command: 'account_objects', account: visitor, type: 'delegate', ledger_index: 'validated' })).result.account_objects
  assert.ok(grants.some(g => g.Authorize === agent.address && g.Permissions?.length === 1 && g.Permissions[0].Permission.PermissionValue === 'EscrowCreate'))
  const connectedMs = Math.round(performance.now() - started)
  await page.getByRole('button', { name: 'Revoke', exact: true }).click()
  await page.getByText(/Access not connected/).waitFor({ timeout: 120000 })
  const after = (await c.request({ command: 'account_objects', account: visitor, type: 'delegate', ledger_index: 'validated' })).result.account_objects
  assert.equal(after.some(g => g.Authorize === agent.address), false)
  const records = (await c.request({ command: 'account_tx', account: visitor, ledger_index_min: -1, ledger_index_max: -1, limit: 20, api_version: 2 })).result.transactions
    .map(r => ({ hash: r.hash, tx: r.tx_json, meta: r.meta, ledger: r.ledger_index, validated: r.validated }))
  assert.equal(records.filter(r => r.tx.TransactionType === 'DelegateSet').length, 2)
  assert.ok(records.every(r => r.validated && r.meta.TransactionResult === 'tesSUCCESS'))
  const result = { at: new Date().toISOString(), verdict: 'works', scope: 'Chromium development build of actual wallet component; identity HTTP stub; real Testnet faucet and ledger',
    browser: browser.version(), agent: agent.address, visitor, local, publicProofKeys, connectedMs, totalMs: Math.round(performance.now() - started), records }
  save('f-browser-wallet', result); console.log(JSON.stringify(result, null, 2))
} finally { await browser?.close(); await vite?.close()
  await scope.close(); await c.disconnect() }
