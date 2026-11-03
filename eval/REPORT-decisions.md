# Decision model on the real corpus (#212) and the calibration fit (#207)

**Date:** 9 October 2026. **Chosen provider:** OpenAI Decisions `gpt-6-luna`, prompt version
`batch-evidence/v1+gap-plain · originality original,rewrite,overlap · credibility 0,1,2`, 25 questions per request
(`DECISION_PROVIDER=openai`, `DECISIONS_MAX_QUESTIONS=25`, default wordings).

Labels: **LIVE** = real provider calls. **SYNTHETIC** = the 8 Oct benchmark's templated data. **REAL corpus** =
`data/corpus/v2`, the articles the product searches and sells (themselves synthetic writing for the demo).

## 1. Real-corpus validation of the chosen provider (LIVE, REAL corpus)

`eval/decisions/offline.ts --decision production` on branch `calibration` at `d4b3f59`, run once by the coordinator:
165 Decisions calls in total (sweep + flow), US$0.116 metered from `usage`, 0 errors, 0 failed rounds. All 48 bank
questions (53 requested facts). Each round judges a frozen requested fact (`requested[].need`) with gap_material fixed
at 1, as `main` does since #221, after one free follow-up search. **Substituted, labelled:** keyword-only search (no
embeddings), the extractive fixture writer, the bank's scripted needle check for coverage, simulated payment. This
measures the decision model inside the real policy, not the full live demo.

Per-candidate rows: `eval/decisions/datasets/luna-requested-2026-10-09.jsonl` (flow, 395 rows) and
`luna-sweep-2026-10-09.jsonl` (one round per fact, nothing bought, 593 rows).

### Flow results (raw scores, threshold 0.20)

| Slice | Questions | Facts supported: free only → with purchase | Buys / question | Spent | Wasted | First purchase F1 vs bank |
|---|---|---|---|---|---|---|
| Overall | 48 | 37.7% → 47.2% | 0.15 | S$4.05 | S$1.60 | 0.24 (precision 0.67, recall 0.15) |
| Free sufficient | 11 | 90.9% → 90.9% | 0 | S$0 | S$0 | – |
| Hard cases | 8 | 25.0% → 37.5% | 0.38 | S$1.60 | S$0.70 (S$0.30 refunded) | 0.29 |
| Paid needed | 19 | 4.8% → 9.5% | 0.05 | S$0.25 | S$0 | 0.10 (precision 1.0, recall 0.05) |
| UC variants | 10 | 53.8% → 76.9% | 0.30 | S$2.20 | S$0.90 | 0.67 |

Citation validity was 100% throughout. Stops: 21 complete, 26 no eligible purchase, 1 round limit.

