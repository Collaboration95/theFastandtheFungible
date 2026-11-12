> Superseded attempt report. Seven paid rows below suffered provider HTTP errors and do not count as completed evaluation results. See EVALUATION.md and provider-pause.json for current eligibility. All original raw artifacts remain immutable.

# Real-profile paired evaluation — 12 November 2026

**400/400 completed · 0 gate violations · 999/999 citations valid.** Live DeepSeek Flash planning/writing, local BGE-small retrieval, policy-rule buying, real corpus and public docs. Settlement is simulated; no XRPL transaction was submitted. Ten original phrase-collision flags were retained across six paid fixtures; the zero above is the final version-matched audit result, including three legitimate historical v1 purchases.

| Measurement | Free only, S$0 budget | Free + paid, S$2 budget |
| --- | ---: | ---: |
| Answered, at least one scored fact | 31/200 (15.5%) | 50/200 (25.0%) |
| Correct, all scored facts | 31/200 (15.5%) | 50/200 (25.0%) |
| Correct with no model substitution | 31/200 (15.5%) | 45/200 (22.5%) |
| Valid / total citations | 463/463 | 536/536 |
| Gate violations | 0 | 0 |
| Purchases | 0 | 51 |
| Total article spend | S$0.00 | S$20.40 |
| Median article spend per question, including zero | S$0.00 | S$0.00 |
| Latency p50 / p90 | 6.447 s / 10.767 s | 6.932 s / 12.630 s |
| Planner substitutions / writer fallback events / fixture answer revisions | 0 / 109 / 102 | 6 / 117 / 111 |

Free docs alone answered 15.5%; paid notes lifted it to 25.0% at S$0.00 median spend.

This is a development diagnostic, not an independent holdout or a causal estimate of buying value. Independent live planners and writers ran in each arm; plans were not replayed. Paired correctness: 24 both correct, 26 paid-only correct, 7 free-only correct, 143 neither.

## Question families and bank strata

Regulatory/company-policy questions are explicitly assigned to other; remaining family membership is fixed by the deterministic classifier in `eval/r3-report.py`; exact per-ID assignments are in `r3-real-200/metrics.json`.

| Family | Questions per arm | Free answered / correct | Paid answered / correct |
| --- | ---: | ---: | ---: |
| XRPL docs | 83 | 28/83 (33.7%) / 28/83 (33.7%) | 41/83 (49.4%) / 41/83 (49.4%) |
| x402 | 5 | 2/5 (40.0%) / 2/5 (40.0%) | 2/5 (40.0%) / 2/5 (40.0%) |
| ledger analytics | 0 | unmeasured (n=0) / unmeasured (n=0) | unmeasured (n=0) / unmeasured (n=0) |
| other | 112 | 1/112 (0.9%) / 1/112 (0.9%) | 7/112 (6.2%) / 7/112 (6.2%) |

Ledger analytics was enabled, but this frozen bank contains no direct snapshot/holder/concentration/activity question. That family is unmeasured; protocol questions mentioning an AMM or RLUSD are not live analytics tests.

| Bank stratum | Questions per arm | Free correct | Paid correct |
| --- | ---: | ---: | ---: |
| historical-out-of-profile | 100 | 0/100 (0.0%) | 0/100 (0.0%) |
| protocol-source-facts | 40 | 18/40 (45.0%) | 20/40 (50.0%) |
| protocol-used-judge-bank | 60 | 13/60 (21.7%) | 30/60 (50.0%) |

The 100 historical synthetic-fact controls retain their original golds while their source publishers are excluded by the real profile. Their misses reflect removed coverage. The other 100 questions comprise 60 previously used judge questions and 40 deterministic source-checked protocol specifications. Some historical controls repeat wording: distinct IDs have separate durable admissions, not independent question draws. No gold, threshold, scorer or oracle was tuned after results.

## Purchases, timing and model cost

Spend distribution counts questions, including zero-spend questions:

| Spend per question | Free count | Paid count |
| --- | ---: | ---: |
| S$0.00 | 200 | 157 |
| S$0.40 | 0 | 37 |
| S$0.80 | 0 | 4 |
| S$1.20 | 0 | 2 |

Paid questions with purchases: 43; median among those questions: S$0.40. Purchase price distribution (minor SGD units): `{40: 51}`. Spend is article price, separate from provider cost. Percentiles use the runner's existing lower order statistic, index floor((n−1)×p). Measured on the local Mac while other lanes ran, not isolated hosted timing. Latency includes admission, live planning, retrieval, synthesis, policy rounds and the final audit; any recovered run retains its original start time.

