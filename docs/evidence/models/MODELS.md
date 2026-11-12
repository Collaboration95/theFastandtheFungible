# In-process model evidence — 12 November 2026

## Continuation status: blocked, no merge

**Docker remained unresponsive throughout a 20-minute timed recovery loop (09:42–10:02 UTC, 12 November).** Each `docker info` attempt was bounded at 10 seconds with a 20-second retry interval. No hosted image was built; offline container inference and image-size delta remain unverified. No images were pruned. The queued `check:fast` was cancelled before acquiring the shared lock after this prerequisite failed. No full gate or published local-gate success exists, and no PR is opened or merged.

The rejected calibrated runtime provider, weights and UI label are removed. The fit script and negative result remain. The resumable fixture-policy runner now uses per-arm/question-ID admission keys, atomic progress/cost files, durable SSE recovery and pre-PLAN admission recovery; it rejects repeated run IDs. A crash probe preserved 30 completed results and recovered four active runs.

Seven paid synthetic fixtures replace proven generic collisions with unique single-word canaries and short canary passages. The oracle code, eight-word run length, thresholds and grant checks are unchanged. Original Q02 was planner-only before SEARCH. Q107 had 16 free contents and no grants. In the latest Q18, grant **113** precedes paid reads **114–127** for the purchased Fab Floor article; the unmatched Load Factor article was absent from the writer context. No gate-1 paid read before a grant was established. Exact before/after markers and audit references are in `leak-diagnosis.json`.

The all-200-question planner preflight completed. A 400-row diagnostic batch completed with a retained oracle failure and two known duplicate-question identity errors; it is not qualifying evidence. A separate fresh 200-by-two attempt stopped at **41/400** (22 free, 19 paid) after Q18 generated a further non-unique fact phrase. That seventh fixture repair passes targeted checks but has not been live-rerun. `r3-continuation-results.json` and `r3-continuation-summary.json` retain this failed attempt. There is **no supported paid-note lift claim**.

