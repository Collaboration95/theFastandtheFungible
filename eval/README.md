# Search tuning eval (orchestrator, 8 Oct overnight)

Reproduce (offline once the vectors exist):

    npx tsx eval/run-eval.mts --chosen   # chosen production hybrid + keyword fallback
    npx tsx eval/run-eval.mts            # production configs + historical baseline grid
    npx tsx eval/run-eval.mts '<json>'   # custom grid: [["name", {mode, boost, w, sim, rel, bm25?, body?}], ...]

- `queries.json`: 162 eval queries (2 per article: a 3–7 word keyword query and a natural question), written by
  DeepSeek (8 calls) from title + abstract + tags + first 600 chars, told not to copy the title.
- `query-vectors.json`: bge-base-en-v1.5 vectors for those queries (2 Workers AI calls).
- Metrics: MRR and R@1 of the target article inside its own publisher (what one writer's search returns), and AUC of
  the `relevance` value: target article in its publisher vs. the top hit of every *other* publisher for the same query
  (rewrite families excluded). AUC answers "does relevance mean the same thing across writers?", which calibration
  (Brier, §7) and AlphaLeak's inflated claim both depend on.

## Starting point → result (8 Oct, 02:00–03:00 SGT)

| Config | MRR | R@1 | AUC across writers |
|---|---|---|---|
| Start: hybrid text/vector 0.5/0.5, boosts title 3 · abstract 2 · tags 2 · body 1, relevance = score ÷ top hit | 0.978 | 0.957 | **0.478** |
| Keyword only (same boosts) | 0.964 | 0.932 | 0.466 |
| Vector only | 0.994 | 0.988 | 0.494 |
| Hybrid 0.5/0.5, relevance = blended hybrid score (the #142 quick fix) | 0.978 | 0.957 | 0.760 |
| Hybrid 0.5/0.5, relevance = query–article cosine | 0.978 | 0.957 | 0.985 |
| Hybrid 0.2/0.8, cosine | 0.991 | 0.981 | 0.984 |
| Hybrid 0.1/0.9, cosine | 0.994 | 0.988 | 0.983 |
| **Chosen: hybrid 0.2/0.8, body boost 0.5, cosine** | **0.997** | **0.994** | **0.984** |
| Keyword fallback: body 1, BM25 saturation | 0.964 | 0.932 | 0.902 |
| Keyword fallback: boosts 1/1/1/1 | 0.955 | 0.920 | 0.843 |
| Keyword fallback: boosts 4/3/2/0.5 | 0.968 | 0.938 | 0.926 |
| Keyword fallback: body 0.25 | 0.968 | 0.938 | 0.928 |
| Keyword fallback: no body at all | 0.972 | 0.944 | 0.926 |
| BM25 k1 1.2→2.0, b 0.75→0.3 (any combination) | ±0.005 | ±0.006 | ±0.003 |

Findings:
1. **The relevance definition mattered far more than any BM25 knob.** Normalising to the top hit made every writer promise
   1.0 for its best hit (AUC 0.48, a coin flip), so calibration (Brier) would punish honest off-topic writers and
   AlphaLeak's "inflated" 0.96 was the *lower* claim. Cosine on a fixed scale fixes both.
2. Vector weight 0.8 helps paraphrased queries; a 0.2 text share keeps exact names and figures (TSMC, N3P, 10-year).
3. Body boost 0.5: whole-body BM25 matches on stock phrases every post in a writer's voice shares. Removing the body
   entirely scores slightly better but breaks D1's promise (writers search their *full* text), so it stays at 0.5.
4. BM25 k1/b: no measurable effect at 8–15 articles per writer, so Orama's defaults stay.
5. **Content beat parameters for the golden path.** The UC1 golden post ranked #4–#7 in Basis Points under *every*
   config (10 BoJ posts look alike). Retitling it to say what UC1 asks ("what the Bank of Japan changed and how 10-year
   JGB yields reacted") moved it to #1 on all three UC1 queries.
6. Bug found: the embeddings cache keyed on the body hash only, so a retitled article kept a stale vector. It now keys on
   the hash of the embedded text (title, abstract, tags, body head).

Caveats: the eval queries are LLM-written from the head of each article, which favours title/abstract matches; within a
writer there are only 8–15 candidates, so MRR saturates. The cross-writer AUC is the number to watch.
Relevance scale: hybrid cosine 0.65 → 0, 0.90 → 1 (target median ≈ 0.83, other writers' median best hit ≈ 0);
keyword `bm25 / (bm25 + 12)` (target median ≈ 0.70, other writers' median best hit ≈ 0.44).

The eval imports `SEARCH_TUNING`, `cosineRelevance` and `keywordRelevance` from
`publisher/search.ts`, including the production 0.01 floor for returned hits.
Run `npx tsx eval/run-eval.mts --chosen` to measure the chosen configuration on
the checked-in query vectors and current corpus, without provider calls.
The table above records the 8 Oct study; reruns on the current corpus may differ.

## Nightly scorecard (#256)

`make scorecard` (or `npm run scorecard`) runs offline with **zero provider
calls**, then audits a fresh demo store. It writes `eval/scorecard/latest.json`,
**appends** to committed `eval/scorecard/history.jsonl`, and prints a Markdown
table. Commit the new line in the daily ship PR; never edit or truncate old
lines. The fixture workflow runs at **18:00 UTC / 02:00 SGT**, on dispatch, and
on PRs changing the scorecard. It uploads reports and never pushes commits.

```
make scorecard                         # free fixture baseline
npm run scorecard -- --check           # fail on >10% quality regression
npm run scorecard -- --compare 2026-11-02  # same mode/input set, last matching row
npm run scorecard -- --plan            # no calls: live call/cost forecast
EVAL_ENV_FILE=/private/eval.env make scorecard LIVE=1
npm run gate:audit -- --db /path/to/api.db
npm run gate:audit -- --db /path/to/api.db --observations /path/to/observations.jsonl
```

Live requires **both** `--live` and `EVAL_LIVE=1` (`make … LIVE=1` supplies both),
and prefers `EVAL_OPENAI_API_KEY` from the shell or `EVAL_ENV_FILE`. For the
owner's local run it explicitly falls back to `OPENAI_API_KEY` in the shell or
local `.env`; no wallet seeds or unrelated `.env` settings are loaded. The runner prints call bounds and an estimated cost
before enabling network access; `EVAL_SPEND_CAP_USD` defaults to **US$1**, and
must be positive and at most US$1 for this scorecard. The inherited transport
reserves projected request cost before calls. Live decisions and coverage use
`gpt-6-luna`; the planner/writer remain extractive fixtures, search is keyword
only, and payments stay **SIMULATED** (zero real or Testnet funds transferred).
This is a deliberately substituted decision benchmark, not full live-product
latency or XRPL performance. No live baseline was obtained on 2 Nov: no local
`EVAL_*` keys were available; the live command refused before any provider call.
MCP e2e and DMG cold start remain `null` until measured by their owning lanes.

`frozen.json` fingerprints the entire bank, corpus, constructed coverage
snapshots and prompt source files, and pins configuration, bank order, and ten
timing questions (UC1–UC3 plus seven bank items). All 48 questions and all 116
snapshots are evaluation data: no training, threshold tuning or random split.
Trust resets per quality question; timing runs share one fresh demo instance,
as a server would. An input/prompt change fails closed; introduce a reviewed,
versioned eval set instead of silently replacing the baseline. Each row records
HEAD, whether the worktree was dirty, input hash, date, mode, labels and sample
observations. Initial bootstrap rows precede the implementation commit; HEAD
there identifies the evaluated policy/harness base. Compare only matching mode
and input hash. A fresh output/cache directory prevents replayed live responses
from masquerading as a new measurement.

Metric definitions:

- **Waste:** gross purchase cost adding no bank-supported requested fact / gross
  spend; refunded failed proofs still count. No spend means `null`.
- **Flow F1:** first purchase per question against the bank's expected purchase,
  using the existing flow harness with `--flow requested` and raw thresholds.
- **Sweep F1:** existing `purchaseMetrics` over open fact decision units, raw
  values and the frozen production threshold; unknown picks excluded as in the
  calibration report. No fitting occurs.
- **Uplift:** (final supported facts minus free supported facts) / all requested
  facts, in percentage points. **False-complete:** unsupported requirements
  predicted supported / all unsupported requirements, from the coverage harness.
- **Timing:** fresh child process launch through publisher/API boot and successful
  `/health` for cold start (imports included); ten sequential HTTP `/runs` calls
  through the actual API, SSE plus 10 ms polling. First answer is the first
  visible validated answer; final answer is terminal DONE. p50/p95 use linear
  interpolation at `(n-1)*p`. Timings vary with hardware/load and are observational;
  only deterministic **quality** metrics gate the >10% fixture regression check.
- **Cost:** provider `usage` tokens using the transport's explicitly dated
  8 Oct rates, with `estimatedUsageCalls` disclosed when usage was missing.
  `modelUsd` includes flow, sweep, coverage and timed queries;
  `flowDecisionUsdPerQuery` covers flow decision calls / 48 questions;
  `latencyModelUsdPerQuery` covers timed-query calls / 10 questions. XRP drops
  come separately from timed-run receipts, never an invented USD conversion.
  Fixture model cost and XRP drops are zero. These are usage-derived estimates,
  not billing invoices.

The audit reads raw SQLite in a read-only transaction (no schema sanitization),
checks **every run in the newly produced store**, and scans captured raw SSE and
publisher search responses. Six rules detect inaccessible citations, duplicate
settlements, gross spend/reservations or per-source cap overflow, purchases
without an earlier policy round/BUY trace and matching BUY verdict, premature
premium text, and missing/inconsistent rail labels. It reuses the existing
8-word leak detector and exact short-passage markers without changing its
threshold. Permission requires a matching run/resource/version VERIFIED grant;
public search metadata never gains permission to contain premium text. Replayed
receipts with the same transaction hash are not additional charges. Failed
proofs stay quarantined; refunds do not replenish the budget. The standalone
`--db` audit can check only persisted evidence; pass `--observations` to include
captured wire bytes. It reports IDs and rule names, never leaked text or tokens.

Raw stores, observations and full reports live under ignored
`eval/scorecard/out/<date>-<mode>/`; only summaries/history are committed. Failed
runs never become baselines. The six zeroes describe the generated ten-query
store and captured surfaces, not unobserved production traffic.


The owner removed the CI scorecard workflow on 3 Nov: run it locally on the Mac.
`frozen-pre-fact-menu.json` preserves the v1 experiment. The fact-menu treatment
uses a new v2 fingerprint and adds `corpusContent`, calculated with only the new
metadata removed. Its bank, corpusContent and coverage snapshot hashes must match
the v1 bank/corpus/snapshots before comparing treatments. Prompt and metadata
hashes intentionally differ; `--compare` still refuses different full hashes.
No regression gate or threshold was loosened. History records both versions;
treatment comparisons are explicitly labelled in REPORT-decisions.md.

Transient provider 5xx/transport failures receive one bounded retry. Every
attempt has a separate cached record and counts toward the same spend cap;
401/403/404 access errors stop immediately. A run with failed or unparsed
judgments still cannot publish a baseline.
