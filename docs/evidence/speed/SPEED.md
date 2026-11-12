# Settlement speed

**30 purchases before and 30 after: quote-to-unlock p50 14.065 → 13.302 s (5.4% lower); p90 17.411 → 14.684 s (15.7% lower). All 60 purchases and portable receipts verified.** This is local fixture-content XRP Testnet settlement, not hosted end-to-end answer latency.

## Method

`PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH OFFSET=900 node --import tsx scripts/speed/measure.ts before`

The harness uses the existing Testnet provisioner, local HTTP writer and policy-only PurchaseManager. Fixture article and no model calls; real XRP Testnet escrow transactions. No hosted measurements. Quote, buyer submission, buyer validation, writer lock proof, writer finish submission, buyer finish validation and verified unlock are observations on the same host, not ledger consensus timestamps. Missing phases remain absent. Each sample verifies its portable receipt offline. Setup/faucet and full answer generation are excluded. Raw observations and transaction hashes are written after each sample.

`SETTLEMENT_TIMING=1` opts into additive timing fields and audit observations (default off). Timing is diagnostic; it does not authorize spending, unlock content or prove validation.

The first batch stopped cleanly after 10 purchases at the default wallet daily cap (the next intent was SKIPPED before signing). The benchmark alone now sets WALLET_DAILY_CAP_MINOR=10000 to authorize the specified 30 samples, and resumes at sample 11; no production cap or test was relaxed. The first broad check also hit host-load watchdog noise while other lanes ran. Subsequent full Node 22 verification passed under the heavy lock.

## Phase distributions

Nearest-rank p50/p90 of successive phase differences, seconds. Total percentiles are calculated from each sample total, not summed phase percentiles.

| Phase | before p50 / p90 (s), n=30 | after p50 / p90 (s), n=30 |
|---|---|---|
| Quote | 0.419 / 0.480 | 0.428 / 0.448 |
| Create preparation → submit | 1.480 / 1.610 | 1.055 / 1.181 |
| Create submit → validated | 5.668 / 5.935 | 5.294 / 6.221 |
| Validated create → writer lock proof/grant | 0.847 / 0.935 | 0.640 / 0.698 |
| Writer preparation → finish submit | 1.446 / 1.620 | 1.057 / 1.185 |
| Finish submit → validated | 4.302 / 7.214 | 4.721 / 6.053 |
| Key/body verification → unlocked | 0.004 / 0.006 | 0.004 / 0.005 |
| Quote start → verified unlock | 14.065 / 17.411 | 13.302 / 14.684 |

## Raw evidence

`before.json` holds all 30 create/finish transaction hashes (60 transactions), their validated ledger indexes and per-phase observation timestamps. Run `node scripts/speed/summarize.mjs` to recompute. This measures a local fixture writer with XRP Testnet escrows, not the hosted full answer runtime or TEST-SGD IOU path. The baseline uses the original 1 s payer/lock waits and 250 ms finish lookup loop, with additive timing only. No Testnet substitution was used. Setup signed funding transactions are not purchase samples.

The writer lock/grant and finish-submit observations are writer-reported and persisted before the first submit attempt. Buyer submission marks likewise denote the start of the submit attempt, not an acceptance acknowledgement. Other marks are buyer observations after checking the exact transaction or delivery. Independent host clocks can skew; these samples share one host. Timing is hash-chained observer evidence, not a ledger-certified duration.

## Stream path and safety

Reproduce after: `PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH OFFSET=900 XRPL_STREAM_WAITS=1 node --import tsx scripts/speed/measure.ts after`.

`XRPL_STREAM_WAITS=1` (default off) subscribes to validated transaction and ledger streams on the existing Testnet WebSocket before signing. The validated transaction payload/meta is retained in a bounded 512-entry cache; proposed or incomplete events never qualify. Matching transaction events wake their waiter; ledger events wake readers, including when the ledger event arrives before the transaction event. Disconnect/refused subscriptions poll and reconnect; a silent stream has a bounded watchdog and the existing operation deadline. No new transaction is signed by a waiter. LastLedgerSequence expiry still requires the original validated-before-lookup account-sequence proof.

The optimized signer shares one fresh validated account read between reserve calculation and sequence autofill, after the wallet queue resolves the preceding signature. It never guesses or increments a speculative sequence. Fee and current-index reads coalesce for at most 750 ms; fee ceilings, network guard, dry-run veto, reserve holds and finish pre-checks remain. A freshly submitted create is not immediately resubmitted; durable recovery may resend only the same persisted blob/hash.

After diagnostics: 30/30 samples ended with an active subscription; one subscription, zero subscription failures, 178 validated cache hits. No live disconnect was observed. Reordering, duplicate/proposed events, refused subscription, disconnect, never-arriving events, a hung RPC, expiry with and without sequence consumption, cache expiry/failure and signing guards are exercised by fake-ledger tests. The full integration observes exactly one create submit and one writer finish submit, no `tx` RPC, one receipt and no premium grant before validation. These are synthetic adversarial tests, not Testnet incident claims.

[XRPL subscription contract](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) distinguishes proposed messages from validated messages with metadata. Raw after timestamps, all 60 after hashes and diagnostics are in `after.json`. The comparison contains 120 escrow hashes. `after-initial.json` retains the earlier 30-purchase optimized batch (p50 13.189 s / p90 13.996 s) measured before transaction wakeups were filtered by matching hash. After that final code change, all 30 optimized purchases were rerun as `after.json`; no samples were discarded. Across all three batches there are 90 purchases and 180 escrow hashes, all with successful offline receipts. Neither models nor hosted infrastructure were exercised.

## Limits of the comparison

These sequential batches share one Mac, endpoint, fixture article and wallets, with no concurrent sample submissions. Other lanes were using the host; this is not a randomized or isolated network experiment. Baseline resumed after a safe daily-cap refusal (two process starts); after used one start. Public-ledger close phase and regional RPC latency vary. Finish submit-to-validation median rose 4.302 → 4.721 s, while its p90 fell 7.214 → 6.053 s. Create submit-to-validation p90 rose 5.935 → 6.221 s; not every phase improved. Per-phase p50/p90 are not additive. The smaller total tail is observed here and does not establish a hosted 58 s → 14 s improvement. No mainnet claim, deployment or threshold relaxation.
