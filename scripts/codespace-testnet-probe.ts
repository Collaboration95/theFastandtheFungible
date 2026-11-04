// Runs inside the Testnet devcontainer (see .github/workflows/codespace-testnet.yml). Public Testnet only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '../sdk/index.js'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
const started = Date.now(), seconds = () => (Date.now() - started) / 1000
const out = 'scratch/codespace-testnet/result.json'
mkdirSync('scratch/codespace-testnet', { recursive: true })
const client = createClient({ baseUrl: 'http://127.0.0.1:10588', token: process.env.RA_API_TOKEN })
// `make testnet` (the devcontainer postStartCommand) logs "ResearchAgent ready:" once the API answers.
const log = () => { try { return readFileSync('/tmp/researchagent-testnet.log', 'utf8') } catch { return '' } }
while (!log().includes('ResearchAgent ready:')) {
  if (seconds() > 240) throw Error('Devcontainer boot timeout: no ready line in /tmp/researchagent-testnet.log')
  await new Promise(done => setTimeout(done, 1000))
}
const bootSeconds = seconds()
const fallback = log().match(/SIMULATED fallback · ([^\n]+)/)?.[1]
if (fallback) {
  // Gate 5: say so loudly. A faucet failure from CI IPs is yellow (warning annotation), not a product failure.
  const label = `SIMULATED fallback (${fallback})`
  console.log(`::warning title=Testnet faucet unavailable::${label}`)
  writeFileSync(out, JSON.stringify({ outcome: 'simulated-fallback', label, bootSeconds }, null, 2) + '\n')
} else {
  const run = await client.ask(DEMO_QUESTIONS.find(q => q.id === 'UC3')!.text, { budget: 2, idempotencyKey: 'codespace-testnet-uc3' })
  const bundle = await client.receipts(run.run_id)
  const intent = bundle.intents.find(i => i.escrow?.createHash && i.escrow.finishHash)
  assert(intent, 'no validated key-reveal purchase in the receipts')
  const checked: Record<string, string> = {}
  for (const [name, hash] of [['EscrowCreate', intent.escrow!.createHash], ['EscrowFinish', intent.escrow!.finishHash]] as const) {
    assert.match(hash ?? '', /^[A-F0-9]{64}$/)
    const response = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }), signal: AbortSignal.timeout(15000) })
    const { result } = await response.json() as { result: { validated?: boolean; meta?: { TransactionResult?: string }; tx_json?: { TransactionType?: string }; TransactionType?: string } }
    assert.equal(result.validated, true); assert.equal(result.meta?.TransactionResult, 'tesSUCCESS'); assert.equal((result.tx_json ?? result).TransactionType, name)
    checked[name] = hash!
  }
  writeFileSync(out, JSON.stringify({ outcome: 'testnet', label: 'Testnet · no real value · fixture models', bootSeconds, totalSeconds: seconds(), spentMinor: run.spentMinor, ...checked }, null, 2) + '\n')
  console.log(`Testnet purchase validated in ${seconds().toFixed(1)} s: ${checked.EscrowCreate} ${checked.EscrowFinish}`)
}
