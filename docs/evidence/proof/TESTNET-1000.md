# Checkable XRPL Testnet purchases

1,000 successful purchases / 1,000 recorded attempts (100.00%); **1,000 independently verified**. Principal: 40 Testnet XRP (40000000 drops). Transaction fees are separate in the verifier output. These are deterministic repeat purchases of team-authored content from fresh test accounts, not independent customers or writers. No LLM or hosted deployment was used.

The purchase batch ran against product revision 5a132431c448b5834c5761968ac8c5cbcb0c350b. [run.json](../../../data/evidence/testnet-1000/run.json) pins that revision and the public article metadata used by the recorded feed.

| Phase (local observations) | p50 | p90 | p99 |
|---|---|---|---|
| createMs | 5.955 s | 6.635 s | 8.073 s |
| finishMs | 4.813 s | 6.401 s | 7.772 s |
| endToEndMs | 20.339 s | 22.592 s | 33.578 s |

Failures by cause: none in the recorded purchases. Pending or interrupted purchases are never counted as successes. The target remains 1,000 until the committed count reaches it.

## Verify yourself

From this checkout, with dependencies installed and Node 22:

```sh
npm run proof:testnet-verify
```

This re-fetches both transactions for every receipt from a public Testnet node, checks validated tesSUCCESS, PREIMAGE-SHA-256, the fulfillment digest, amount, destination, owner and sequence, and the on-ledger intent/resource memo. It scans payer account history for omitted or duplicate successful EscrowCreates and compares the ledger principal total with receipt totals. It writes [the machine-readable result](testnet-1000-verify.json) and exits nonzero on any mismatch. There are no product-code imports in the verifier. The verifier checks local grant/read fields for consistency; XRPL does not independently attest application read timestamps. It checks all retained history of the fresh payer accounts through a pinned validated ledger at verification time, including before the first listed receipt.

## Reproduce and resume

```sh
npm run proof:testnet-run -- --testnet --count 20 --state /tmp/testnet-proof-new --receipts /tmp/testnet-proof-new/receipts.jsonl
npm run proof:testnet-run -- --testnet --count 1000 --state /tmp/testnet-proof-new --receipts /tmp/testnet-proof-new/receipts.jsonl
npm run proof:testnet-verify -- --receipts /tmp/testnet-proof-new/receipts.jsonl --out /tmp/testnet-proof-new/verify.json
npm run proof:testnet-test
```

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

- t1000-1794473867744-0001: [create F85E7DD2C8ECBD04889AC8967BBC0A2F7ACE81D1D422609B6A502C61C64A835C](https://testnet.xrpl.org/transactions/F85E7DD2C8ECBD04889AC8967BBC0A2F7ACE81D1D422609B6A502C61C64A835C), [finish 80CA9323E648F68797B8448103E4C33216F00187416815597FC03DEB67AF693A](https://testnet.xrpl.org/transactions/80CA9323E648F68797B8448103E4C33216F00187416815597FC03DEB67AF693A).
- t1000-1794473867744-0002: [create C42C753152DF50B6113E4A64CEFA595E64A1E33F6AD727D808163DF655EFE2A3](https://testnet.xrpl.org/transactions/C42C753152DF50B6113E4A64CEFA595E64A1E33F6AD727D808163DF655EFE2A3), [finish 7FB693078E807B7733DD32917068884E7312A25C3B61CEFAC123A916DA4C7609](https://testnet.xrpl.org/transactions/7FB693078E807B7733DD32917068884E7312A25C3B61CEFAC123A916DA4C7609).
- t1000-1794473867744-0003: [create 380F0B0C79E17BF4DDC50223BED2B5F186B99EA6FD359E7B4612356E75A0F910](https://testnet.xrpl.org/transactions/380F0B0C79E17BF4DDC50223BED2B5F186B99EA6FD359E7B4612356E75A0F910), [finish 03CF1667C785D95949B438C5B2E03C20A9F383E2D86E7F6D76C60EE67391EC51](https://testnet.xrpl.org/transactions/03CF1667C785D95949B438C5B2E03C20A9F383E2D86E7F6D76C60EE67391EC51).
- t1000-1794473867744-0005: [create 29B7746D7B32B321CEB9E1D25ABC806BC226AECA74AACFF39901B724140B038A](https://testnet.xrpl.org/transactions/29B7746D7B32B321CEB9E1D25ABC806BC226AECA74AACFF39901B724140B038A), [finish D4E0C06504A8F26CD4981A16F3372A5573293D4EBA7F15FA5E3D6CB1FA888F22](https://testnet.xrpl.org/transactions/D4E0C06504A8F26CD4981A16F3372A5573293D4EBA7F15FA5E3D6CB1FA888F22).
- t1000-1794473867744-0004: [create 88E234C11A310411B3AC281D9B490AC6B973F194D0849581A4C8DB51CC348F1F](https://testnet.xrpl.org/transactions/88E234C11A310411B3AC281D9B490AC6B973F194D0849581A4C8DB51CC348F1F), [finish C098613ADEB7BBE7D664D9B4A592680B0D856A4078E6AC8F8D67E9C1A431C150](https://testnet.xrpl.org/transactions/C098613ADEB7BBE7D664D9B4A592680B0D856A4078E6AC8F8D67E9C1A431C150).

The live recovery test intentionally killed the runner with eight intents pending. All eight recovered on the next invocation; five already-submitted creates retained their original hashes and three not-yet-signed intents proceeded once; [recovery.json](../../../data/evidence/testnet-1000/recovery.json) records those intents and transaction hashes. The final independent account-history scan checks for any omitted or duplicate creates.

The main batch's purchase hashes are in receipts.jsonl; [fresh-pilot.jsonl](../../../data/evidence/testnet-1000/fresh-pilot.jsonl) contains the separate bootstrap sample. [funding.json](../../../data/evidence/testnet-1000/funding.json) and [fresh-funding.json](../../../data/evidence/testnet-1000/fresh-funding.json) record setup payment hashes and observed RPC retries. See docs/BUILDER-FEEDBACK.md for observed friction and the pilot/full-run distinction.
