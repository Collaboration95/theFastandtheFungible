import { ResourceScope } from '../shared/resource-scope.js'
// Explicit opt-in; fresh npx cache, local packed bytes, public Testnet only.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { processTransport, stopProcess } from './release-processes.js'
if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('Network opt-in required: RA_ACCEPT_TESTNET=1')
const manifestPath = resolve(process.argv[2] || 'dist/release/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const tgz = resolve(dirname(manifestPath), manifest.artifacts.find((a: { kind: string }) => a.kind === 'mcp-tgz').file)
const scope = new ResourceScope()
try {
const scratch = scope.evidenceDir('ra-testnet-consumer-', 'Testnet wallets and potentially signed obligations; retain for manual reconciliation')
const evidence = resolve('docs/evidence/round3-a'); mkdirSync(evidence, { recursive: true })
const timings: { payerAddress?: string }[] = []
try {
 for (let attempt = 1; attempt <= 2; attempt++) {
  const started = performance.now()
  const child = scope.spawn('npx', ['-y', '--cache', join(scratch, 'npm-cache'), pathToFileURL(tgz).href, '--testnet'], { cwd: scratch, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(scratch, 'state'), MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '200' } })
  const transport = processTransport(child)
const client = new Client({ name: 'testnet-release-consumer', version: '1' })
  const call = async (name: string, args = {}) => { const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 }); assert(!r.isError, `${name} failed`); return JSON.parse((r.content as {text: string}[])[0].text) }
  try {
   await client.connect(transport)
   const initializeSeconds = (performance.now() - started) / 1000
   assert(initializeSeconds < 20, 'Initialize exceeded 20s')
   const initialized = performance.now()
   const wallet = await call('wallet_status')
   // First tool call waits for provisioning; a reused cache returns at once.
   const fundedSeconds = (performance.now() - initialized) / 1000
   assert.equal(wallet.rail, 'xrpl-testnet', 'SIMULATED fallback cannot satisfy live acceptance')
   assert.match(wallet.payerAddress, /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/); assert(wallet.startupLabels.includes('Testnet · no real value'))
   if (attempt > 1) { assert.equal(wallet.payerAddress, timings[0].payerAddress, 'second run must reuse the cached wallets'); assert(fundedSeconds < 15, 'cached wallets should not be re-funded') }
   assert(fundedSeconds < 60, 'Funding exceeded 60s')
   assert.equal(statSync(join(scratch, 'state/researchagent/testnet/wallets.private.json')).mode & 0o777, 0o600)
   const args = { question: 'What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', budget_sgd: 999, idempotency_key: `round3-a-${attempt}` }
   const askStarted = performance.now()
   let a = await call('ask_expert', args)
   const deadline = Date.now() + 90000
   while (!a.ledger?.anchor && Date.now() < deadline) { await new Promise(r => setTimeout(r, 500)); a = await call('get_run', { run_id: a.run_id }) }
   assert(a.budgetMinor <= 200); assert(a.spentMinor <= 200)
   const b = await call('ask_expert', args); assert.equal(a.run_id, b.run_id); assert.equal(a.spentMinor, b.spentMinor)
   const hashes = [a.ledger?.purchases[0]?.create?.txHash, a.ledger?.purchases[0]?.finish?.txHash, a.ledger?.anchor?.txHash]
   const transactions = []
   for (const [i, hash] of hashes.entries()) {
    assert.match(hash || '', /^[A-F0-9]{64}$/)
    const response = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }), signal: AbortSignal.timeout(15000) })
    const { result } = await response.json(); assert.equal(result.validated, true); assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
    const tx = result.tx_json ?? result; assert.equal(tx.TransactionType, ['EscrowCreate', 'EscrowFinish', 'AccountSet'][i])
    transactions.push({ hash, type: tx.TransactionType, feeDrops: Number(tx.Fee), ledgerIndex: result.ledger_index })
   }
   if (attempt === 2) { const capped = await call('ask_expert', { ...args, idempotency_key: 'daily-cap-exhausted' }); assert.equal(capped.spentMinor, 0); assert(capped.budgetMinor < 90) }
   timings.push({ attempt, payerAddress: wallet.payerAddress, rail: wallet.rail, initializeSeconds, fundedSeconds, purchaseSeconds: (performance.now() - askStarted) / 1000, transactions })
   console.log(JSON.stringify(timings.at(-1)))
  } finally { await client.close(); await stopProcess(child) }
 }
 writeFileSync(join(evidence, 'probe.json'), JSON.stringify({ timings }, null, 2) + '\n')
} finally { /* outer scope owns scratch and groups */ }

} finally { await scope.close() }
