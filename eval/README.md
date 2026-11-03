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

## Current evaluation protocol (Numbers v5, 3 Nov)

`bank.v1.json` remains byte-for-byte historical. `bank.v2.json` has 140 questions
and 145 requested facts: all 48 old questions are dev; 92 new, distinct planted
facts are heldout, grouped by 20 source articles. Earlier work saw the old full
bank and the corpus. This is a prospective question holdout on previously visible
synthetic documents, not an unseen-corpus generalization test. Source documents
and some contexts were previously candidates; the new requested facts were not
used to tune the candidate. Human label review remains pending.

`node --import tsx scripts/generate-eval-bank.ts` rebuilds v2 from the unchanged
v1 bank and curated `additions.v2.json`. It checks every numeric label against
its named planted passage. No content or old label changes. Run `npm run eval:bank`
and `node --import tsx scripts/check-corpus.mjs` for bank and corpus/leak checks.
The additions were authored by OpenAI Codex, the same vendor as the judged Luna;
v2 records this explicitly, rather than inheriting v1's different-vendor claim.

`frozen.json` v5 pins the bank, corpus, coverage snapshots, policy/prompt code,
generator, split and CI implementation. `DECISION_SCOPE_POLICY=off` measures the
shipped #307 receipt-value baseline; default adds only the public country-scope
veto. Both keep receipt-value/v1, its identity fit, and every spending gate.
Freeze candidate and labels before the baseline/after pair; no heldout tuning.
Run `OFFSET=700 EVAL_LIVE=1 npm run scorecard -- --live --split heldout`.

Every new scorecard has 2,000-replicate, seed-700, 95% percentile bootstrap CIs.
Resample complete source groups, including all their questions and sweep units;
re-key duplicate draws so a sweep cannot silently collapse multiplicity. Dev
uses four historical topic clusters. With only 20 heldout source clusters,
intervals can remain wide: 92 questions are not 92 independent documents. These
intervals condition on the fixed corpus and observed model draws, and do not
measure provider variability, human label error or deployment behavior.
`report-numbers.ts <before report.json> <after report.json>` reproduces paired
delta CIs and a compact evidence artifact without provider calls.

Timing uses available historical sample IDs, or the first ten split IDs when
none match. The first v5 baseline predates that fallback: its quality is valid,
but API timing/audit sample count is zero, not evidence of ten audited runs.
The final run must state its actual audit counts. Empty timing cost stays null.

## Local scorecard (#256, #260; historical protocol below)

`make scorecard` (or `npm run scorecard`) runs offline with **zero provider
calls**, then audits a fresh demo store. It writes `eval/scorecard/latest.json`,
**appends** to committed `eval/scorecard/history.jsonl`, and prints a Markdown
table. Commit the new line in the daily ship PR; never edit or truncate old
lines. Run it locally on the owner's Mac; the CI workflow, dispatch trigger and
nightly schedule were removed in #260.

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
latency or XRPL performance. The initial #268 fixture delivery had no local
`EVAL_*` keys. A valid pre-menu LIVE baseline was recorded on 3 Nov SGT and
preserved in history; #260 adds labelled post-menu results.
MCP e2e and DMG cold start remain `null` until measured by their owning lanes.

`frozen.json` fingerprints the entire bank, corpus, constructed coverage
snapshots and prompt source files, and pins configuration, bank order, and ten
timing questions (UC1–UC3 plus seven bank items). In the historical v1 protocol all 48 questions and all 116
snapshots were evaluation data: no training, threshold tuning or random split.
Trust resets per quality question; timing runs share one fresh demo instance,
as a server would. An input/prompt change fails closed; introduce a reviewed,
versioned eval set instead of silently replacing the baseline. Each row records
HEAD, whether the worktree was dirty, input hash, date, mode, labels and sample
observations. Initial bootstrap rows precede the implementation commit; HEAD
there identifies the evaluated policy/harness base. Compare only matching mode
and input hash. A fresh output/cache directory prevents replayed live responses
from masquerading as a new measurement.

Metric definitions:

- **Wasted gross spend** (`wastedSpendPct`, unchanged): purchase cost adding no
  bank-supported requested fact at the post-purchase rewrite / all gross purchase
  cost. Failed proofs and subsequently refunded purchases still count as gross waste.
- **Wasted net spend** (`netWastedSpendPct`): (gross wasted cost minus confirmed
  refunds of wasted purchases) / (gross purchase cost minus all confirmed refunds).
  A failed proof, challenge or pending refund is not enough: production refunds
  must have a validated on-chain outcome. The offline harness's synchronous
  `proof: REFUNDED` outcome models a confirmed refund; its net result is explicitly
  **SIMULATED**, not a measurement of on-chain refunds. Refunds never replenish
  spending authority. XRP fees and model costs are separate; they are not deducted
  from SGD article prices. Zero gross/net denominators are `null`, not zero waste.
