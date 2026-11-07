# P0 measurement tooling baseline (7 November 2026)

Fixture research/decision models, real XRPL Testnet faucet payments, packed product at `91ae1cdf7b98cfedd8c4774d86c35bbd46851aec` (#401). These measurements precede K/A content and anchor changes and P1 calibration. No product policy, provider formula, threshold or timeout changed. The v3 held-out bank was never executed.

See `summary.json` for exact frozen-bank and tgz SHA-256, per-question outcomes, Testnet transaction links, spending and histograms. `values-v1.jsonl` and `values-negatives.jsonl` retain every recorded candidate decision in every round. These contain public candidate identities and recorded numeric components/reasons; paid passages and private wallet/journal state are excluded. Private state and full receipts remain in the local acceptance store and `/tmp/p0-{v1,negatives}` for reconciliation.

Commands use the documented runner with `JUDGE_BANK=eval/questions/judge-xrpl.v1.json` and `judge-xrpl.v3-negatives.json`, separate `JUDGE_OUT_DIR=/tmp/p0-{v1,negatives}`, `RA_ACCEPT_TESTNET=1`, and `/tmp/researchagent-mcp-1.0.0.tgz` as the sole argument. The tgz was built locally with `npm run build:mcpb`, the release pipeline's `bin.mjs`/package-bin setup, and `npm pack ./dist/mcpb --pack-destination /tmp`. It exercises the packed stdio Testnet path; it is not a new release or live-model measurement.

The final runner summary is also exercised with explicit resume against each original private state: completed questions are skipped, so there is no additional product measurement or purchase. Buy-and-cite totals include unexpected purchases on negatives. `answersIt 0/0` means unavailable: neither v1 nor negatives has frozen positive gold phrases. Scorer correctness is checked by eight unit tests rather than inventing gold phrases after observing answers.

Both smoke runs preserve failure exits. The negative bank buys for N03 (Singapore fixed deposits) and N08 (Tokyo travel); all eight other negative questions abstain but fail online receipt verification because this product revision lacks abstention anchors. Missing anchors remain verification failures, separate from the five-hard-gate audit. P0 does not repair these owning-lane behaviors.

Histogram groups follow bank expectation, not independently annotated candidate relevance. Counts include repeated candidates in later rounds. Ranges are [0,.05), [.05,.1), [.1,.15), [.15,.2), [.2,.3), [.3,.5), [.5,1]. P1 must use these failures as evidence and retain the separate single held-out run reservation.

Measured outcomes:

| Bank | Buy-and-cite | answersIt | negativeBuys | Online verification | Gross spend (SGD minor) |
|---|---:|---:|---:|---:|---:|
| v1 dev | 16/20 | 0/0 (no gold) | 0/0 | 16/20 | 720 |
| v3 negatives | 2/10 | 0/0 (no gold) | 2/10 | 2/10 | 40 |

Zero blanks and zero five-hard-gate audit violations in both banks. Gross displayed spend is S$7.20 and S$0.40 respectively, paid entirely in faucet Testnet XRP; this is not real-money expenditure. Anchor/transaction fees are recorded separately in receipts.

Relevant-question decision values: 214 rows, range 0.00003859–0.46539347; histogram counts 153, 25, 12, 4, 5, 15, 0 in the bins above. Negative-question values: 26 rows, range 0.00001433–0.28072424; counts 24, 0, 0, 0, 2, 0, 0. There are 20 relevant-bank rows and 2 negative-bank rows at or above the existing 0.20 threshold. These are candidate rows, not question-level purchase counts.

Verification failures remain 4/20 on v1 and 8/10 on negatives, all on abstentions. The negative purchases already violate P1's zero-negative-buy target at the unchanged current policy; this tooling PR makes no calibration claim. `npm run check:fast` passes (162 test files; 1,376 passed, one skipped; chaos smoke zero invariant violations). The runner was also typechecked standalone because scripts are not all included by the root tsconfig.
