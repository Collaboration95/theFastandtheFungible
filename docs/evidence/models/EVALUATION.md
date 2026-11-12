# Real-profile paired evaluation

Status: **complete (13 Nov 2026).** 400 of 400 paired runs (200 questions × free-only and paid arms). Seven provider-failed attempts were excluded and re-run, using the strict-provider continuation on branch `guru/r3-eval-run` (head `b7e1ad85`). Bank `eval/questions/r3-real.v1.json` on that branch, SHA-256 `b5e722d9a004a56f5c5f0ed1078bfb911063100c244e11252459608cb770cb6b`. Settlement in both arms is **simulated**: no XRPL transactions.

## Results

On the **100 protocol questions** (XRPL and x402), counting only answers written by the live model (planner substitutions and fixture answers excluded):

| Arm | Correct | Runs that bought | Spend | p50 latency |
|---|---:|---:|---:|---:|
| Free docs only (S$0 budget) | **31 / 100** | 0 | S$0 | 7.4 s |
| Free docs + paid notes (S$2 budget per question) | **48 / 100** | 43 | S$20.40 in total | 8.6 s |

By stratum (live-only correct): used judge-bank questions 13/60 → 26/60; source-checked public XRPL fact questions 18/40 → 22/40.

Across all 400 runs there were 0 gate violations, and every citation was valid: 463/463 free and 503/503 paid. The 100 historical out-of-profile control questions score 0 in both arms, as designed: the real profile excludes their sources. Their writer fallbacks (97 free, 98 paid) are why the whole-bank fallback counts are high.

Model cost of the final pass: US$1.02 actual (2,173 calls, 6.48 M input / 0.50 M output tokens). Cumulative accounted exposure across all attempts is about US$1.31.

Limits: this is a development diagnostic, not an independent held-out bank. The 60 judge-bank questions were used in earlier rounds, the correctness scorer is fact-needle matching with accessible citations, and settlement is simulated. Slim per-run results are in `r3-real-paired/results.json` and the full summary in `r3-real-paired/summary.json`.

## Protocol (as frozen before the run)

Both arms use `CORPUS_PROFILE=real FREE_TIER=public-docs EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture`, live DeepSeek Flash planning/writing and explicitly simulated settlement. Free-only budget is S$0; paid budget is S$2. No ledger writes or XRPL transactions are made. The content writer may read public Mainnet/Testnet ledgers through a strict command allowlist; those reads are not Testnet settlement evidence.

Generate 200 questions with the existing bank loader/needle matcher and deterministic offline specifications. Exactly 100 are protocol questions (60 used v3/v4/v5 judge questions and 40 source-checked public XRPL fact questions); 100 retain historical non-protocol synthetic-fact questions as controls whose sources the real profile excludes. Report those controls separately: their misses measure the cost of removing their source coverage, not an embedding regression or real-world factual correctness. This is a development diagnostic, not an independent held-out bank. Freeze the bank and SHA-256 before live runs; never tune its golds after results.

Requested-fact scoring requires the answer and a cited accessible span to contain the existing fact needles. Protocol gold scoring uses the existing first-two-sentence phrase check with accessible citations. For these metrics, answered means at least one requested fact matched (or the single protocol gold matched); correct means every requested fact matched. Neither metric means merely that a response was produced. The original verified-purchase scorer is retained separately. Report answer and correctness rates, valid citations, spend, latency, planner substitutions, writer fallback events, fixture answers and all gate violations, with per-stratum results. Live-only correctness excludes every planner substitution and fixture answer, including substitutions without a MODEL_FALLBACK event; raw provider labels are retained. No paid-note lift claim follows from an incomplete or failed audit.

Each completed arm/question-ID pair, run ID, SSE observation and cost is saved durably. Repeated wording receives separate admission keys. Resume refuses a changed bank, static corpus, source commit or provider configuration; dynamic signed ledger reports are retained in the output directory and audited after loading. Killed partial SSE appends are truncated to the final complete frame. A failed gate remains terminal; subsequent in-flight results are retained. Resume fixes never erase the failed attempt.

The cumulative ledger starts at the retained prior maximum exposure: US$0.594377682 reported + US$0.076642500 holds = US$0.671020182. It is shared across attempts and protected against simultaneous process owners. Each call reserves a peak-rate input-byte/output-token bound before network access. Interrupted calls retain that bound. Total actual plus reserved cost must stay within US$5. Missing reported usage is not treated as free.

[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/) checked 12 November 2026: Flash off-peak input miss/hit/output per million tokens = US$0.15/0.003/0.60; peak = US$0.30/0.006/1.20. Weekday peak windows are 01:00–04:00 and 06:00–10:00 UTC, excluding Chinese public holidays. This ledger conservatively treats every weekday peak window as peak, and is an estimate rather than an invoice.

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
FREE_TIER=public-docs CORPUS_PROFILE=real node --import tsx scripts/generate-r3-bank.ts
FREE_TIER=public-docs CORPUS_PROFILE=real EMBEDDING_PROVIDER=local node --import tsx scripts/build-embeddings.mjs
FREE_TIER=public-docs CORPUS_PROFILE=real EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture R3_OUT=scratch/r3-real-200 npm run eval:r3
```

The isolated simulated batch sets `WALLET_DAILY_CAP_MINOR=100000` (S$1,000 aggregate) so the daily allowance does not truncate 200 paid-arm questions. Per-question S$2 and per-source policy caps remain unchanged. This configuration applies only to the evaluation's simulated stores, never hosted wallets; it does not raise the US$5 model-spend ceiling. Anchoring, web publishing, automatic approval, fault injection and telemetry are off, and no ledger payment is submitted.