Cumulative model usage across the original lane, probes and all continuation attempts: **US$0.594377682** reported usage cost + **US$0.076642500** conservative holds for 8 interrupted calls = **US$0.671020182 maximum accounted exposure**, below US$5. 1275 attempts; 2531115 reported input and 268485 output tokens. Costs are metered estimates using the [verified DeepSeek rates](https://api-docs.deepseek.com/quick_start/pricing/), not an invoice. Settlement was SIMULATED; **no XRPL transactions or hashes**.

Remaining qualification: restore Docker, build both hosted targets on one platform under the heavy lock, run the model image with `--network none`, measure image-size delta, prune only builder cache, and run a fresh 400-run paired eval after all marker repairs. Then split embeddings/negative-result PR A from eval/oracle PR C, rebase and run the full Node 22 merge gates. No UI timeout, test or policy threshold was loosened. The existing UI text wait already uses 5 seconds.

Continuation verification: Node 22 typecheck, targeted ESLint, hygiene and paid-body lint passed. The earlier targeted group passed 47 tests; after the seventh repair, corpus/oracle/resume checks passed 11 tests. No UI timeout was changed. These are targeted results, not full merge admission.

## Retained original-lane measurements


| Retrieval, 162 existing queries | Recall@5 | MRR |
|---|---:|---:|
| Keyword baseline | 0.993827 | 0.972222 |
| Recorded Cloudflare BGE-base vectors | 1.000000 | 0.993827 |
| Local q8 BGE-small | 1.000000 | 0.993827 |
| Local q8 MiniLM-L6 | 1.000000 | 0.990741 |

| Held-out decisions, 149 rows / 6 questions | Brier ↓ | ECE ↓ | AUC ↑ | Precision at 0.20 ↑ |
|---|---:|---:|---:|---:|
| Learned logistic policy | 0.036947 | 0.058718 | 0.971429 | 0.600000 |
| Fixture rules, same reconstructed inputs | 0.035478 | 0.044411 | 0.982540 | 0.333333 |
| Recorded gpt-6-luna value scores | 0.047205 | 0.033323 | 0.824603 | 0.428571 |
| Learned policy against Luna verdict pseudo labels | 0.033679 | 0.052809 | 0.886318 | 0.500000 |

The first three decision rows use existing source-grounded buy annotations as targets. The fourth changes the target to recorded Luna BUY verdicts. Precision improves over fixture rules, while fixture rules retain better Brier, ECE and AUC. This does not establish a general quality improvement or justify default promotion.

| Interrupted live evaluation | Free only | Free plus paid notes |
|---|---:|---:|
| Completed / planned runs | 22 / 200 | 21 / 200 |
| Answered: at least one requested fact | 12 / 22 (54.5%) | 12 / 21 (57.1%) |
| Correct: all requested facts | 10 / 22 (45.5%) | 9 / 21 (42.9%) |
| Valid / total citations | 107 / 107 | 106 / 106 |
| Total / median simulated spend | S$0 / S$0 | S$0.90 / S$0 |
| Latency p50 / p90 | 6.62 / 9.17 s | 7.28 / 10.88 s |
| Gate violations / writer fallbacks | 1 / 0 | 1 / 0 |

**WIP; not merged, deployed or qualified for hosted promotion. Continuation work below supersedes the original blocker analysis, not the retained historical measurements.** The 200-question paired evaluation stopped after a failed leak audit. These partial, unpaired samples support no lift claim. The requested sentence “free docs alone answered X%; paid notes lifted it to Y% at S$Z median spend” cannot truthfully be filled in. This used the default corpus, not the forthcoming public-docs profile; it reached no XRPL judge-bank questions.

The live planner and writer used DeepSeek Flash; decisions and embeddings ran locally. Settlement was **SIMULATED**, including three paid-arm runs spending S$0.10, S$0.40 and S$0.40. Ledger transactions / hashes: **none**. Cumulative model cost including the two-run pilot: **US$0.098467224** from reported usage, plus **US$0.016835400** conservatively reserved for two interrupted calls without usage, or **US$0.115302624 maximum accounted exposure** against the US$5 ceiling. There were 99 attempts, 291,198 reported input tokens and 27,853 output tokens. This is metered cost at published rates, not an invoice. Summaries contain no credentials or raw model output.

## Retrieval choice and Mac cost

BGE-small is selected: recall ties MiniLM, with better MRR matching the recorded remote model. These are within-publisher results on `eval/queries.json`, including keyword and natural-language forms through production hybrid ranking. This is a tuning bank, not independent generalisation evidence. Existing downstream RRF and its query-dependent hash tie-break are unchanged.

| Mac CPU cost, one inference thread | BGE-small | MiniLM-L6 |
|---|---:|---:|
| Weights and tokenizers, bytes | 34,727,605 | 23,685,780 |
| Cold pipeline load and warm-up, ms | 1,236.59 | 111.85 |
| RSS increase after warm-up, bytes | 155,287,552 | 117,669,888 |
| Query embed p50 / p95, ms | 2.58 / 4.16 | 1.22 / 1.84 |

Measured in separate Node 22.23.4 processes on this Mac: Apple M5, 10 cores, 32 GiB RAM, macOS 26.6.2, arm64, under the shared heavy lock. Cold means a new process, not cleared OS caches; BGE ran first. Latency excludes search and includes actual inference without query-cache hits. JSON files retain unrounded values. No API calls were used for retrieval. Hosted latency and memory remain unmeasured.

Build acquisition pins revisions and writes SHA-256 manifests. Runtime sets `allowRemoteModels=false` and `local_files_only=true`. Missing weights fail publisher readiness. Corpus vectors have text hashes; stale vectors fall back to labelled keyword search. Remote vectors are never mixed into the local embedding space. Discovery embeds public metadata only. No client module imports Transformers; server bundles externalise it.

## Negative result: learned policy rejected

The logistic fit on 988 historical rows yielded 778 usable open-fact decisions (497 train / 132 validation / 149 test), grouped by question. Held-out Brier **0.036947**, ECE **0.058718**, AUC **0.971429** were worse than fixture rules (**0.035478 / 0.044411 / 0.982540**). The calibrated provider, weights and UI label have been removed. Hosted keeps policy rules. The pure retrospective fit script and metrics remain; `npm run policy:fit` writes metrics, not deployable weights. See `CALIBRATION.md` for reconstruction and generalisation limits.

## Continuation investigation

The runner crash probe retained its first 30 completed IDs and recovered four in-flight runs on restart (`resume-probe.json`). The final runner identifies tasks by per-arm/bank-ID admission keys, not question wording, and explicitly refuses reused run IDs or duplicate task keys. Before engine restart it also finishes an admission interrupted before its live PLAN. Final qualification uses a fresh output directory and no deliberate crash.

The original 43/400 completion count was a manual stop after Q02 failed the raw leak oracle. The old runner refused an existing output directory, so a crash could not resume. The replacement atomically saves results and cumulative cost, skips completed question/arm pairs, recovers unfinished runs from SQLite using durable per-arm/question-ID admission keys (question wording is not unique), and retains SSE observations. It refuses changed bank, corpus hash, profile or provider identities. A truncated final SSE append is recovered without discarding complete frames. A previous failed audit remains a failed audit on resume.

Both original Q02 runs have **zero intents, zero grants and zero `read_paid` audit entries**. Free audit sequences 5–8 contain admission/refusal/decisions; paid sequences 4/8/9 contain admission/decisions. PLAN events 2 and 6 precede SEARCH events 3 and 7. The planner receives only `PLAN_PROMPT`, the question and clarify answers (`server/agents/scope.ts:213`); it receives no publisher client, corpus, candidates or body. The publisher journal has no Q02 intent binding or settlement. This establishes a marker collision, not a gate-1 paid read. `leak-diagnosis.json` records the sanitized evidence.

The before marker was `the bank of japan raised its policy rate`. It was present in three paid synthetic fixtures. Their after markers are `R3CANARYEE28DE76C2DDD47F3A345754`, `R3CANARYAC44B352C29B6C263BDCC823`, and `R3CANARY0CF10D732B4401B011405E52`, inserted into equivalent BoJ wording. Re-auditing the original durable runs now yields zero violations. The unchanged oracle still detects each standalone canary and paid passage before a matching grant.

A subsequent run stopped at Q31 after another PLAN-only phrase collision, `for the week ending 30 april 2026 the`, with zero grants/intents. An all-200-question live planner preflight found one additional collision at Q38, `in the first four months of 2026 the`. These two synthetic paid fixture phrases also receive unique single-word canaries and a short canary passage so the existing exact-match oracle detects them. Q107 later matched `range of plus or minus 0 5 percent` in a writer answer. Its 16 contents were all FREE, with zero intents, grants and `read_paid` events; audit rows 565/568 were admission/decision. This is also an oracle collision. The paid fixture now says `±0.5 percent band [R3CANARYAF19913E8E97DE350839EE7B]` and has a short canary passage. The diagnostic batch completed 400 rows while preserving this failure. It is not qualifying evidence, and two repeated-question rows in it reused a run before the task-key fix. The subsequent fresh run also failed an oracle overlap; see continuation status above.

No oracle threshold, run length or check is removed or changed. All failed batches remain in ignored scratch and count toward the same US$5 ledger.

The previous paid arm had 350 `SKIP_LOW_VALUE`, 71 `SKIP_REWRITE` and 3 `BUY` rows over 53 decision rounds, all at threshold 0.20; no budget verdicts. The 350 low-value rows comprise 278 off-subject candidates, 58 below-threshold scores and 14 insufficient marginal-value rows. Relevance exclusions dominate the pool; the learned score and marginal-value policy suppress buys among remaining candidates. Authorized budget was not the binding constraint. Free evidence already answered 12/22 original free runs. The rerun uses fixture policy rules without tuning their threshold, budget, corpus question bank or purchase appetite.

## Original-lane blockers (historical)

1. **Docker qualification:** the original arm64 baseline image measured 194,647,564 bytes. The model build baked 277 corpus vectors, then failed copying all dependencies with `no space left on device`. The reduced CPU-closure retry on linux/amd64 stalled with no logs. `docker buildx ls` and `docker system df` also timed out after 10 seconds; `docker info` reported 28.0.1. Only our build clients were terminated; no shared image, cache or volume was deleted. Image-size delta and network-disabled container inference remain **unverified**. Weight size is not image delta. Additive `api-models` / `publisher-models` targets need R3-REACH coordination and orchestrator promotion; existing named targets are retained.
2. **Live leak oracle:** Q02 failed `premium_leak` in both arms. Planner checkpoint and PLAN event contain the eight-word marker `the bank of japan raised its policy rate`, also in synthetic paid article `bp-jgb-curve-10s30s-analysis`. Neither Q02 run purchased or received a grant. Re-running the unchanged durable-state audit without SSE reproduces it. This overlap does not establish a paid-body read; it does fail the required zero-violation oracle. No corpus, oracle or leak threshold changed. R3-CONTENT owns the corpus. The batch was stopped and failures retained. The harness now stops admitting work after a failed gate while finishing in-flight runs.

Q02 free: `4274441f-d165-464d-b911-72c0b7ec7b5b`, PLAN event 2. Q02 paid: `fc8b115c-72fe-47cf-bebf-24550b443351`, PLAN event 6. Sanitised artifacts: `r3-partial.json`, `r3-partial-summary.json`, `r3-pilot.json`, `model-cost.json`. Ignored local evidence: `scratch/r3-baseline-200/` SQLite stores, `scratch/r3-pilot/`, `scratch/inspect-r3-audit.ts`, `scratch/docker-first-failure.log`.

The live batch used ignored `scratch/r3-live-tree`, a source snapshot of clean step-1 head `4dc235fb` plus step-2/3 WIP. Dependencies and .env were symlinked to this worktree and the main checkout respectively; no credential content was printed. Later stop-on-failure and reputation-source hardening have not been live-evaluated. The pilot is wiring evidence only: neither arm purchased, so its answer difference cannot be attributed to buying.

## Checks and admission

Node 22 targeted checks: **45 tests passed** across local embeddings, calibrated policy, existing decisions, accessible-citation scoring and judges' corner. Typecheck and targeted ESLint passed. Retrieval/search/RRF parity tests also passed during step 1. No gate, test or threshold was loosened.

Clean step-1 `check:fast` at `4dc235fb` failed one existing UI test: `tests/hosted-judges-corner.test.tsx:123`, “(a) in ready reads only the committed file, with no admission call”, timeout 5,000 ms (3,070 passed / 1 failed / 4 skipped). Focused retry passed 17/17; that does not replace a full green check. A queued full retry was cancelled after the independent blockers. No full gate receipt or published `local-gate` success exists for this WIP. WIP commits use `--no-verify` as expressly allowed for blocked handoff by the build brief; this supplies no merge admission. No PR was opened; no merge or deployment is claimed.

## Reproduce and resume

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
node --import tsx scripts/bake-embedding-model.mjs
node --import tsx scripts/bake-embedding-model.mjs Xenova/all-MiniLM-L6-v2
node --import tsx eval/local-embeddings.ts
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh node --import tsx eval/local-embeddings.ts Xenova/bge-small-en-v1.5
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh node --import tsx eval/local-embeddings.ts Xenova/all-MiniLM-L6-v2
EMBEDDING_PROVIDER=local node --import tsx scripts/build-embeddings.mjs
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh npm run policy:fit
npm run eval:r3 -- --plan
```

After the Docker owner restores a responsive builder, build both targets on the same platform, inspect their sizes, then run inference with networking disabled. These are required follow-up commands, **not successful container evidence**:

```sh
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh docker build --platform linux/amd64 -f docker/hosted/Dockerfile --target api -t ra-r3-baseline:amd64 .
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh docker build --platform linux/amd64 -f docker/hosted/Dockerfile --target api-models -t ra-r3-models:amd64 .
docker image inspect ra-r3-baseline:amd64 ra-r3-models:amd64 --format '{{.RepoTags}} {{.Size}}'
docker run --rm --network none --entrypoint node ra-r3-models:amd64 --input-type=module -e 'const {env,pipeline}=await import("@huggingface/transformers");env.localModelPath="/app/data/models/";env.allowRemoteModels=false;const p=await pipeline("feature-extraction","Xenova/bge-small-en-v1.5",{device:"cpu",dtype:"q8",local_files_only:true});const out=await p("offline retrieval",{pooling:"mean",normalize:true});if(out.dims.at(-1)!==384)throw Error("wrong dimensions");console.log("offline inference passed")'
```

R3-CONTENT had not merged when the live run began. After its merge and resolution of the failed audit, this **single command** rebuilds vectors and runs both arms on the public-docs profile. Keep the cumulative cost ledger and choose a fresh `R3_OUT`; retain the main checkout .env symlink without printing it:

```sh
PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH FREE_TIER=public-docs CORPUS_PROFILE=real EMBEDDING_PROVIDER=local R3_OUT=scratch/r3-public-docs sh -c 'node --import tsx scripts/build-embeddings.mjs && npm run eval:r3'
```

Flags: `EMBEDDING_PROVIDER=local` opts into CPU inference even with legacy `SEARCH_EMBEDDINGS=off`; unset keeps existing search behavior. `EMBEDDING_MODEL_DIR` defaults to `data/models`. `DECISION_PROVIDER=fixture` selects existing policy rules; it remains the default. The rejected calibrated provider and UI label are absent. Existing explicitly configured remote providers remain available. Hosted defaults/compose promotion belong to the orchestrator.

References: [pinned BGE-small model](https://huggingface.co/Xenova/bge-small-en-v1.5), [Transformers.js local server inference](https://huggingface.co/docs/transformers.js/tutorials/node), [DeepSeek Flash token rates](https://api-docs.deepseek.com/quick_start/pricing).
