# Real-profile paired evaluation — pending provider balance

**393/400 accepted arm/question results · 7 paid tasks pending · 935/935 eligible citations valid · 0 eligible gate violations.**

The provider balance check at 2026-11-12 15:40:31 UTC returned `is_available=false`, US$0.00. Five-minute polls retained the pause. At 16:08 UTC the owner reported replenishment and authorized resumption with a lower budget to preserve the shared hosted-demo account. This lane added no credit. Failed calls do not count as evaluation results. Only the seven excluded tasks will resume; 393 valid records remain unchanged.

The archived 400 terminal attempts included seven paid tasks with eight HTTP writer-fallback events and six unavailable-planner substitutions. They are excluded, not scored as answers or misses. `provider-pause.json` retains their exact original records and run IDs. The remaining 393 records are unchanged. All seven excluded attempts spent S$0 and had no purchases. Guard fallbacks did not call the model; they remain labelled in this development diagnostic. No final 200-pair lift claim is supported while seven tasks are pending.

| Measurement | Free only, S$0 budget | Free + paid, S$2 budget |
| --- | ---: | ---: |
| Accepted / target | 200/200 | 193/200 |
| Answered / correct | 31/200 (15.5%) | 49/193 (25.4%) |
| Correct with no model substitution | 31/200 | 45/193 |
| Valid / total citations | 463/463 | 472/472 |
| Gate violations | 0 | 0 |
| Purchases | 0 | 51 |
| Article spend | S$0.00 | S$20.40 |
| Median per accepted question, including zero | S$0.00 | S$0.00 |
| Latency p50 / p90 | 6.447 s / 10.767 s | 6.932 s / 12.630 s |
| Planner substitutions / writer guard events / fixture revisions | 0 / 109 / 102 | 0 / 109 / 103 |

These are partial development results, with unequal eligible arm denominators. They are neither an independent holdout nor a causal estimate. Live planners/writers ran independently in the two arms; plans were not replayed. Buying used fixture policy rules, local BGE-small embeddings, real corpus/public docs and simulated settlement. No XRPL transaction was submitted.

## Question families and bank strata

| Family | Free correct / eligible | Paid correct / eligible |
| --- | ---: | ---: |
| XRPL docs | 28/83 (33.7%) | 40/76 (52.6%) |
| x402 | 2/5 (40.0%) | 2/5 (40.0%) |
| ledger analytics | unmeasured (n=0) | unmeasured (n=0) |
| other | 1/112 (0.9%) | 7/112 (6.2%) |

Ledger analytics was enabled but the frozen bank has no direct snapshot/holder/concentration/activity question: unmeasured. The bank contains 100 historical excluded-source controls, 60 previously used protocol judge questions and 40 source-checked protocol specifications. All 100 excluded-source controls miss in each arm. No gold, scorer or threshold changed. `metrics.json` pins every per-ID family assignment.

## Purchases, latency and model cost

There are 51 simulated purchases in 43 eligible paid questions, all S$0.40 each. Total S$20.40; median among buyers S$0.40. Spend distribution counts accepted questions:

| Spend per question | Free | Paid |
| --- | ---: | ---: |
| S$0.00 | 200 | 150 |
| S$0.40 | 0 | 37 |
| S$0.80 | 0 | 4 |
| S$1.20 | 0 | 2 |

Latency uses the existing lower order statistic, floor((n−1)×p), on the local Mac with other lanes active. It includes planning, retrieval, synthesis, policy rounds and audit; recovered attempts retain their original start time. These are not hosted or isolated performance measurements.

All attempt costs remain accounted, including failed calls: cumulative US$1.007891616 reported usage + US$0.297412500 retained missing-usage holds = **US$1.305304116 exposure**, against the original US$4.90 stop. The continuation now enforces **US$2.17 total exposure**, stricter than adding the newly authorized US$1.50 to the current US$1.305304116 baseline. Remaining admission exposure is US$0.864695884. Previous 400-attempt accounted cost averages US$0.001386434 per attempt; seven retries estimate US$0.009705039. The 80 paired-smoke attempts cost US$0.079710270 reported. The full 200-pair bank therefore fits through continuation; no valid result is restarted and no subset is required. The original baseline was US$0.671020182. The 400 original attempts used US$0.333803664 reported cost plus US$0.220770000 new holds; four paired smokes add US$0.079710270 reported cost. The total continuation reported cost is US$0.413513934. Twenty-two holds remain, eight from the original baseline and fourteen new. These are ledger estimates, not an invoice; failed or missing usage is never free.

