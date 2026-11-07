import { packedArtifact, withPackedSession, packedStdio, validatedTransactions } from './packed-consumer.js'
// Explicit opt-in; fresh npx cache, local packed bytes, public Testnet only.
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
const { tgz } = packedArtifact(process.argv[2])
await withPackedSession(true, async ({ scope, scratch, spawnPacked }) => {
const evidence = resolve('docs/evidence/round3-a'); mkdirSync(evidence, { recursive: true })
const timings: { payerAddress?: string }[] = []
 for (let attempt = 1; attempt <= 2; attempt++) {
  const started = performance.now()
  const child = spawnPacked(tgz, ['--testnet'], { MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '200' })
  const { client, call } = await packedStdio(scope, child)
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
   const transactions = await validatedTransactions(hashes)
   if (attempt === 2) { const capped = await call('ask_expert', { ...args, idempotency_key: 'daily-cap-exhausted' }); assert.equal(capped.spentMinor, 0); assert(capped.budgetMinor < 90) }
   timings.push({ attempt, payerAddress: wallet.payerAddress, rail: wallet.rail, initializeSeconds, fundedSeconds, purchaseSeconds: (performance.now() - askStarted) / 1000, transactions })
   console.log(JSON.stringify(timings.at(-1)))
  await client.close()
 }
 writeFileSync(join(evidence, 'probe.json'), JSON.stringify({ timings }, null, 2) + '\n')
})