**Findings:**
- **Precise but under-buying.** At the raw 0.20 threshold Luna's buys are usually right (precision 0.67 overall, 1.0
  on paid-needed), but it almost never buys on paid-needed questions (1 of 19). The cause is the one #214 saw on Q35
  and Q38: most paid abstracts tease the figure rather than name it, and the evidence wording ("the same entity,
  measure, time period") scores teasers near 0. In the sweep, 14 of the 21 rows labelled as the right buy have raw P(addresses gap)
  of 0.17 or lower.
- **Free sufficient:** nothing bought on any free-sufficient question.
- **UC variants:** UC2 (Q09, Q16) buys NotFT and gains both facts. The UC3 variant (Q18) buys The Fab Floor directly and
  gains the dated series: under keyword search Luna rates The Fab Floor (0.80) above AlphaLeak (0.53), so the refund
  scene did not occur in this harness. The live UC3 smokes in #214 (3/3, with embeddings and the DeepSeek writer) had
  AlphaLeak win round 1. Q10 bought NotFT for a capacity-slot fact The Fab Floor holds (S$0.90 wasted).
- **Hard case Q44** (wrong entity) bought AlphaLeak (refunded), then The Fab Floor, for a fact neither holds; the only
  round-limit stop. **The unanswerable Q42 bought nothing.**

## 2. Live comparison against Clef-flash (LIVE, demo topology)

From #214 (9 Oct, 02:20–05:10 SGT): live smoke on `main`, embeddings, DeepSeek writing, XRPL Testnet settlement.

| Configuration | UC1 no buy | UC2 buys NotFT | UC3 (AlphaLeak refunded, then The Fab Floor) | Refusals | 5 new real-corpus questions correct |
|---|---|---|---|---|---|
| Clef-flash, production (baseline) | ✓ | 1/1 | **0/2** (The Fab Floor 0.136 / 0.064 < 0.15) | 0 | 2/5 |
| OpenAI Decisions, evidence wording + evidence gap question (5 smokes) | 10/10 | 4/10 | 4/10 | 2 | 2/5 |
| **OpenAI Decisions, evidence wording + plain gap question (chosen; 3 smokes)** | 3/3 | 3/4 | **3/3** | **0** | **3/5** |
| OpenAI Decisions, production wording + plain gap question (3 smokes) | 3/3 | 4/4 | 4/4 | 2 | 2/5 (bought on unanswerable Q42) |

Decision recorded on #214: `DECISION_PROVIDER=openai` with the plain gap and evidence candidate wordings. Live cost
of the comparison was about US$0.6. #221 has since removed the gap_material question for requested facts (fixed at 1).

The 8 Oct benchmark (SYNTHETIC, 64 held-out scenarios × 3) still sets the direction: Luna raw at 0.20 had held-out
F1 0.915 and Brier 0.031, against 0.505 and 0.186 for Clef-flash raw at 0.15. On the real corpus, raw F1 is much
lower (section 3), mostly through recall: real abstracts are harder than templated ones.

## 3. Calibration fit (#207; fitted on the LIVE sweep, REAL corpus)

```
npm run calibration:fit -- --data eval/decisions/datasets/luna-sweep-2026-10-09.jsonl --report-dir eval/decisions/reports
```

Cross-validation is grouped by topic family (4 lanes, so leave one family out); every fit was also re-run grouped by
question (48 groups). The fit is **accepted** by the script's own rule (CV Brier no worse for either target, purchase
F1 no worse than raw at the raw threshold). Committed: `data/calibration/openai-gpt-6-luna-35d990c7.json` (v1);
report `eval/decisions/reports/calibration-fit-openai-gpt-6-luna-35d990c7.md`.

| Target | Chosen method | CV Brier raw | Platt | Isotonic |
|---|---|---|---|---|
| P(addresses gap) | Platt (a = 0.343, b = 0.250) | 0.039 | **0.034** | 0.036 |
| P(original) | identity | **0.030** | 0.034 | 0.035 |

Sample: 593 rows, 34 open-fact decisions; addresses-gap 30 positive of 584 labelled (9 unknown); original 530 of
593; 21 buy positives.

| Purchase decisions (34 open facts) | Threshold | F1 | Precision | Recall | Wasted |
|---|---|---|---|---|---|
| Raw, production threshold | 0.20 | 0.414 | 0.750 | 0.286 | S$1.20 |
| Raw, best threshold (post hoc) | 0.015 | 0.700 | 0.737 | 0.667 | S$2.60 |
| **Calibrated (out of fold), proposed threshold** | **0.119** (calibrated scale) | **0.708** | 0.630 | 0.810 | S$4.15 |

| Data | Grouping | Methods | F1 raw at 0.20 → calibrated | Proposed threshold | Accepted |
|---|---|---|---|---|---|
| Sweep (committed) | family | Platt / identity | 0.414 → 0.708 | 0.119 | yes |
| Sweep | question | Platt / identity | 0.414 → 0.708 | 0.114 | yes |
| Sweep + flow (`--mode all`, 988 rows, 69 decisions) | family | Platt / identity; Brier 0.045 → 0.039 | 0.386 → 0.659 | 0.117 | yes (report in `eval/decisions/reports/sweep-plus-flow/`) |
| Sweep + flow | question | Platt / identity | 0.386 → 0.641 | 0.161 | yes |

**Why calibration stays OFF:**
- **The gain is the threshold, not the calibrator.** Platt with a = 0.34 compresses hard (raw 0.01 → 0.21, 0.5 → 0.56,
  0.98 → 0.81). It is monotone, so it never reorders candidates within a round. Almost all of the F1 gain is a lower
  bar: raw at a post-hoc 0.015 reaches 0.700, against 0.708 calibrated. Both are optimistic, because the threshold is
  chosen on the values it is scored on.
