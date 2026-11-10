# K4 development evidence — 11 November 2026

Local development measurements, **fixture models and SIMULATED payments**. This
is not Testnet, live-model, hosted, production or held-out acceptance. Every
question and miss is retained; neither scorer nor gold phrases were changed.

## Before / after

Both sides use the merged C3 (#425) and C4 (#437) corpus, with identical bank
hashes and no corpus edits by K4. Baseline: `cbfc63ab8432b2b3d8c663fc7875c1d1cf963023`.
After: `ff87ea21d36946d8744bf29651cb0cd64657e367`, with HU (#438), site/README and release-policy (#433) integrations after that corpus baseline. Hosted
execution is off. Corpus/writer bytes are identical between these sources.
These matched local baselines differ from K3's earlier published runs.

| Development bank | Buy and cite before → after | Lead `answersIt` before → after | Negative purchases |
| --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a: no gold strings | n/a |
| v3 (20) | 14 → 20 | 5 → 13 | n/a |
| v3-dev (20) | 10 → 16 | 2 → 4 | n/a |
| v3-negatives (10) | 2 → 0 | n/a | 2 → **0** |

All 79 runs on each side (70 bank questions, three legacy UC runs, three
frozen-requirement UC runs and three public presets)
finished DONE. **Zero gate violations and zero offline verification failures**
on both sides. All ten final negative leads are empty, including the fixed-deposit
and Tokyo-tourism wrong buys. The Singapore Grand Prix mismatch and maximum-model-
confidence finality/wallet-controls rejection also have synthetic policy tests.

Both legacy and frozen-requirement UC1–UC3 keep identical candidate identities,
judgments, values, verdicts,
selected purchases and refund outcomes. Gross spending stays **0 / 90 / 70 SGD
minor units**, with the UC3 refund still 30. UC1's entire decision table is
identical. Some rejected UC2/UC3 rows now explain the topic guard instead of a low
score; no policy field changes. Legacy and frozen-requirement lead regressions also pin the meeting
decision, the revised analyst margin estimate, and the complete lead-time change. See `uc-policy-comparison.json` and
`comparison.json` for the exact comparison and explanation changes.

The three public preset lead goldens remain substantive assertions: RLUSD starts
with **AllowTrustLineLocking**; x402 starts with its payment headers; reserves
starts with the dated XRP amounts and network qualifier. The x402 snapshot was
re-pinned for the C4 delivered header passage. No old failure threshold was
changed.

## Reproduction and retained evidence

Use `scripts/k4-dev-measure.ts <output-directory>` with `OFFSET=2000`,
`LLM_PROVIDER=fixture`, `DECISION_PROVIDER=fixture`, `SETTLEMENT_RAIL=simulated`,
`SEARCH_EMBEDDINGS=off`, and `LANGFUSE_ENABLED=0`. It starts the actual local
publisher and engine on an ephemeral port, records decisions and receipts, then
runs the canonical lead scorer, gate auditor and offline answer verifier. The
same harness was copied into the baseline archive without product changes.

- `before-summary.json`, `after-summary.json`: every result, lead and raw miss.
- `bank-hashes.json`, `sources.json`: input/source identities and archive digest.
- `before-runs.tar.gz`, `after-runs.tar.gz`: complete runs, receipt bundles and verifier output.
- `comparison.json`: bank changes and full UC decision explanation comparisons.
- `uc-policy-comparison.json`: all UC policy fields, ignoring only explanation
  strings and origin-bound selected-source keys.

The glossary also normalizes fixture metadata overlap and XRP/XRPL entity aliases;
finance fixture scoring and retrieval retain their old path. Model scores remain
fixtures, not a qualification of a live decision model. No price, trust, value,
budget, leak or hard-gate threshold was reduced.

Full gates use the mandatory shared lock. Per the owner's 11 November correction,
I/O-bound Testnet judge banks do not hold it. This lane's measurements use local
fixtures, not a Testnet bank runner.

## Held-out boundary and gate exception

v4/v5 questions were never opened, read or evaluated. `RA_DEV_BANKS_ONLY=1` skips
`tests/judge-bank-v5.test.ts`, whose schema reader opens those questions. The
private gate checkout replaces their content and raw held-out evidence packets
with empty existence markers;
helper scanning refuses those paths and cache inputs retain Git blob identities.
The facts generator uses committed public aggregates for held-out values, never
the raw result files that include question text. Other fact derivation and
presentation-marker checks remain enabled. The receipt/cache identity records
this restriction. Default gate behavior is
unchanged; engine, proof, policy, browser and hard-gate tests remain enabled.

## Remaining misses

Canonical v3 misses: V02, V05, V06, V08, V11, V15, V16. Canonical v3-dev misses: D01, D02, D03, D05, D06, D07, D08, D09, D10, D11, D12, D13, D14, D16, D17, D18. Some leads express the concept without the exact gold string, while
others still select an incomplete passage or lack a covering source. These remain
failures; no synonym credit was added to the scorer. Corpus additions belong to
other lanes. Live-model/Testnet acceptance belongs to the acceptance lane.

A12 is covered by tampered free-proof regressions (passages, salts, counts,
identity, wallet, signature, federation). A16's truthful per-passage provenance
was already shipped in K3 and remains covered by mixed-source report tests.
