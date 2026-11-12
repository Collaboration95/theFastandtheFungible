# In-process model evidence — 12 November 2026

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

**WIP; not merged, deployed or qualified for hosted promotion.** The 200-question paired evaluation stopped after a failed leak audit. These partial, unpaired samples support no lift claim. The requested sentence “free docs alone answered X%; paid notes lifted it to Y% at S$Z median spend” cannot truthfully be filled in. This used the default corpus, not the forthcoming public-docs profile; it reached no XRPL judge-bank questions.

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

## Fitted policy and spending authority

Versioned JSON: `data/calibration/policy-v1.json`, payload SHA-256 `71b5714903d7ee966fd2902214b2438278ccac5a5a584f348fd255d7e39de491`. Two fits produced identical bytes. The 988 historical rows yield 778 usable open-fact decisions: 497 train / 132 validation / 149 test, with disjoint question groups. Neither validation nor test selects weights or the fixed 0.20 threshold. [CALIBRATION.md](CALIBRATION.md) details reconstruction; `calibration.json` retains every metric and bin.

Eleven features cover relevance, public-metadata embedding similarity, price, trust, honesty, promise history, authority, originality, repeated family, gap coverage and title/entity coverage. Historical rows lack reputation and read-family context: those constant training features have zero coefficients and unvalidated effects. Families may overlap question groups; this is not an unseen-topic or unseen-writer estimate. Luna scores retain historical context that cannot be fully reconstructed and are not a paired runtime replay.

The provider only scores, with no payer, store or purchase capability. Existing policy checks trust, novelty, cap, reservations, remaining budget and duplicates. A maximum-score test proves no purchase is selected with S$0 or an exhausted reserved budget, and an already purchased source is skipped. Trusted runtime reputation replaces any writer-supplied reputation before calibrated scoring.

## Hard blockers

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

Flags: `EMBEDDING_PROVIDER=local` opts into CPU inference even with legacy `SEARCH_EMBEDDINGS=off`; unset keeps existing search behavior. `EMBEDDING_MODEL_DIR` defaults to `data/models`. `DECISION_PROVIDER=calibrated` opts into learned scoring; unset retains the existing fixture default. UI label: “Calibrated policy model”. Existing explicitly configured remote providers remain available. Hosted defaults/compose promotion belong to the orchestrator.

References: [pinned BGE-small model](https://huggingface.co/Xenova/bge-small-en-v1.5), [Transformers.js local server inference](https://huggingface.co/docs/transformers.js/tutorials/node), [DeepSeek Flash token rates](https://api-docs.deepseek.com/quick_start/pricing).