- **It buys on weak evidence, wastefully as well as usefully.** The calibrated policy buys candidates Luna scored
  0.01–0.04. That is right on Q07, Q08, Q30, Q38, Q40 and Q41, but wasteful on Q04 and Q06 (UC1 variants), Q13, Q19
  (free-sufficient), Q20, Q35, Q37 and the unanswerable Q42 (a MarketPulse post that is not a rewrite). In Q18 it
  picks AlphaLeak first, as the UC3 story wants. Waste rises from S$1.20 to S$4.15 over 34 decisions.
- **Small sample.** 21 positives in 4 topic families. The same kind of fit on templated data broke the demo the other way.
- **Default stays raw.** The demo keeps raw scores at 0.20 with `DECISION_CALIBRATION` unset. The calibrator applies
  only with `DECISION_CALIBRATION=on` and this exact (provider, model, prompt version). Run a live UC1–UC4 smoke with it
  on before anyone switches it on.
- **Fixture tests:** with a calibrator on, the rewrite guard still reads raw originality, so the MarketPulse digests are
  never bought, and UC3 still buys AlphaLeak, then The Fab Floor (`tests/decision-calibration.test.ts`).
- **The better lever is content.** The paid abstracts tease rather than name the figure; sharpening them (as #214
  suggested) raises raw recall without trading away precision.

## 4. What remains (#212)

- **Clef 27B on held-out data: not run.** It needs about 1,300 calls on a paid Cloudflare plan; the free allowance is
  reserved for the demo (decision 9).
- **Latency at production topology: not measured here.** The only figure is per call: Luna's coverage requests in #213
  ran at p50 285 ms and p95 647 ms with 1–2 in flight. Still needed: 9 concurrent calls through the live server path
  with real 3–5 s aborts, and the fallback rate per use case over at least 10 runs (`EVAL_CONCURRENCY=9`,
  `EVAL_DECISION_TIMEOUT_MS=5000`).
- Human review of the 30 gold items and of the bank sample: pending.
- The raw-threshold band for UC3 under live values: not mapped beyond the #214 smokes.
- No non-inferiority margin was preregistered; the switch used #214's preregistered rule.
- One run only. The transport cache returns the same answer for an identical request, so a repeat needs a fresh `EVAL_OUT`.

## 5. Signed fact menu (#260), 3 November 2026 SGT

**LIVE decision and coverage models; synthetic real-product corpus.** The
planner/writer remain extractive fixtures, search keyword-only, settlement
SIMULATED (zero Testnet drops transferred). Flow support uses the unchanged bank
needles, not live semantic grading. These numbers do not establish full-product,
XRPL latency or held-out performance. The same 48-question bank was used during
wording development; this is an iterative benchmark, not an independent test set.

The interrupted run already recorded a valid **live, pre-fact-menu** baseline
at `2026-11-02T16:30:12.474Z` (3 Nov SGT), input hash `a528dd97…`, 296 calls,
US$0.1469052. Its original raw report and meter were inspected, with zero failed
rounds and zero gate violations. It was preserved, not repeated. Final after:
`2026-11-03T01:38:25.629Z`, input hash recorded in `eval/scorecard/latest.json`,
259 calls, US$0.1164431. Rows identify evaluated HEAD and `worktreeDirty: true`;
the frozen source/content hashes identify the treatment, including uncommitted
source at measurement. History is append-only, including intermediate results.

| Metric | 9 Oct LIVE reference | 3 Nov LIVE pre-menu | 3 Nov LIVE post-menu |
|---|---:|---:|---:|
| Selection F1, first purchase (flow) | 0.24 | 0.235 | **0.600** |
| Selection F1 (sweep) | 0.414 | 0.400 | **0.681** |
| Wasted gross spend | 39.5% | 36.19% | **38.41%** |
| Supported-fact uplift | +9.5 pts | +11.32 pts | **+30.19 pts** |
| False-complete (live coverage model) | 1.9% | 1.89% | **1.89%** |
| Flow citation validity | 100% | 100% | **100%** |
| Six-rule audit violations, ten timed API runs | not measured here | 0 | **0** |

**F1 ≥ 0.45 met; waste ≤ 25% missed.** Waste is below October's reference but
**2.22 percentage points worse than the fresh pre-menu baseline**. This is not a
waste-reduction result. Flow spent S$16.40 simulated gross, S$6.30 wasted, S$1.20
refunded; refunds do not restore budget or erase gross waste. Facts supported
rose from 20 free to 36 after paying (of 53). UC1 buys nothing and UC3's lying
AlphaLeak menu still fails proof, quarantines and refunds in the unchanged
scenario tests. The benchmark's question variants do not all reproduce the
exact UC3 shopping order; do not present the tests as live XRPL proof.

