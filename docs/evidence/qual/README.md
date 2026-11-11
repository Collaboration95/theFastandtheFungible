# QUAL: final-sprint answer quality, 11 November 2026

Development regression evidence only. Fixture decisions, keyword search and simulated payments; the preset acceptance uses live DeepSeek planning and writing on a local `HOSTED=1` stack. No public hosted questions or ledger writes.

Preset acceptance stubs the local hosted-readiness callback healthy; HG and deployed-edge readiness are outside this evidence.

The inherited lead, gap and ranking fixes are completed with product word-form scoring, complete escrow comparison/submitter sentences, source-order leads and pinned tests. New team-authored explainers cover channels versus escrow and accepting x402 XRP payments. Preset text is unchanged.

`ledger-readonly.json` rechecks both networks: server_info reserves, RLUSD issuer flags and TokenEscrow status. `read-ledger.mjs` is read-only. The corpus pin records the intended four rewrites and two additions; historical pins remain unchanged.

Acceptance: six fresh live preset asks, six single-article purchases at S$0.40; median scope-through-answer time 4.259 → 3.827 seconds. The wheel (18 passed, 0 failed) and TS CLI from the published v1.1.1 release verify the exact saved simulated preset export. No limits changed. The first acceptance attempt kept one visitor for six questions and correctly hit HTTP 429 on the sixth scope; the successful acceptance uses two visitors, three questions each. Both arms preserve writer-guard fallbacks on reserves. Partial failed-attempt records are retained.

The A5 recorded modal plan buys the escrow explainer and no-show guide (S$0.80), while its shorter run plan buys only the escrow explainer (S$0.40). Both lead with the difference and who may submit; C1 buys only the writer-paid guide and closes its verbose requested fact. B1's modal wording retains an unanswered best-practices request that its narrow lead does not answer. These are explicit limits, not new held-out claims.

Loosened: word-form topic matching includes buy/spend; product fixture scoring uses normalized forms. Display-only long requested facts close at half the fact words (minimum three), ignoring planner framing including between, with quantity and legacy strict safeguards. The stored coverage judgment and conflicts are preserved. Intended corpus/lead snapshots change; no gate, buy threshold, spending cap or leak budget changes.

Clean-head merge admission is published as the PR local-gate status; check:fast and gate run under the shared heavy lock. See ../r10-presets/ for fresh live preset evidence and published-verifier results.

## Used-bank regression

Fixture research/decisions, simulated settlement, same banks and scorer as R9-C; 109 runs per arm. Before main `bd52beff`; final implementation after.

| Bank | N | Buy/cite | Key-fact leads | Negative purchases | Articles/buying run | Three buys | S$ spend | Median ask ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v1 | 20 | 19 → 19 | 0 → 0 | 0 → 0 | 1.00 → 1.00 | 0 → 0 | 7.60 → 7.60 | 74.4 → 72.5 |
| v3 | 20 | 20 → 20 | 18 → 18 | 0 → 0 | 1.45 → 1.40 | 1 → 1 | 11.60 → 11.20 | 102.2 → 79.7 |
| v3-dev | 20 | 18 → 18 | 9 → 11 | 0 → 0 | 1.17 → 1.22 | 0 → 0 | 8.40 → 8.80 | 83.3 → 81.0 |
| v3-negatives | 10 | 0 → 0 | 0 → 0 | 0 → 0 | 0.00 → 0.00 | 0 → 0 | 0.00 → 0.00 | 17.4 → 17.0 |
| v5 | 20 | 20 → 20 | 18 → 18 | 0 → 0 | 1.25 → 1.15 | 1 → 1 | 10.00 → 9.20 | 77.6 → 69.1 |
| v5-negatives | 10 | 0 → 0 | 0 → 0 | 0 → 0 | 0.00 → 0.00 | 0 → 0 | 0.00 → 0.00 | 21.0 → 13.8 |
| uc | 3 | 2 → 2 | 0 → 0 | 0 → 0 | 1.50 → 1.50 | 0 → 0 | 1.60 → 1.60 | 139.9 → 139.9 |
| uc-frozen | 3 | 2 → 2 | 0 → 0 | 0 → 0 | 1.50 → 1.50 | 0 → 0 | 1.60 → 1.60 | 142.8 → 147.1 |
| presets | 3 | 3 → 3 | 0 → 0 | 0 → 0 | 1.33 → 1.00 | 0 → 0 | 1.60 → 1.20 | 125.7 → 94.6 |

No lost results or key-fact leads. Zero gate violations and zero verifier failures in both arms. Strict UC policy changes: 0/6 (none). Strict full comparison: 26/109 identical. Metrics retain every changed lead/purchase, timing and raw misses. These are used development banks, never a new held-out result.

Reproduce with `LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh npx tsx docs/evidence/qual/dev-measure.ts <output-dir>`. The harness adds per-ask timing to the established K5 runner, without changing its scorer or bank list.