## Failure taxonomy

| Eligible result category | Free | Paid |
| --- | ---: | ---: |
| correct | 31 | 49 |
| excluded-historical-source | 100 | 100 |
| run-failed-or-stopped | 0 | 0 |
| no-answer | 0 | 0 |
| model-substitution | 5 | 1 |
| gold-not-in-accessible-spans | 17 | 8 |
| answer-or-lead-mismatch | 47 | 35 |
| gate-failure | 0 | 0 |
| Provider-failed tasks pending, excluded above | 0 | 7 |

The taxonomy is diagnostic and does not alter scores. Missing gold in accessible spans may mean corpus absence, retrieval misses or policy omissions. Answer/lead mismatch means the gold was accessible but the existing phrase scorer missed it. Historical fact scoring requires the fact in a claim and its cited span; protocol scoring uses the existing first-two-sentence lead phrase check. This is phrase matching, not expert semantic grading. Citation validation checks accessible-span/grant resolution; current URL availability was not independently checked. Fixture counts include all answer revisions.

## Resume and provenance

The frozen bank is `eval/questions/r3-real.v1.json`, SHA-256 `b5e722d9a004a56f5c5f0ed1078bfb911063100c244e11252459608cb770cb6b`. Completed valid tasks must not be restarted. `eval/r3-resume-provider.ts` copies the original attempt into a new continuation, pins the six source revisions, re-audits all 393 accepted observations against their granted versions and retires only the seven zero-spend provider-failed tasks. Their original records remain immutable. Each retry gets a distinct durable admission key and observation file; all prior model holds stay in the shared ledger. Automatic replay of a charged provider-failed task is refused.

The initial 10-question paired smoke and three additional paired smokes completed 80 supplementary arm/question attempts with zero violations. Seven terminal oracle pauses exposed ten original public-phrase collisions in six paid notes. Each correction added a unique canary and versioned wording; the eight-word oracle stayed unchanged. Three verified historical v1 purchases retain their original bytes/grants. The accepted results span these revisions and are not a fresh run of the final fixture versions.

Evaluation source `40df715dd9beeb51cf89a1632d1b828f94548e54`; static corpus hash `039d8df301d6b28abb275565b7dc6e0b5dcd29ef7389246461cf0283211f57f9`. Original source patches, exact tree hashes, complete SQLite stores, SSE observations and logs are retained in the immutable raw archive; `raw-artifacts.json` pins their hashes. `attempt-report.md` is the superseded attempt-level diagnostic, not the current result. `evaluated-fixtures.json` preserves pre-shipping bytes; later source-attribution/passage/menu corrections are not measured by these 393 accepted results. Their explicit version/hash pins are in `corpus-golden.json`.

The runner is I/O-bound, outside the heavy lock, at most four questions at once; all listeners use ephemeral ports. Local weights and generated public-docs index were verified against their pinned manifests. Accepted search labels are 320 hybrid and 73 labelled keyword fallbacks; local embedding configuration does not guarantee every search used vectors. `.env` is symlinked from the main checkout and never printed. Hosted, h4-deploy and GCP were untouched. No transaction hashes exist for simulated settlement.

`R3_MODEL_CAP_USD` defaults to US$5 and only lowers the ceiling; this run used US$4.90 before the owner lowered the continuation ceiling to US$2.17. `R3_REQUIRE_PROVIDER_SUCCESS` is new and defaults off; the continuation sets it to `1`. It checks balance before admission, pauses cleanly on provider failure and excludes failed calls from results while retaining their attempts and costs. Existing profile/provider flags remain opt-in. Settlement, anchoring, publishing and telemetry stay disabled for this benchmark, while the default S$2 paid-question budget remains unchanged. The ledger path is the original model-lane ledger, not a newly seeded file.

Prepared continuation commands (run only after available balance; initialize the copy once, then repeat only the runner command after any interruption):

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
export CORPUS_PROFILE=real FREE_TIER=public-docs LEDGER_ANALYTICS=1
export EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture
export R3_MODEL_CAP_USD=2.17 R3_REQUIRE_PROVIDER_SUCCESS=1
export R3_COST_LEDGER=/Users/speedpowermac/.t3/worktrees/tftf/t3-4c545eab-22e21714495ce309/scratch/r3-model-cost.json
node --import tsx eval/r3-resume-provider.ts scratch/r3-real-400 scratch/r3-provider-resume
R3_OUT=scratch/r3-provider-resume npm run eval:r3
```