Fixture before → after is unchanged: flow/sweep F1 **0.310/0.222 → 0.310/0.222**,
waste **67.93% → 67.93%**, uplift **+28.30 → +28.30 pts**, overlap-fixture
false-complete **37.74% → 37.74%**, zero provider calls, zero gate violations.
The fixture decision provider ignores menus, so this verifies regressions and
gates, not live menu efficacy. `make scorecard ARGS='--check --compare f0951d4'`
passed against the final treatment's matching fixture row. Its deterministic
quality deltas were all zero:

```text
quality.wastedSpendPct        67.93388429752066 → 67.93388429752066  delta 0
quality.selectionF1Flow        0.3103448275862069 → 0.3103448275862069 delta 0
quality.selectionF1Sweep       0.2222222222222222 → 0.2222222222222222 delta 0
quality.supportedFactUpliftPts 28.30188679245283 → 28.30188679245283  delta 0
quality.falseCompleteRate      0.37735849056603776 → 0.37735849056603776 delta 0
```

The v1 → v2 comparison is explicitly a treatment comparison: the full hashes
must differ because prompts and metadata changed. `--compare` still refuses
that cross-hash comparison. `frozen-pre-fact-menu.json` preserves the old set;
`tests/fact-menu.test.ts` proves bank, corpus prose (remove only `factMenu`) and
constructed coverage snapshots match. No regression check, fixture, bank,
spending threshold or 8-word leak threshold was loosened.

**Implementation and integration.** Rebased onto Lane C #300 and kept its
manifest-v2 `claims[].covers` format, signing domain and bound-passage checker.
All 63 paid corpus articles have deterministic authored metadata, derived from
fixed vocabulary over the synthetic story's passages without reading the bank
or exposing values. Both decision providers receive up to eight distinct
schema-checked promises, labelled untrusted, from a signature bound to the same
publisher, wallet, article and version. Each field allows six words / 48
characters, no digits, markup or controls. Candidate text/tags are capped; the
requested-fact batch omits the source-influenced conclusion. A menu is a lexical
promise, not proof of semantic truth; kind checks and proof/refund paths remain
unchanged. Lane D #286 was still unmerged at this rebase; its shared input
sanitizer must replace the local cap helper when integrating that lane.

**Calibration re-fit.** Committed 593 final live-sweep rows in
`eval/decisions/datasets/luna-fact-menu-sweep-2026-11-03.jsonl`; ran
`npm run calibration:fit -- --data <that file> --report-dir eval/decisions/reports/fact-menu`.
The script accepted isotonic/identity: gap CV Brier 0.030 → 0.025; purchase F1
0.681 → 0.762 at proposed calibrated threshold 0.202. The chosen threshold is
optimistic on these same data. Calibration remains **OFF**, raw threshold
**0.20 unchanged**; this fitted improvement is not the live after score.

**Cost and unsuccessful attempts.** Total task model cost **US$1.0354309**,
including every recovered run, failed run and wording probe. A fresh attempt at
`2026-11-03T01:30:59.942Z` cost US$0.0879638 but refused one Q02 sweep judgment;
it published no baseline. Splitting contextual guidance from the scored
predicate resolved that failure without substituting a score. An intermediate
complete run reached F1 0.680 / 0.809 but waste 39.70%; the final wording stresses
entity/measure precision and forecasts versus observations. All attempts stay
metered in `eval/scorecard/lane-b-spend.json`. Costs are usage-derived estimates
at the harness's frozen rates, not invoices. Every scorecard has a US$1 cap;
the task stayed below US$3. README is generated from the final LIVE row, with
fixture research and simulated-payment labels (including the uppercase `LIVE`
mode fix).

**Next to move waste.** #276 should buy on marginal supported-fact gain rather
than first-purchase selection alone. Twelve purchases across ten questions added
no bank-supported fact. Q37 and Q45 picked related but wrong measurements;
Q44/Q48 still found the broad Penang lead-times promise attractive. More precise
measures/periods and less general menu vocabulary are needed. Q07/Q12 selected
the bank's expected article yet added no scripted support: audit their exact
needle/coverage contract before changing gold labels. Count that as an evidence
gap, not permission to relax tests or optimize away inconvenient questions.
