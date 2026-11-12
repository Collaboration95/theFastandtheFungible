# Real-profile paired evaluation

Status: pending the merged real content profile. Do not run the fictional default profile.

Both arms use `CORPUS_PROFILE=real FREE_TIER=public-docs EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture`, live DeepSeek Flash planning/writing and explicitly simulated settlement. Free-only budget is S$0; paid budget is S$2. No ledger writes or XRPL transactions are made. The content writer may read public Mainnet/Testnet ledgers through a strict command allowlist; those reads are not Testnet settlement evidence.

Generate 200 questions with the existing bank loader/needle matcher and deterministic offline specifications. Exactly 100 are protocol questions (60 used v3/v4/v5 judge questions and 40 source-checked public XRPL fact questions); 100 retain historical non-protocol synthetic-fact questions as controls whose sources the real profile excludes. Report those controls separately: their misses measure the cost of removing their source coverage, not an embedding regression or real-world factual correctness. This is a development diagnostic, not an independent held-out bank. Freeze the bank and SHA-256 before live runs; never tune its golds after results.

Requested-fact scoring requires the answer and a cited accessible span to contain the existing fact needles. Protocol gold scoring uses the existing first-two-sentence phrase check with accessible citations. For these metrics, answered means at least one requested fact matched (or the single protocol gold matched); correct means every requested fact matched. Neither metric means merely that a response was produced. The original verified-purchase scorer is retained separately. Report answer and correctness rates, valid citations, spend, latency, fallbacks and all gate violations, with per-stratum results. No paid-note lift claim follows from an incomplete or failed audit.

Each completed arm/question-ID pair, run ID, SSE observation and cost is saved durably. Repeated wording receives separate admission keys. Resume refuses a changed bank, static corpus, source commit or provider configuration; dynamic signed ledger reports are retained in the output directory and audited after loading. Killed partial SSE appends are truncated to the final complete frame. A failed gate remains terminal; subsequent in-flight results are retained. Resume fixes never erase the failed attempt.

The cumulative ledger starts at the retained prior maximum exposure: US$0.594377682 reported + US$0.076642500 holds = US$0.671020182. It is shared across attempts and protected against simultaneous process owners. Each call reserves a peak-rate input-byte/output-token bound before network access. Interrupted calls retain that bound. Total actual plus reserved cost must stay within US$5. Missing reported usage is not treated as free.

[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/) checked 12 November 2026: Flash off-peak input miss/hit/output per million tokens = US$0.15/0.003/0.60; peak = US$0.30/0.006/1.20. Weekday peak windows are 01:00–04:00 and 06:00–10:00 UTC, excluding Chinese public holidays. This ledger conservatively treats every weekday peak window as peak, and is an estimate rather than an invoice.

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
FREE_TIER=public-docs CORPUS_PROFILE=real node --import tsx scripts/generate-r3-bank.ts
FREE_TIER=public-docs CORPUS_PROFILE=real EMBEDDING_PROVIDER=local node --import tsx scripts/build-embeddings.mjs
FREE_TIER=public-docs CORPUS_PROFILE=real EMBEDDING_PROVIDER=local DECISION_PROVIDER=fixture R3_OUT=scratch/r3-real-200 npm run eval:r3
```

The isolated simulated batch sets `WALLET_DAILY_CAP_MINOR=100000` (S$1,000 aggregate) so the daily allowance does not truncate 200 paid-arm questions. Per-question S$2 and per-source policy caps remain unchanged. This configuration applies only to the evaluation's simulated stores, never hosted wallets; it does not raise the US$5 model-spend ceiling. Anchoring is off, fault injection and telemetry are off, and no ledger payment is submitted.
