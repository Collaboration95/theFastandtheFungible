# Settlement speed

Baseline: **30/30 verified Testnet purchases, p50 14.065 s / p90 17.411 s quote-start to verified unlock**. All 30 portable receipts passed offline verification. The optimized measurement is pending; no speedup is claimed yet.

## Method

`PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH OFFSET=900 node --import tsx scripts/speed/measure.ts before`

The harness uses the existing Testnet provisioner, local HTTP writer and policy-only PurchaseManager. Fixture article and no model calls; real XRP Testnet escrow transactions. No hosted measurements. Quote, buyer submission, buyer validation, writer lock proof, writer finish submission, buyer finish validation and verified unlock are observations on the same host, not ledger consensus timestamps. Missing phases remain absent. Each sample verifies its portable receipt offline. Setup/faucet and full answer generation are excluded. Raw observations and transaction hashes are written after each sample.

`SETTLEMENT_TIMING=1` opts into additive timing fields and audit observations (default off). Timing is diagnostic; it does not authorize spending, unlock content or prove validation.

The first batch stopped cleanly after 10 purchases at the default wallet daily cap (the next intent was SKIPPED before signing). The benchmark alone now sets WALLET_DAILY_CAP_MINOR=10000 to authorize the specified 30 samples, and resumes at sample 11; no production cap or test was relaxed. The first broad check also hit host-load watchdog noise while other lanes ran. Subsequent full Node 22 verification passed under the heavy lock.

## Phase distributions

Nearest-rank p50/p90 of successive phase differences, seconds. Total percentiles are calculated from each sample total, not summed phase percentiles.

| Phase | before p50 / p90 (s), n=30 | after (pending) |
|---|---|---|
| Quote | 0.419 / 0.480 | pending |
| Create preparation → submit | 1.480 / 1.610 | pending |
| Create submit → validated | 5.668 / 5.935 | pending |
| Validated create → writer lock proof/grant | 0.847 / 0.935 | pending |
| Writer preparation → finish submit | 1.446 / 1.620 | pending |
| Finish submit → validated | 4.302 / 7.214 | pending |
| Key/body verification → unlocked | 0.004 / 0.006 | pending |
| Quote start → verified unlock | 14.065 / 17.411 | pending |

## Raw evidence

`before.json` holds all 30 create/finish transaction hashes (60 transactions), their validated ledger indexes and per-phase observation timestamps. Run `node scripts/speed/summarize.mjs` to recompute. This measures a local fixture writer with XRP Testnet escrows, not the hosted full answer runtime or TEST-SGD IOU path. The baseline uses the original 1 s payer/lock waits and 250 ms finish lookup loop, with additive timing only. No Testnet substitution was used. Setup signed funding transactions are not purchase samples.

The writer lock/grant and finish-submit observations are writer-reported and persisted before the first submit attempt. Buyer submission marks likewise denote the start of the submit attempt, not an acceptance acknowledgement. Other marks are buyer observations after checking the exact transaction or delivery. Independent host clocks can skew; these samples share one host. Timing is hash-chained observer evidence, not a ledger-certified duration.
