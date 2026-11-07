import { ResourceScope, waitForOutput } from '../shared/resource-scope.js'
// Explicit opt-in (RA_ACCEPT_TESTNET=1): `npx -y <packed mcp tgz> app --testnet` from a fresh npm cache and a fresh
// wallet cache, driven in a real browser, then every hash is checked on s.altnet. Public Testnet only; no real value.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { stopProcess } from './release-processes.js'
if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('Network opt-in required: RA_ACCEPT_TESTNET=1')
const manifestPath = resolve(process.argv[2] || 'dist/release/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const tgz = resolve(dirname(manifestPath), manifest.artifacts.find((a: { kind: string }) => a.kind === 'mcp-tgz').file)
const scope = new ResourceScope()
try {
const scratch = scope.evidenceDir('ra-testnet-app-', 'Testnet wallets and potentially signed obligations; retain for manual reconciliation')
const evidence = resolve('docs/evidence/round3-d'); mkdirSync(evidence, { recursive: true })
const cache = join(scratch, 'npm-cache'), state = join(scratch, 'state')
const boot = async () => {
  const started = performance.now()
  const child = scope.spawn('npx', ['-y', '--cache', cache, pathToFileURL(tgz).href, 'app', '--testnet'], { cwd: scratch, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: state } as NodeJS.ProcessEnv })
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.stderr.resume()
  const ready = await waitForOutput(child, /ResearchAgent ready: (http:\/\/127\.0\.0\.1:\d+) · fixture models · XRPL TESTNET · no real value/, 120_000)
  const seconds = (performance.now() - started) / 1000
  const payer = out.match(/payer address: (r[1-9A-HJ-NP-Za-km-z]{24,34})/)?.[1]
  assert(payer, 'ready block must print the public payer address')
  assert(/wallet daily cap S\$5\.00/.test(out), 'daily cap must be labelled')
  assert(!/(?:^|[^a-z])s[1-9A-HJ-NP-Za-km-z]{28,}/.test(out), 'no seed may be printed')
  assert.equal(statSync(join(state, 'researchagent/testnet/wallets.private.json')).mode & 0o777, 0o600)
  return { child, url: ready[1], seconds, payer }
}
const rpc = async (hash: string) => {
  const response = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }), signal: AbortSignal.timeout(15000) })
  return (await response.json()).result
}
try {
  const cold = await boot()
  assert(cold.seconds < 60, `cold start ${cold.seconds}s exceeds 60 s`)
  const browser = await chromium.launch()
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
    await page.goto(cold.url + '/?pace=real')
    await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).waitFor()
    await page.screenshot({ path: join(evidence, 'ready.png') })
    const asked = performance.now()
    await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
    await page.getByRole('button', { name: /^Ask/ }).click()
    await page.getByRole('button', { name: 'pricing & margins' }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await page.waitForFunction(() => /Answer ready/.test(document.title), undefined, { timeout: 150_000 })
    const lifecycle = page.getByRole('region', { name: 'Key-reveal escrow' }).first()
    await lifecycle.waitFor({ timeout: 30_000 })
    const links = lifecycle.getByRole('link', { name: 'tx ↗' })
    await links.nth(1).waitFor({ timeout: 60_000 })
    // The anchor is written after the run is DONE. Wait for it in the engine first; the page may need a reload to show it.
    const runId = new URL(page.url()).searchParams.get('run')
    assert(runId, 'page must carry ?run=')
    const anchorDeadline = Date.now() + 120_000
    while (!(await (await fetch(`${cold.url}/runs/${runId}`)).json() as { ledgerAnchor?: unknown }).ledgerAnchor) { assert(Date.now() < anchorDeadline, 'anchor never reached the engine'); await new Promise(r => setTimeout(r, 1000)) }
    const anchorLink = page.getByRole('link', { name: /^Anchored on XRPL/ })
    const liveAnchor = await anchorLink.waitFor({ timeout: 10_000 }).then(() => true, () => false)
    if (!liveAnchor) { await page.reload(); await anchorLink.waitFor({ timeout: 30_000 }) }
    const askSeconds = (performance.now() - asked) / 1000
    const hrefs = [await links.nth(0).getAttribute('href'), await links.nth(1).getAttribute('href'), await anchorLink.getAttribute('href')]
    const hashes = hrefs.map(href => href?.match(/^https:\/\/testnet\.xrpl\.org\/transactions\/([A-F0-9]{64})$/i)?.[1]?.toUpperCase())
    await page.screenshot({ path: join(evidence, 'bought.png'), fullPage: true })
    const transactions = []
    for (const [i, hash] of hashes.entries()) {
      assert(hash, `explorer link ${i} missing`)
      const result = await rpc(hash)
      assert.equal(result.validated, true); assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
      const tx = result.tx_json ?? result; assert.equal(tx.TransactionType, ['EscrowCreate', 'EscrowFinish', 'AccountSet'][i])
      transactions.push({ type: tx.TransactionType, hash, ledgerIndex: result.ledger_index, feeDrops: Number(tx.Fee) })
    }
    await stopProcess(cold.child)
    const warm = await boot()
    assert.equal(warm.payer, cold.payer, 'warm start must reuse the cached wallets')
    await stopProcess(warm.child)
    const probe = { network: 'XRPL Testnet (s.altnet)', question: 'Kestrel–TSMC outlook, pricing & margins', payer: cold.payer, coldReadySeconds: +cold.seconds.toFixed(1), warmReadySeconds: +warm.seconds.toFixed(1), browserAskToAnchorSeconds: +askSeconds.toFixed(1), anchorShownWithoutReload: liveAnchor, transactions }
    writeFileSync(join(evidence, 'probe.json'), JSON.stringify(probe, null, 2) + '\n')
    console.log(JSON.stringify(probe))
  } finally { await browser.close() }
} finally { /* outer scope owns scratch and groups */ }

} finally { await scope.close() }
