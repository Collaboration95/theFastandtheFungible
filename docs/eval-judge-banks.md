# Frozen judge-bank measurements

Build a portable MCP tgz with the release artifact pipeline (`node scripts/release-artifacts.mjs`, after `npm run build:sdk`). Pass its path as the sole positional argument. Fixture research/decision models, real XRPL Testnet settlement, faucet funds only; no `.env` is loaded. Each fresh run provisions private state; keep it for reconciliation and never commit wallets.

```sh
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v1.json JUDGE_OUT_DIR=/tmp/p0-v1 npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v3-dev.json JUDGE_OUT_DIR=/tmp/p0-dev npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v3-negatives.json JUDGE_OUT_DIR=/tmp/p0-negatives npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
```

Held-out: substitute `eval/questions/judge-xrpl.v3.json` and a fresh output directory **only for the single authorised later measurement**, after calibration is frozen. P0 does not execute it. v2 is previously observed, not held-out.

`results.json` records SHA-256 of the exact bank bytes and tgz, per-question outcomes, summary counts and value histograms. `values.jsonl` contains every decision row in every round, including repeated candidates: question, writer/article/source/version, relevance, raw judgment (addressesGap, originality probabilities, credibility), gapMaterial, trust, calibrated/marginal components if present, recorded value, threshold, verdict and reason. Values are copied from decisions, not recomputed. Histograms label positive-bank questions “relevant” and `expect: no_purchase` questions “negative”; these are bank groups, not human candidate-relevance annotations. Bins are left-inclusive and right-exclusive, except the final bin includes 1. Zero-candidate questions have no rows.

`buyAndCite n/N` counts questions citing verified purchases, including unexpected purchases on negatives. `answersIt n/N` uses only questions with a nonblank frozen gold phrase (v1/v2 therefore report 0/0, unavailable). The pure scorer receives the displayed `leadFinding` text and its claim citations, checks the first two sentences for the case-insensitive, whitespace-normalised gold phrase, and requires a citation to a delivered span from a verified purchase in those sentences. It does not infer correctness from a conclusion. Test with `npx vitest run tests/judge-bank-scorer.test.ts`.

`negativeBuys n/N` counts negative questions with any recorded purchase, including settled/refunded/uncited purchases; zero is required. Blank answers, unfinished runs, receipt verification failures and hard-gate violations still fail after saving measurements. Positive misses are measurements, not runner failures. The old 12/20 buy-and-cite acceptance assertion is available explicitly with `JUDGE_ACCEPTANCE=1` (requires a 20-question bank); no policy threshold or timeout changes.

Optional: `J1_STATE_DIR=/private/path` retains a chosen state location; resume with the same state and output directory plus `J1_RESUME=1`. Resume requires matching bank/artifact hashes and the new value-row format. `JUDGE_INTENT_PREFIX` customises intent keys (default `j1-`). Use separate output/state directories per bank; do not re-run held-out as a smoke test.