Provider-reported usage priced by the retained ledger: **US$0.333803664** for the full run; initial smoke **US$0.029905788**. This continuation total is US$0.413513934. Cumulative actual cost is US$1.007891616, plus US$0.297412500 reserved for 22 missing-usage calls, for **US$1.305304116 accounted exposure** against the US$4.90 stop. Original exposure was US$0.671020182. New calls: 880, including all four paired smokes (80 additional arm/question runs). The additional three smoke costs are retained in their summaries and included in the continuation total, but excluded from the 400-run cost. These are ledger estimates, not an invoice. No missing usage was counted as free.

The full run also added US$0.220770000 in conservative holds for 14 new missing-usage calls. Reported usage plus those holds is **US$0.554573664** for the 400-run evaluation. The original eight holds remain reserved separately. `model-cost.json` now carries the final cumulative ledger; the original baseline is retained in `r3-real-200/initial-model-cost.json`.

The retained ledger prices DeepSeek Flash using off-peak input miss/hit/output US$0.15/0.003/0.60 per million tokens and twice those rates in its conservative weekday peak windows (01:00–04:00 and 06:00–10:00 UTC). Reservations use input bytes plus overhead and the maximum 3,000-token output at peak rates before network admission.

## Failure taxonomy

The following categories are mutually exclusive, in the diagnostic precedence implemented in `eval/r3-diagnose.ts`; they explain scored misses without changing scores. “Gold not in accessible spans” does not distinguish corpus absence, retrieval misses and policy omissions. “Answer or lead mismatch” means the gold existed in accessible spans but the existing answer scorer missed it; it can include wording/lead-position errors rather than factual error.

| Category | Free | Paid |
| --- | ---: | ---: |
| correct | 31 | 50 |
| excluded-historical-source | 100 | 100 |
| run-failed-or-stopped | 0 | 0 |
| no-answer | 0 | 0 |
| model-substitution | 5 | 7 |
| gold-not-in-accessible-spans | 17 | 8 |
| answer-or-lead-mismatch | 47 | 35 |
| gate-failure | 0 | 0 |

Per-run IDs, receipt counts, prices, intent statuses, source identities, fallback reasons and diagnoses are retained in `r3-real-200/diagnoses.json`. Answered means at least one requested fact matched; correct means all requested facts matched. Historical fact needles must occur in a claim and its cited accessible span. Protocol gold uses the existing first-two-sentence lead phrase check with accessible citations. This is phrase scoring, not expert semantic grading. Citation counts are references, including repeats, rather than unique source counts. Valid citation means accessible-span resolution plus the auditor’s grant checks; URLs were not independently checked for current availability. Fixture-answer counts include every stored answer revision, not only the final answer. The original verified-purchase scorer remains in each result as `paidGoldScore`. Live-only correctness uses the full arm denominator while excluding planner substitutions, writer fallbacks and any fixture answer revision.

## Smoke, provenance and reproduction

The 10-question paired smoke completed 20/20 runs: free 4/10 correct, paid 5/10, 77/77 citations valid, five purchases, zero gate violations. The initial smoke did not expose the later DestinationTag, crypto-condition, OfferCreate-flags, currency-code, payment-channel and AMM fee-unit collisions; six paid fixtures were subsequently corrected, with the oracle unchanged. Three additional ten-question paired smokes after the earlier fixture corrections also passed with zero violations (retained in `r3-smoke-fixed/`, `r3-smoke-final/` and `r3-smoke-complete/`). The frozen master bank is `eval/questions/r3-real.v1.json`, SHA-256 **b5e722d9a004a56f5c5f0ed1078bfb911063100c244e11252459608cb770cb6b**. Smoke reorders the same rows, retains all 200, and limits execution to Q01, Q02, v3-V01, v3-V03, v3-V04, v3-V13, v3-V14, v4-H05, R01, R31. Its exact bank, results and summary are retained in `r3-smoke/`.

Evaluation source commit: `40df715dd9beeb51cf89a1632d1b828f94548e54`. Static corpus SHA-256: `039d8df301d6b28abb275565b7dc6e0b5dcd29ef7389246461cf0283211f57f9`. Generated public-docs index and local model files were copied from the previous model lane and verified against their pinned manifests; all 1,330 static articles received current local vectors before smoke. Two workers per arm, four concurrent questions total, outside the heavy lock. All listeners used ephemeral ports rather than the reserved demo ports. Seven terminal oracle pauses retained 206, 211, 279, 301, 347, 359 and 378 completed results. They exposed ten public-answer phrase collisions across six paid fixtures. All failed attempts and original versions are retained. Each correction rewrote the overlapping wording, added the article's unique canary and bumped its version; the oracle, eight-word threshold and scorers stayed unchanged.

