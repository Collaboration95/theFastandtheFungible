# Frozen judge-bank measurements

Build a portable MCP tgz with the release artifact pipeline (`node scripts/release-artifacts.mjs`, after `npm run build:sdk`). Build it from the same checkout as the runner so lead selection matches the product. Pass its path as the sole positional argument. Fixture research/decision models, real XRPL Testnet settlement, faucet funds only; no `.env` is loaded. Each fresh run provisions private state; keep it for reconciliation and never commit wallets.

```sh
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v1.json JUDGE_OUT_DIR=/tmp/p0-v1 npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v3-dev.json JUDGE_OUT_DIR=/tmp/p0-dev npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v3-negatives.json JUDGE_OUT_DIR=/tmp/p0-negatives npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
```

Development only: v1, v2, v3, v3-dev, v3-negatives, v4 and v4-negatives are observed development banks. Never report v3 or v4 as held-out again.

Used (historical): `eval/questions/judge-xrpl.v4.json` and `eval/questions/judge-xrpl.v4-negatives.json` were the single-use held-out banks and were measured once on 7 Nov (see `docs/evidence/v4-heldout/README.md`). They are now development data: never report v4 as held-out again.

`JUDGE_BUDGET_SGD` (default 2) sets the per-question budget passed to `ask_expert`; `0` gives the free-only arm used once for v5 (see `evidence/v5-heldout/README.md`).

Single-use held-out: `eval/questions/judge-xrpl.v5.json` (20 positives) and `eval/questions/judge-xrpl.v5-negatives.json` (10 `no_purchase` negatives), frozen 10 Nov and written blind to the corpus, writers, evidence, explainers and team notes. Implementers must never open, read or execute either file. After the coverage and answer-quality lanes have landed and the artifact is frozen, the orchestrator alone runs the single authorised measurement, with fresh private state/output directories per bank. Do not use these banks for smoke tests, threshold selection or retries with a changed policy. `tests/judge-bank-v5.test.ts` pins the hashes and checks the schema without running the bank.

| File | SHA-256 of the exact bytes |
| --- | --- |
| `judge-xrpl.v5.json` | `1095c9fac057a85ee59a34a63cb72ea69a0ec909f430c845357958bf38c1701b` |
| `judge-xrpl.v5-negatives.json` | `a381c46f85676bce13c8f9183370fe4989cc9f38c50dd118702c48bb55067c4b` |

`results.json` records SHA-256 of the exact bank bytes and tgz, per-question outcomes, summary counts and value histograms. `values.jsonl` contains every decision row in every round, including repeated candidates: question, writer/article/source/version, relevance, raw judgment (addressesGap, originality probabilities, credibility), gapMaterial, trust, calibrated/marginal components if present, recorded value, threshold, verdict and reason. Values are copied from decisions, not recomputed. Histograms label positive-bank questions “relevant” and `expect: no_purchase` questions “negative”; these are bank groups, not human candidate-relevance annotations. Bins are left-inclusive and right-exclusive, except the final bin includes 1. Zero-candidate questions have no rows.

`buyAndCite n/N` counts questions citing verified purchases, including unexpected purchases on negatives. `answersIt n/N` uses only questions with a nonblank frozen gold phrase (v1/v2 therefore report 0/0, unavailable). The pure scorer receives the displayed `leadFinding` text and its claim citations, checks the first two sentences for the case-insensitive, whitespace-normalised gold phrase, and requires a citation to a delivered span from a verified purchase in those sentences. It does not infer correctness from a conclusion. Test with `npx vitest run tests/judge-bank-scorer.test.ts`.

`negativeBuys n/N` counts negative questions with any recorded purchase, including settled/refunded/uncited purchases; zero is required. Blank answers, unfinished runs, receipt verification failures and hard-gate violations still fail after saving measurements. Positive misses are measurements, not runner failures. The old 12/20 buy-and-cite acceptance assertion is available explicitly with `JUDGE_ACCEPTANCE=1` (requires a 20-question bank); no policy threshold or timeout changes.

Optional: `J1_STATE_DIR=/private/path` retains a chosen state location; resume with the same state and output directory plus `J1_RESUME=1`. Resume requires matching bank/artifact hashes and the new value-row format. `JUDGE_INTENT_PREFIX` customises intent keys (default `j1-`). Use separate output/state directories per bank; do not re-run held-out as a smoke test.

The consolidated runner extracts the packed tgz and launches Node directly (including on resume); the app/MCP/try release consumers still install through npx with a fresh session cache. The audit corpus is loaded once per bank. Retired r5-k runner/scorer commands remain reproducible at the complete `b0a67ffa` tree; see `evidence/r5-k/README.md`. Their historical thresholds and result formats are not defaults for new measurements.
