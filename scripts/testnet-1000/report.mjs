// Generate the evidence from actual receipts, never a target or a fixture count.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { rows } from './state.mjs'
const receipts = rows('data/evidence/testnet-1000/receipts.jsonl')
const journalPath = process.argv.includes('--journal') ? process.argv[process.argv.indexOf('--journal') + 1] : '/tmp/researchagent-testnet-1000/rpc.jsonl'
const rpc = existsSync(journalPath) ? rows(journalPath) : []
if (existsSync(journalPath)) {
  const ledgers = new Map(rpc.filter(e => e.kind === 'validated').map(e => [e.hash, e.ledger]))
  writeFileSync('data/evidence/testnet-1000/funding.json', JSON.stringify({ network: 'xrpl-testnet', source: 'TestnetProvisioner faucet buyer, then persisted signed XRP top-ups', payments: rpc.filter(e => e.kind === 'submit' && e.type === 'Payment').map(e => ({ hash: e.hash, ledger: ledgers.get(e.hash) ?? null })), rpcRetries: rpc.filter(e => e.kind === 'retry' || e.kind === 'funding-retry') }, null, 2) + '\n')
}
const success = receipts.filter(r => r.outcome === 'success')
const percentiles = key => {
  const values = success.map(r => r[key]).filter(v => typeof v === 'number').sort((a, b) => a - b)
  return Object.fromEntries([50, 90, 99].map(p => ['p' + p, values[Math.max(0, Math.ceil(values.length * p / 100) - 1)] ?? null]))
}
const proofPath = 'docs/evidence/proof/testnet-1000-verify.json'
const runMetadata = JSON.parse(readFileSync('data/evidence/testnet-1000/run.json', 'utf8'))
const proof = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, 'utf8')) : null
if (proof && proof.receiptsSha256 !== createHash('sha256').update(readFileSync('data/evidence/testnet-1000/receipts.jsonl')).digest('hex')) proof.success = false
const summary = { network: 'xrpl-testnet', count: receipts.length, successes: success.length, successRate: receipts.length ? success.length / receipts.length : 0, totalSpentDrops: success.reduce((n, r) => n + BigInt(r.amountDrops), 0n).toString(), createMs: percentiles('createMs'), finishMs: percentiles('finishMs'), endToEndMs: percentiles('endToEndMs'), failures: Object.fromEntries([...new Set(receipts.filter(r => r.outcome !== 'success').map(r => r.failureCause))].map(c => [c, receipts.filter(r => r.failureCause === c).length])), independentlyVerified: proof?.receipts === receipts.length && proof?.success ? proof.verified : 0 }
writeFileSync('data/evidence/testnet-1000/summary.json', JSON.stringify(summary, null, 2) + '\n')
// The feed consumes this explicit public projection; application delivery is a local observation.
if (receipts.length && summary.independentlyVerified === receipts.length && rpc.length) {
  const validated = new Map(rpc.filter(e => e.kind === 'validated').map(e => [e.hash, e.at]))
  const feedRows = success.map(r => {
    const created = validated.get(r.createHash), finished = validated.get(r.finishHash)
    if (r.resourceId !== runMetadata.resourceId || !Number.isFinite(created) || !Number.isFinite(finished) || finished < created) throw Error('Feed requires matching resource metadata and validated timing observations')
    return { id: createHash('sha256').update(r.intentId).digest('hex').slice(0, 24), time: new Date(created).toISOString(), topic: 'Agent payments', resourceTitle: runMetadata.resourceTitle, writer: runMetadata.writerLabel, priceMinor: r.priceMinor, createHash: r.createHash, createLedger: r.createLedger, finishHash: r.finishHash, keyCheck: 'match', gate: 'verified', state: 'finished', settlementSeconds: (finished - created) / 1000 }
  }).sort((a, b) => b.time.localeCompare(a.time))
  const label = `${receipts.length.toLocaleString('en-US')} recorded purchases. Ledger independently checked; delivery observed locally.`
  writeFileSync('data/evidence/testnet-1000/feed.json', `{"schema":"public-feed-v1","label":${JSON.stringify(label)},"rows":[\n${feedRows.map(row => JSON.stringify(row)).join(',\n')}\n]}\n`)
}
const seconds = value => value === null ? 'unmeasured' : (value / 1000).toFixed(3) + ' s'
const table = ['createMs', 'finishMs', 'endToEndMs'].map(key => `| ${key} | ${seconds(summary[key].p50)} | ${seconds(summary[key].p90)} | ${seconds(summary[key].p99)} |`).join('\n')
const sample = success.slice(0, 5).map(r => `- ${r.intentId}: [create ${r.createHash}](https://testnet.xrpl.org/transactions/${r.createHash}), [finish ${r.finishHash}](https://testnet.xrpl.org/transactions/${r.finishHash}).`).join('\n')
writeFileSync('docs/evidence/proof/TESTNET-1000.md', `# Checkable XRPL Testnet purchases

${summary.successes.toLocaleString('en-US')} successful purchases / ${summary.count.toLocaleString('en-US')} recorded attempts (${(summary.successRate * 100).toFixed(2)}%); **${summary.independentlyVerified.toLocaleString('en-US')} independently verified**. Principal: ${Number(summary.totalSpentDrops) / 1e6} Testnet XRP (${summary.totalSpentDrops} drops). Transaction fees are separate in the verifier output. These are deterministic repeat purchases of team-authored content from fresh test accounts, not independent customers or writers. No LLM or hosted deployment was used.

The purchase batch ran against product revision ${runMetadata.productBaseCommit}. [run.json](../../../data/evidence/testnet-1000/run.json) pins that revision and the public article metadata used by the recorded feed.

| Phase (local observations) | p50 | p90 | p99 |
|---|---|---|---|
${table}

Failures by cause: ${Object.keys(summary.failures).length ? JSON.stringify(summary.failures) : 'none in the recorded purchases'}. Pending or interrupted purchases are never counted as successes. The target remains 1,000 until the committed count reaches it.

## Verify yourself

From this checkout, with dependencies installed and Node 22:

\`\`\`sh
npm run proof:testnet-verify
\`\`\`

This re-fetches both transactions for every receipt from a public Testnet node, checks validated tesSUCCESS, PREIMAGE-SHA-256, the fulfillment digest, amount, destination, owner and sequence, and the on-ledger intent/resource memo. It scans payer account history for omitted or duplicate successful EscrowCreates and compares the ledger principal total with receipt totals. It writes [the machine-readable result](testnet-1000-verify.json) and exits nonzero on any mismatch. There are no product-code imports in the verifier. The verifier checks local grant/read fields for consistency; XRPL does not independently attest application read timestamps. It checks all retained history of the fresh payer accounts through a pinned validated ledger at verification time, including before the first listed receipt.

## Reproduce and resume

\`\`\`sh
npm run proof:testnet-run -- --testnet --count 20 --state /tmp/testnet-proof-new --receipts /tmp/testnet-proof-new/receipts.jsonl
npm run proof:testnet-run -- --testnet --count 1000 --state /tmp/testnet-proof-new --receipts /tmp/testnet-proof-new/receipts.jsonl
npm run proof:testnet-verify -- --receipts /tmp/testnet-proof-new/receipts.jsonl --out /tmp/testnet-proof-new/verify.json
npm run proof:testnet-test
\`\`\`

These commands start a separate private batch on a fresh checkout. The first command is the pilot. The second extends the same durable batch; the pilot's 20 purchases count toward 1,000. Resuming the original committed batch requires its original private state and the default receipt destination. node scripts/testnet-1000/report.mjs regenerates this committed batch's summary, document and feed; --journal can select its matching private timing journal. Defaults: eight purchases in flight, at most eight outstanding RPC calls across all local publishers and payers; exponential backoff capped at 30 s. Funding retries back off to 60 s. All ports are ephemeral and publisher ports are checkpointed for stable source identity on resume. The runner exposes only loopback publisher and snapshot endpoints and closes them on exit.

The explicit --testnet CLI flag is required; nothing runs by default. --count sets the target count (1..1100). --receipts optionally selects a separate JSONL output under /tmp or data/evidence/testnet-1000 (default the canonical receipt file). --state selects a private directory under /tmp (default /tmp/researchagent-testnet-1000). Seeds, publisher encryption keys, signed blobs, SQLite journals, a checkpoint and hash-only RPC observations are retained there with private permissions. Keep this directory until all obligations are reconciled. A process lock prevents concurrent owners. Completed receipt IDs are skipped on resume; incomplete intents reuse the product's persisted create blob. An incomplete last JSONL line is removed before recovery; complete rows are never rewritten. Reusing this evidence destination with a different state directory is refused.

The runner uses the existing TestnetProvisioner: one faucet-funded fresh buyer funds fresh payer/writer accounts. Fresh bootstrap returns 4.2 XRP from one writer to the buyer, then gives each other payer 1 XRP; a 100-XRP faucet grant covers this allocation, the principal, reserves and capped fees. Every transfer persists its signed blob before submission. Existing batches retain their original staged top-ups on resume. No seed or fulfillment is published. Eight isolated local publisher journals can use eight fresh writer wallets while serving the same team-authored article. This is a throughput test, not evidence of eight independent writers.

## Fresh bootstrap acceptance

The canonical 1,000 batch used staged pilot funding. A separate fresh eight-payer/eight-writer 20-purchase pilot validates the final one-faucet allocation; its receipts and independent verifier result are published as fresh-pilot.jsonl and fresh-pilot-verify.json alongside the main evidence. It is excluded from the throughput percentiles and canonical 1,000 count. Verify it with npm run proof:testnet-verify -- --receipts data/evidence/testnet-1000/fresh-pilot.jsonl --out data/evidence/testnet-1000/fresh-pilot-verify.json.

## Product path and hard gates

Each purchase probes the real publisher unpaid GET and requires a 402 with escrow-v1 terms. PurchaseManager → EscrowPurchases then validates the signed resource manifest and quote, reserves exactly that resource's per-run budget, persists an EscrowCreate before submission, verifies the validated lock, and sends PAYMENT-SIGNATURE to publisher/routes.ts. The writer persists and submits its EscrowFinish with the key. The buyer independently validates the key and ciphertext, checks the content manifest, grants access and records read_paid at the product Store release boundary. No money-path product code is replaced.

sdk/x402.ts handles exact payments and explicitly refuses escrow-v1. Calling it for this run would exercise the wrong payment scheme; this harness uses its documented escrow service instead. The loopback server is a test harness around the real product purchase and Store boundaries; it does not execute the agent question/LLM loop.

No premium bytes leave the product Store before the grant; every receipt includes audit sequence ordering. Budget policy authorizes each intent. Each intent retains one create signature across recovery. Resource IDs, signed manifests and source URLs refer to the actual local team-authored article; no answer or invented citation is generated. XRP/SGD conversion uses the product's labelled Testnet rate of 1,000 drops per minor SGD unit, not a market exchange rate. No product defaults, gates, test thresholds, or client bundle are changed.

## Receipt schema for the feed

[receipts.jsonl](../../../data/evidence/testnet-1000/receipts.jsonl) is UTF-8 JSONL, one complete terminal purchase per line, completion order, below 2 MB. Consumers should ignore an incomplete trailing line while a run is active, deduplicate by intentId, and count outcome=success. [summary.json](../../../data/evidence/testnet-1000/summary.json) is a derived aggregate.

[feed.json](../../../data/evidence/testnet-1000/feed.json) is the separate public-feed-v1 projection consumed by /api/feed/recorded. Its 1,000 rows use team-authored writer badges; its label distinguishes independent ledger checks from locally observed delivery. time is the first observed create validation, and settlementSeconds spans observed create to finish validation. The report regenerates this export only with a matching successful independent verification and the private hash-only timing journal.

| Fields | Meaning |
|---|---|
| schemaVersion, network | 1, xrpl-testnet |
| intentId, resourceId | Stable purchase ID and article ID |
| priceMinor, priceCurrency, asset, amountDrops | Integer minor SGD units, SGD, XRP, integer ledger drops as string |
| payer, payee | Public classic addresses |
| createHash, createLedger, createSequence | EscrowCreate hash, validated ledger, account sequence |
| finishHash, finishLedger | EscrowFinish hash and validated ledger |
| condition, fulfillmentSha256, fulfillmentHashMatch | Serialized crypto-condition, SHA-256 of full serialized fulfillment bytes, checked preimage match |
| grantAt, firstReadPaidAt | Product audit ISO timestamps (may be equal within one millisecond) |
| grantSeq, firstReadPaidSeq | Product audit sequence; grantSeq must be smaller |
| createMs, finishMs | First submit start to first successful validated tx lookup; local observation includes polling, node latency and any crash/restart downtime |
| endToEndMs | Intent start to receipt collection; includes recovery downtime if interrupted |
| outcome, failureCause, retries | success/failure, null or failure reason, purchase reconciliation retries |

Transaction fields can be null on a failed attempt. RPC retry details remain in the private hash-only journal; purchase retries count calls to resume the same pending intent, not new charges.

## Sample transactions

${sample}

The live recovery test intentionally killed the runner with eight intents pending. All eight recovered on the next invocation; five already-submitted creates retained their original hashes and three not-yet-signed intents proceeded once; [recovery.json](../../../data/evidence/testnet-1000/recovery.json) records those intents and transaction hashes. The final independent account-history scan checks for any omitted or duplicate creates.

The main batch's purchase hashes are in receipts.jsonl; [fresh-pilot.jsonl](../../../data/evidence/testnet-1000/fresh-pilot.jsonl) contains the separate bootstrap sample. [funding.json](../../../data/evidence/testnet-1000/funding.json) and [fresh-funding.json](../../../data/evidence/testnet-1000/fresh-funding.json) record setup payment hashes and observed RPC retries. See docs/BUILDER-FEEDBACK.md for observed friction and the pilot/full-run distinction.
`)
console.log(JSON.stringify(summary))