Recovery verifies that only the named fixture changed and re-audits every saved observation. The first four changed fixtures were never purchased or read by a retained run. Three verified purchases of historical v1 payment-channel/AMM notes retain their original bytes, grants and version-specific audits. Recovery carries those versions through subsequent revisions. Every score, run ID and task key is preserved. The final continuation ran only the remaining 22 tasks. Results span these recorded corpus revisions; they are not 400 fresh runs of the final fixture version. Terminal gate errors also triggered a native ONNX teardown abort; those logs remain retained and no completed pair was rerun.

The subsequent shipping checks caught five stale fixture-contract/golden failures: omitted first-passage source attribution, body-only canaries, outdated fact menus and their corpus/promise-label pins. Six new shipping versions restore the unchanged contracts: the canary is inside the fourth passage, the body equals all four passages, and every signed fact cover matches its passage. The five v2 articles become v3; AMM v3 becomes v4. `r3-real-200/evaluated-fixtures.json` preserves the exact pre-shipping bytes; `corpus-golden.json` records both hashes and versions while retaining the previous QUAL pin. The promise-label snapshot intentionally drops only the two claims no longer expressed by those rewritten passages. These post-evaluation authoring/metadata corrections are **not measured by the 400 runs**; no saved observation, score or cost was recomputed.

From the pinned source checkout, symlink the main checkout's `.env` without printing it. The model ledger is shared with the prior lane; never seed a fresh ledger for a resume. After acquiring the pinned public-docs index and local weights and building vectors, the exact run commands are:

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
export CORPUS_PROFILE=real FREE_TIER=public-docs LEDGER_ANALYTICS=1
export EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture R3_MODEL_CAP_USD=4.90
export R3_COST_LEDGER=/Users/speedpowermac/.t3/worktrees/tftf/t3-4c545eab-22e21714495ce309/scratch/r3-model-cost.json
R3_LIMIT=10 R3_BANK_FILE=scratch/r3-smoke-bank.json R3_OUT=scratch/r3-smoke npm run eval:r3
R3_OUT=scratch/r3-real-200 npm run eval:r3
# The retained final continuation uses R3_OUT=scratch/r3-real-400.
python3 eval/r3-report.py scratch/r3-real-400
node --import tsx eval/r3-diagnose.ts scratch/r3-real-400
```

Resume uses the same source commit, bank, static corpus, provider configuration, output directory and ledger. Each durable arm/question-ID pair is skipped after completion, and interrupted admissions are recovered without a second intent. Changed identity is refused. The seven offline recovery commands and original inputs are retained in the raw logs/fixture files and the recovery records. Original source patches against merged runner commit `d143da85`, exact tree hashes and commit metadata are retained in the archive’s `source-patches/` folder, so rebasing the shipping branch does not lose evaluation provenance. Raw SQLite stores, all complete SSE observations, report versions and logs are archived outside the checkout; `r3-real-200/raw-artifacts.json` pins their hashes and local location. The committed result JSON retains every run ID and provider label; no credentials are included. `recovery.json` records the last migration; earlier migrations are in `r3-failed-crypto/recovery.json`, `r3-failed-offer/recovery.json`, `r3-failed-currency/recovery.json`, `r3-failed-channel/recovery.json`, `r3-failed-amm/recovery.json` and `r3-failed-amm-deposit/recovery.json`. Initial flags remain in `r3-failed-oracle/`, `r3-failed-crypto/`, `r3-failed-offer/`, `r3-failed-currency/`, `r3-failed-channel/`, `r3-failed-amm/` and `r3-failed-amm-deposit/`. No failed gate was silently cleared in place. In total, ten original oracle flags across six fixtures are retained, alongside zero violations from the corrected-corpus audits.

`R3_MODEL_CAP_USD` is the only new setting (default US$5; may only lower the ceiling). This run sets US$4.90. Existing profile/provider flags remain opt-in; no hosted default changed. The runner sets simulated settlement, anchoring off, publishing off, telemetry off, and an isolated S$1,000 daily aggregate allowance so 200 S$2 paid questions do not truncate one another. Per-question S$2 and per-source caps remain unchanged. The global fetch guard allows localhost, the pinned DeepSeek endpoint, and strictly allowlisted public ledger reads only. Hosted, h4-deploy and GCP were untouched. There are no settlement transaction hashes to list.