- **Gross spend buying a fact used in the final answer** (`usedSpendPct`): cost of
  verified purchases whose `gainedFacts` intersects final bank-supported requested
  fact IDs / gross purchase cost. A fact appearing in v2 but disappearing from the
  final answer does not count; refunded purchases never count. This measures the
  cost of purchases that contributed a surviving fact, not price per individual
  fact, semantic quality of all prose, or independent provenance beyond bank labels.
  Gross waste remains the historical immediate-gain measure; this additional
  final-use metric does not rewrite it.
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

### Receipt value policy (#276)

`OFFSET=700 make scorecard LIVE=1 ARGS='--split dev'` measures semis/packaging;
`--split heldout` measures rates/power. `receipt-split.json` was committed before
this task's tuning. Whole topic families stay together. This is prospective
holdout within #276, not a never-seen benchmark: earlier work used the bank.
`DECISION_VALUE_POLICY=off` replays the pre-#276 policy and v3 provenance wording.
The final run uses the v4 wording plus the deterministic utility filter; the
comparison measures their combined effect. Do not tune after inspecting holdout.

On the owner's Mac, run `make scorecard LIVE=1` then `make refit`. The latter opens
the store read-only through `scripts/export-decision-labels.ts`. It filters to the
frozen dev questions and one exact provider/model/prompt key, and learns only from
settled receipts. VERIFIED, cited, supported gain is positive; refunded or VERIFIED
uncited/no supported gain is negative; unresolved delivery and indeterminate support
are excluded. Generic non-bank questions without support labels are excluded.
No cron, CI job, external scheduler or payment is installed by this feature.

Reproduce the committed dev fit without any network:

```sh
npm run calibration:refit -- --flow-report eval/decisions/datasets/receipt-value-v4-dev.json --out /tmp/receipt-value.json
```

`fit-calibration.ts` uses question-grouped dev CV, selects identity/Platt/isotonic
by Brier, then selects a utility threshold on dev OOF receipt predictions. It
requires sufficient positive/negative receipts and non-regressing OOF receipt F1;
rejected fits never overwrite the active file. Threshold selection is optimistic
within dev, and receipt labels are conditional on past purchases. Heldout flow
quality remains the external test. The accepted map is keyed and versioned in
`data/calibration/receipt-value.json`; restore the previous version with Git to
revert a refit. `DECISION_VALUE_POLICY=off` reverts the whole treatment.

The decision row's existing reason text now shows expected missing facts per S$
and the threshold. `marginalValue` preserves the underlying probability, trust-
weighted expected gain, covered menu count and fit version for API/report readers.
The UI source is untouched. Menu matching can only veto; it cannot grant access,
mark a requirement supported, or authorize spending. Missing or ambiguous menus
keep the probability estimate. A long menu cannot multiply one targeted fact's
value. Gross waste still counts refunded purchases.


### Numbers v6: gross/net and extraction repair (3 Nov)

The v5 bank, corpus, coverage snapshots and 48-dev/92-heldout split remain frozen.
`frozen-pre-spend-extraction.json` preserves the prior candidate; v6 fingerprints
both new code and the metric implementation. Freeze before either run:

```sh
OFFSET=700 DECISION_NUMBERS_POLICY=off EVAL_LIVE=1 EVAL_SPEND_CAP_USD=1 npm run scorecard -- --live --split heldout
OFFSET=700 EVAL_LIVE=1 EVAL_SPEND_CAP_USD=1 npm run scorecard -- --live --split heldout
node --import tsx scripts/report-numbers.ts <before-report.json> <after-report.json> eval/scorecard/spend-extraction-results.json
node scripts/readme-scorecard.mjs
```

The baseline switch retains v5 extraction/filtering and scope/v1. The default
adds requested-passage ranking and fact-menu scope/v2. No heldout retuning, fitting,
label changes or cross-run inference replay. All six quality metrics now receive
the same 2,000-replicate, seed-700 source-cluster CIs and paired delta CIs.

The deterministic fact-menu rule handles known capex, capacity, lead-time and
issuance keys. It requires one compatible signed entry with the requested year
and a matching subject (specialized package/process ahead of company names).
Public titles can supply subject/metric context. A verified schema-v2 manifest
with no promised entries cannot establish an explicit requested key. Missing,
legacy or invalid manifests remain unknown. Today's menus are coarse: years do
not prove exact quarters or dates; one of several named package types does not
prove the entire comparison/trend. This is a necessary rejection check, never a
coverage assertion or a grant. These limitations and any false negatives remain
visible in the unchanged heldout labels.

The writer's extractive fallback ranks only accessible, instruction-filtered
passages by requested-fact terms and inverse passage frequency. It preserves
existing requested evidence and adds the best tied passages (at most two per
requirement, five requirements) before the final citation validation. Ordinary
"buying ... now sends" prose no longer matches the buy/purchase command detector;
actual purchase instructions remain filtered. LIVE decision/coverage results
still use a fixture writer, synthetic corpus, keyword search and simulated
payments; they do not establish live DeepSeek synthesis or XRPL performance.
