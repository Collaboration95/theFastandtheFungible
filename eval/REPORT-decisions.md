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

**LIVE decision/coverage models; synthetic product corpus; fixture planner/writer,
keyword search, SIMULATED settlement (zero XRP transferred).** Flow support uses
the unchanged scripted bank needles. This is not full-product/XRPL performance
or a held-out test: the same 48-question bank was used during wording development.

The interrupted run already recorded a valid **live, pre-fact-menu** baseline at
`2026-11-02T16:30:12.474Z` (3 Nov SGT), 296 calls, US$0.1469052. Its raw report,
meter and frozen input hash were inspected: no failed rounds, zero gate violations.
It was preserved, not repeated. Final after: **`2026-11-03T01:49:48.288Z`**, prompt
`batch-evidence/v3-fact-menu+gap-plain`, 260 calls, US$0.1180476. Both rows record
`worktreeDirty: true`; frozen source/content hashes identify the evaluated
implementation including uncommitted edits. History is append-only.

| Metric | 9 Oct LIVE reference | 3 Nov LIVE pre-menu | 3 Nov LIVE integrated post-menu |
|---|---:|---:|---:|
| First-purchase F1 (flow) | 0.24 | 0.235 | **0.419** |
| Selection F1 (sweep) | 0.414 | 0.400 | **0.513** |
| Wasted gross spend | 39.5% | 36.19% | **47.19%** |
| Supported-fact uplift | +9.5 pts | +11.32 pts | **+16.98 pts** |
| False-complete (live coverage model) | 1.9% | 1.89% | **1.89%** |
| Flow citation validity | 100% | 100% | **100%** |
| Six-rule audit violations (ten API runs) | not measured here | 0 | **0** |

**Both targets missed: F1 ≥ 0.45; wasted spend ≤ 25%.** Waste regressed 11.00
percentage points from the fresh baseline and is worse than October. This does
not satisfy the issue's original no-regression acceptance condition; the explicit
lane request to merge and report missed targets governs this delivery. No test,
regression rule, bank label, raw 0.20 threshold or leak threshold was loosened.
Flow supported facts rose from 20 free to 29 after paying (of 53). Simulated gross
spend S$8.90, waste S$4.20, refunds S$0.90. Refunds never restore spending authority
or erase gross waste. UC1 still buys nothing and UC3 still quarantines/refunds the
lying menu in fixture scenarios; those tests are not live XRPL settlement proof.

Fixture before → after: F1 **0.310/0.222 → 0.310/0.222**, waste
**67.93% → 67.93%**, uplift **+28.30 → +28.30 pts**, overlap-fixture false-complete
**37.74% → 37.74%**, zero provider calls and gate violations. The fixture provider
ignores menus. `make scorecard ARGS='--check --compare 2026-11-03'` passed:

```text
quality.wastedSpendPct         67.93388429752066 → 67.93388429752066  delta 0
quality.selectionF1Flow         0.3103448275862069 → 0.3103448275862069 delta 0
quality.selectionF1Sweep        0.2222222222222222 → 0.2222222222222222 delta 0
quality.supportedFactUpliftPts  28.30188679245283 → 28.30188679245283  delta 0
quality.falseCompleteRate       0.37735849056603776 → 0.37735849056603776 delta 0
```

Full hashes intentionally differ across treatments. `--compare` still refuses
cross-hash comparisons. `frozen-pre-fact-menu.json` preserves v1;
`tests/fact-menu.test.ts` proves unchanged bank, prose (remove only `factMenu`)
and constructed coverage snapshots. New fingerprints include the decision and
shared input-sanitizer sources. The integrated result includes #301's input
hardening; it cannot isolate the effect of fact menus alone.

**Implementation.** Rebased onto #300's publisher and #301's security work; one
manifest-v2 `claims[].covers` format, signing domain and bound-passage checker.
All 63 paid corpus articles have deterministic metadata from fixed noun vocabulary
over synthetic story passages, without bank access or exposed values. Both providers
receive at most eight schema-checked, signed promises bound to publisher, wallet,
article and version. Each field: six words / 48 characters, no digits, markup or
controls. The shared `untrusted.ts` sanitizer filters instruction-like menu phrases
and caps other metadata; requested-fact input omits the source-influenced conclusion.
Structured signing metadata survives local policy/provider projections, while the
model wire contains no full manifest, signature, wallet, leaves or private prose.
The strict injection-test allowlist adds only the new menu field and explicitly
asserts empty menus for unsigned malicious candidates; all existing checks remain.
Proofs check the same bound passage, kind, entity, measure and optional period/comparison;
broken promises use the unchanged quarantine/challenge/refund path. This is a lexical
promise check, not proof of semantic truth.

**Calibration.** Final 593 live-sweep rows are in
`eval/decisions/datasets/luna-fact-menu-sweep-2026-11-03.jsonl`. Ran
`npm run calibration:fit -- --data <that file> --report-dir eval/decisions/reports/fact-menu`.
The script **rejected** the fit: calibrated purchase F1 **0.488 < raw 0.513**.
The report is committed; no final calibrator was written. Calibration stays OFF,
raw threshold 0.20 unchanged. Earlier accepted v2 trial fits were not installed.

**Attempts and cost.** Total task model cost **US$1.2739735**, including all
recovered runs, failures, and probes; see `eval/scorecard/lane-b-spend.json`.
A refused Q02 sweep judgment cost US$0.0879638 and published no baseline. Earlier
complete v2 trials reached F1 0.600–0.680, but are not the shipped integrated result.
The first post-#301 trial measured F1 0.326, waste 49.46%; menu presence on the wire
was verified. Final v3 clarifies that untrusted instructions are ignored, while a
signed promise can still inform expected relevance; originality is judged separately.
This improved that trial's F1 to 0.419, but missed both targets. Refusals still fail
closed; no fixture score is substituted. Each scorecard caps calls at US$1; total
stayed below US$3. All prices are usage-derived at dated harness rates, not invoices.
README is regenerated from the final LIVE row with fixture/simulation labels.

**Next to move the numbers.** #276 should estimate marginal supported-fact gain,
not just first-purchase selection. Eleven purchases across eight questions added
no bank-supported fact. Q37 picked the wrong measurement; Q44/Q48 still found broad
Penang lead-time promises attractive. More precise measures/periods and a held-out
check of the hardened provenance prompts are needed. Q07 bought the expected
article yet added no scripted support: audit that exact needle/coverage contract
before changing gold labels. Never relax tests to remove inconvenient questions.

## 6. Receipt value buying (#276), 3 November 2026 SGT

**Waste target missed.** Headline is the prospectively held-out rates/power
families, 24 questions / 26 requested facts / 55 coverage snapshots. Dev is
semis/packaging, 24 questions / 27 facts / 61 snapshots. The split was committed
before tuning (`receipt-split.json`, originally `46ff943`, rebased to `3a22e1e`).
Earlier PRs used the full bank, so this is held out only within this task, not
historically unseen data. No held-out labels or results were used for tuning.

| Metric | Held-out LIVE before → after (headline) | Dev LIVE before → after |
|---|---:|---:|
| Wasted gross spend | 39.39% → **35.48%** | 51.79% → 44.19% |
| First-purchase F1 (flow) | 0.588 → **0.625** | 0.308 → 0.296 |
| Selection F1 (sweep) | 0.714 → **0.667** | 0.400 → 0.320 |
| Supported-fact uplift | +15.38 pts → **+15.38 pts** | +18.52 pts → +25.93 pts |
| False-complete | 5.26% → **5.26%** | 0.00% → 0.00% |

The held-out flow F1 ≥0.42 and uplift ≥+15 pts targets pass; waste <25% fails.
The issue's older waste ≤20%, flow F1 ≥0.5 and false-complete ≤2% contract also
fails on waste and false-complete. The sweep F1 regressed on both splits, and dev
flow F1 regressed slightly. The explicit instruction to merge and report misses
governs delivery; this is **not** a successful optimization or a no-regression
acceptance claim. No tests, leak checks, raw 0.20 gate, or audit rules were relaxed.

Secondary whole-bank aggregation of the two disjoint splits: gross waste
**47.19% → 41.36%**, flow F1 **0.419 → 0.419**, and uplift **+16.98 → +20.75 pts**.
This is not held-out evidence. The held-out false-complete rate is 1/19 missing
facts = 5.26%, not the full bank's 1/53 = 1.89%; the underlying coverage prompts
and snapshots did not change. Flow citation validity is 100% on both splits.
After-purchase support: held-out 12 → 16 of 26; dev 8 → 15 of 27. Gross simulated
spend: held-out S$3.30 → S$3.10, waste S$1.30 → S$1.10; dev S$5.60 → S$6.45,
waste S$2.90 → S$2.85. Refunds remain gross waste and do not restore authority. Whole-bank gross
spend rises S$8.90 → S$9.55 while waste falls S$4.20 → S$3.95: part of the
percentage improvement is more useful spending, not fewer purchases.

**What changed.** Deterministic policy requires P(adds the open fact) × seller
trust × novelty / price ≥ **0.5 expected facts/S$**, in addition to every existing
raw-value, rewrite, trust, cap, budget and reservation guard. At most one fact is
valued per round: menus cannot inflate value by listing many promises. The original
value/S$ ranking and neutral hash tie-break remain. A signed menu fully covered
by accessible evidence vetoes a redundant purchase. Cross-source lexical matches
require a specific period or comparison and an affirmative quantitative sentence;
absence statements and broad topic overlap never count. This is a conservative
lexical veto, not semantic proof of duplicate measurements or a coverage grant.
Only the free/verified-grant accessor supplies evidence locally; no new premium
content goes to pre-purchase model requests. The model still only scores.

The existing decision-table reason text exposes expected facts/S$ and its threshold;
structured decision rows also retain probability, novelty and fit version. No
`src/` change. Live provenance wording is v4: shared entities/events are not
proof of derivation, and independent analyst estimates can add new evidence to
a public filing. `DECISION_VALUE_POLICY=off` restores both old policy and v3
wording for the baseline. This before/after measures their combined effect,
not the isolated causal effect of learning or duplicate suppression.

**Learning evidence and its limits.** `make refit` / `npm run calibration:refit`
uses the read-only store exporter and the shared math in `fit-calibration.ts`.
Settled VERIFIED+cited+supported gain is positive; refunds and VERIFIED uncited/no
gain are negative; unresolved/indeterminate outcomes are excluded. ANSWER events
now bind each intent to exact before/after versions so a kept free follow-up is
not mislabelled as paid uplift. Keyed maps fail closed to raw probabilities on a
provider/model/prompt mismatch; rejected refits never replace the active file.

The initial v3 dev fit (13 receipts) was rejected: OOF receipt F1 0.429 < 0.556.
The v4 dev trial provided 11 simulated receipts across 10 questions (6 gains,
5 negatives). Grouped dev Brier: identity **0.2197**, Platt **0.2582**, isotonic
**0.2714**. The accepted v1 artifact therefore keeps **identity** probabilities
and a dev-selected **0.5** utility threshold; receipt-filter F1 stays 0.706.
No statistical calibration gain was demonstrated. These labels are from live
model decisions on synthetic articles, a fixture writer and scripted support,
not real customer outcomes. They are conditional on historical purchases; the
threshold is tuned on dev OOF predictions and optimistic within dev. Reproduce
from `eval/decisions/datasets/receipt-value-v4-dev.json`; both rejected/accepted
reports are committed. Refitting is a local command, not an installed schedule.

**What worked / did not.** The combined policy/prompt treatment reduced held-out
waste by 3.91 points, improved first-purchase F1, and retained all four marginal
supported facts. It did not reach 25% waste. Cheap wrong measurements and broad
menus still attract purchases; a price-aware cutoff alone cannot repair relevance.
The more aggressive first trial hit 55% dev waste and lost support. An early
lexical veto falsely treated “no customer lead times” as covered by unrelated
capacity figures in the same paragraph; the unchanged UC3 scenario exposed it.
Fixing that bug restored the required refund story but worsened the attractive
35.14% dev trial to the shipped 44.19%. Those trials are retained in append-only
history and are not the headline. Stronger receipt calibration was rejected or
lost to identity. More precise measurement/period promises and independent
support labels remain necessary; no held-out retuning was performed.

**Evidence and validation.** Final held-out baseline `2026-11-03T02:16:12.411Z`;
final held-out after `2026-11-03T02:17:24.180Z`; integrated dev after
`2026-11-03T02:18:55.229Z`. Frozen v4 hashes pin source, bank, prose,
menus and constructed snapshots. Rebased onto #305/#306 before held-out calls;
source fingerprints match the integrated candidate. Full comparison data is in
`eval/scorecard/receipt-value-results.json`. `latest.json` publishes the declared
held-out headline; later dev/fixture validation remains in history. Cross-treatment
`--compare` still refuses incompatible policy/input hashes. After-treatment fixture
`--check` is a same-treatment repeatability check, not a no-regression claim versus
old policy. Fixture differences are recorded below.

- `OFFSET=700 npm run check:fast`: hygiene/lint/typecheck and the full suite pass;
  UC1 no-buy, UC3 refund/quarantine, injection, idempotency, leak and recovery gates
  retained. Only exact prompt-version expectations changed for v4.
- `OFFSET=700 npm run test:e2e`: production build and all four browser tests pass,
  including UC2 proof/purchase and UC3 refund/quarantine, ephemeral ports.
- Final integrated dev+held-out API audit: **zero violations / 10 runs / 464 wire
  observations**. Independent `gate:audit` of the held-out raw store and its wire
  observations also reports zero; audit code is unchanged in this PR.
- **Total task model cost US$0.5753331**, every metered dev trial,
  held-out baseline/final and integrated verification included. Per-run cap US$1;
  task cap US$4. Usage-derived estimates at dated transport rates, not invoices.
  Itemized in `eval/scorecard/receipt-value-spend.json`.

All LIVE labels mean **decision and coverage models only**. Corpus is synthetic;
planner/writer are extractive fixtures; search is keyword; payments SIMULATED;
**zero XRP transferred**. Timing is local Mac wall clock, not full product or XRPL
latency. No cloud resources, real-money payments or credential output.

Fixture, full 48-question bank, same integrated source: waste **67.93% → 65.60%**,
flow F1 **0.310 → 0.308**, sweep F1 **0.222 → 0.235**, uplift **+28.30 → +22.64 pts**,
false-complete **37.74% → 37.74%**, zero calls and audit violations. Fixture uplift
regresses 20%; this is reported, not hidden by changing labels or a threshold.
The same-treatment `--check --compare 2026-11-03T02:18:54` repeat passes with all
quality deltas zero; the first attempt used hyphens instead of timestamp colons
and was rejected before making calls. No comparison rule was changed.

## 7. Numbers: error taxonomy, expanded bank and frozen heldout (3 Nov 2026)

The new heldout result is flat. Waste remains above the 25% target.

| Metric | Before (95% CI) | After (95% CI) |
|---|---:|---:|
| Wasted gross spend | 52.87% [28.30, 73.31] | 52.87% [28.30, 73.31] |
| First-purchase F1 (flow) | 0.530 [0.347, 0.673] | 0.530 [0.347, 0.673] |
| Selection F1 (sweep) | 0.660 [0.479, 0.796] | 0.660 [0.479, 0.796] |
| Supported-fact uplift | 32.61 pts [20.99, 44.87] | 32.61 pts [20.99, 44.87] |

All four paired change CIs are [0, 0] on these observed model draws. This is
not proof of a zero population effect: the 92 quality trajectories and picks
match; the scope veto did not change this sample. The final pair used two fresh isolated run directories and 966 metered
requests, including coverage and ten timing queries in each run, with no
cross-run response replay. An earlier pair is retained in history; all four
runs used 1,866 metered requests in total. Within each run identical requests
share the existing transport cache; the bootstrap does not treat those as
independent model repetitions.

The bank grew **48 → 140 questions (53 → 145 facts)**. All 48 historical
questions are now dev, because earlier work used the old full bank. The new
heldout has **92 distinct fact questions in 20 source-article clusters**,
with 193 coverage snapshots. No new article prose, old bank labels, leak
checks, thresholds or gates changed. New facts are curated from exact existing
planted passages via `additions.v2.json` and `generate-eval-bank.ts`; human
review is pending. The additions are OpenAI-authored, the same vendor as Luna.
This is disclosed in v2 rather than copying the original Anthropic authorship
and different-vendor claim. Documents were already visible as candidates; only
these questions are prospective. Do not compare these results directly with
#307's old 24-question heldout or claim unseen-document generalization.

The intervals are 2,000-replicate, seed-700, 95% percentile bootstrap intervals
over whole source articles, preserving all their question and sweep rows.
There are only 20 independent source clusters. The waste interval remains
wide; more questions did not manufacture narrow confidence. A narrow
production-quality estimate would need independently authored documents,
human-reviewed labels and repeated provider draws. We have not achieved that
precision claim. The reported intervals condition on this synthetic corpus
and the observed model draws.

The pre-registered candidate adds a deterministic country contradiction veto:
explicit Singapore requirements cannot buy an explicitly Vietnam-scoped signed
source on model confidence alone. Unknown or unsigned menus stay unknown;
comparisons can match any named country. It addresses one subcase of the top
root-cause category, not every adjacent measure/date/package mismatch. No model
can grant content access or spend. All-high-score regression tests prove the
historical Q38 veto while preserving same-country and multi-country cases.
No threshold fitting, menu changes, writer changes or heldout retuning.

`docs/evidence/waste-analysis-2026-11-03.md` records four root causes across all
10 final wasted #307 purchases (S$3.95 gross), with a 21-observation canonical
before/after inventory and all 48 wasted observations in nine recovered live
trials. Two are extractive-writer failures despite delivered facts; do not hide
them by relabelling success. #304's original flow store was not recovered; its
593-row sweep and aggregate history cannot reconstruct selected purchases. The
#307 Before reports provide an integrated #304-policy baseline, not the
original #304 run. Running `export-decision-labels.ts` on the recovered final
API stores found four charged dev intents (three determinable) and zero
heldout intents; those timing samples are not the full quality flow.

Initial candidate freeze: `d08f674` (rebased as `02a090b`). Integrated freeze:
`18a538e`. Final baseline: `2026-11-03T03:02:38.955Z`; final after:
`2026-11-03T03:02:40.926Z`. Same frozen input hash:
`0133fcce57685bc266940bec4fd733a36fbd7565a3e3fba0d554820801a36e18`. A rebase brought in #308's escrow failure-recovery message/next-action change
in `server/agents/loop.ts`, which changed the source fingerprint. No policy or
label tuning followed: the entire pair was repeated on the integrated freeze.
The first pair (02:48/02:52 UTC) remains in history and the ledger, with its
fingerprint preserved in `frozen-numbers-first-pair.json`. The first baseline
had zero timing/API-audit samples before the sample-ID fallback was repaired;
it is superseded as the headline. Both integrated runs measure ten API queries.
The final after has **0 violations / 10 API runs / 728 wire observations**,
including actual delivery-proof and money-chain rules. Payments stay
**SIMULATED; zero XRP transferred**. Research is extractive fixture, search is
keyword, decision and coverage models are LIVE.

Total task spend **US$0.8681326 / US$5**, usage-derived at the transport's dated
rates, not invoices: `numbers-spend.json` accounts for both runs, including
timing calls. `numbers-results.json` retains compact scoring inputs, individual
CIs and paired delta CIs; `scripts/report-numbers.ts` reproduces comparison
from raw reports without provider calls. Fixture before/after quality is also
flat; the same-treatment regression check remains intact.

Validation: bank verification and unchanged corpus leak checks pass; 660 unit
tests and all four browser end-to-end tests pass. The historical menu test still
checks the exact v1 bank/prose/snapshot hashes; v2 is tested separately with
honest author provenance. No test or gate has been loosened.

## 8. Gross/net spending and requested-fact extraction (3 Nov 2026)

The v6 candidate is frozen before the fresh heldout pair. Bank v2 (140
questions), its 48-dev/92-heldout split, all source prose/menus and constructed
coverage snapshots are unchanged. `DECISION_NUMBERS_POLICY=off` reproduces
v5 extraction and country-scope policy; default adds the repairs below. The
prior freeze and #318 results remain intact. No heldout fitting or retuning.

### What the historical failures actually were

- **Q07, BoJ 7–2 vote:** the requested-fact pass used a binary lexical coverage
  shortcut. An adjacent summary could be treated as already answering the
  requirement, while freshness/tag ranking filled the eight broad-summary slots
  with other spans. Ranking accessible passages by requested terms and inverse
  passage frequency, retaining ties and preserving existing requested evidence,
  keeps the paid p1 vote in both v2 and the next rewrite. It uses no bank needles.
- **Q48, HBM 41 vs 29 weeks:** p1 never reached selection. The source instruction
  regex matched `buy` inside “buying” and then `now` in a later sentence, removing
  the entire verified passage as an instruction. Word boundaries on buy/purchase
  repair that false positive. Direct purchase instructions remain blocked, with
  the existing injection pack and added command-token regressions.
- **Q21/Q37/Q44/Q38:** deterministic policy rejects a known requested fact key
  without a compatible signed entry and subject/year scope. This catches the
  undated Malaysia digest (its verified v2 manifest has no fact claims), general
  TSMC capacity for a CoWoS requirement, Kestrel queues for QFN/BGA, and the existing
  wrong-country Singapore/Vietnam case, even under all-high model scores. All
  four intended sources remain eligible in regression tests. Unknown/legacy/
  invalid menus keep the model fallback. Coarse menus still cannot establish
  every quarter, date, named package or trend; the rule only rejects, never
  asserts coverage or grants access. Public titles supply context.

The answer fix is in the server's extractive fallback; no UI change is needed.
The #312 headline presentation remains with that lane. Citation validation is
unchanged: each selected claim retains its exact resource/version/span binding
and must resolve against supplied free or verified-grant contents. Live
DeepSeek synthesis has not been measured by this fixture-writer evaluation.

Gross waste keeps the historical immediate-gain numerator and gross denominator.
Net waste subtracts confirmed wasted refunds from the numerator and all confirmed
refunds from the denominator; a pending challenge is not a refund. The harness
models refunds synchronously and all payments here are **SIMULATED**, with no
on-chain execution or fees measured. Net does not replenish budget authority.
The extra used-spend share counts purchases adding a requested fact that survives
in the final answer. Definitions and zero-denominator behavior: `eval/README.md`.

### Fresh heldout result

| Metric | Before (95% CI) | After (95% CI) |
|---|---:|---:|
| Wasted gross spend | 52.87% [28.30, 73.31] | 40.68% [11.18, 68.40] |
| Wasted net spend (confirmed simulated refunds) | 52.87% [28.30, 73.31] | 40.68% [11.18, 68.40] |
| Gross spend buying a final-used fact | 47.13% [26.69, 71.70] | 59.32% [31.60, 88.82] |
| First-purchase F1 (flow) | 0.530 [0.347, 0.673] | 0.526 [0.349, 0.667] |
| Selection F1 (sweep) | 0.660 [0.479, 0.796] | 0.660 [0.484, 0.800] |
| Supported-fact uplift | 32.61 pts [20.99, 44.87] | 35.87 pts [22.11, 49.50] |

**Gross waste target still missed (40.68% ≥25%).** Gross/net waste decreased
12.19 pts (paired 95% CI −28.57 to −1.23); used-spend share increased 12.19 pts
[1.23, 28.57]. No refunds occurred in either heldout run, so gross and net
coincide. Flow F1 slipped 0.00360 [−0.03368, 0.02052]; sweep slipped 0.00019
[−0.03376, 0.03105]. Uplift increased 3.26 pts [0.00, 8.18]. Free-supported
facts rose 6 → 13; final-supported facts 36 → 46 of 92. This is primarily better
fact use, not an established selection-F1 improvement.

Source-cluster bootstrap: 20 sources, 2,000 replicates, seed 700; conditional on
fixed synthetic documents and observed model draws. Wide intervals remain;
source documents and the prior aggregate results were already visible. No
heldout retuning. LIVE decision/coverage, fixture writer/planner, keyword search,
**SIMULATED payments, zero XRP**; no live DeepSeek or chain-refund claim. Both
raw API audits: **0 violations / 10 runs / 728 observations** each.
Model cost **US$0.4412058 / US$4** (usage-derived at dated harness rates, not an
invoice). `eval/scorecard/spend-extraction-results.json` retains exact scoring
inputs and CIs; `spend-extraction-spend.json` accounts for all 946 requests.

Baseline `2026-11-03T03:25:08.427Z`; after `2026-11-03T03:27:11.020Z`.
Evaluated candidate `b3ca4f7`, input hash
`b0b5bb4016e2c1c4444c06a65a0b3f0a66b37de4fe9536a1ff19d62544edc2ed`.
Dirty flags cover documentation and the generated preceding history row;
evaluated source matches the committed freeze. Each run has a fresh cache.
Gross simulated article cost S$29.60 → S$26.55; wasted cost S$15.65 → S$10.80;
refunded cost S$0 → S$0; used cost S$13.95 → S$15.75. Neither refunded purchases
nor failures are removed from the historical gross metric. The older dev sample
illustrates the accounting difference: gross 44.19%, net 35.14% after refunds.

Validation: 678 unit tests and four browser end-to-end tests passed before the
UX rebase; bank verification and unchanged corpus leak checks pass. Final
integrated validation is recorded in the PR. No test, leak check, gate audit,
raw decision threshold or spend cap was loosened. The source command detector's
word-boundary correction and bounded extra requested claims are explicit
behavior changes, not claims that production synthesis has been measured.

## 9. Numbers v7: wafer-domain veto, identifiers, pitch headline (3 Nov 2026)

**Pitch: 80.05% of gross spend bought a requested fact used in the final cited
answer (95% source-cluster CI 63.16–92.00%).** Numerator S$16.25: verified,
non-refunded purchases adding a bank-supported requested fact that survives in
the final answer. Denominator S$20.30: all gross purchase cost. This is a cost
share, not the percentage of facts or questions answered. LIVE decision and
coverage, fixture planner/writer, keyword search, synthetic corpus and
**SIMULATED benchmark payments**. Separate real-Testnet evidence is below.

### Diagnosis and minimal repairs

The complete historical #320 inventory is `docs/evidence/waste-320.json`, with
its evidence limits in `waste-320.md`: **20 adjacent/incomplete purchases,
S$9.65; four extraction failures, S$1.15; zero broken-proof or provenance-only
failures**. All 24 purchases passed proof, with zero refunds. Source passages
plus recorded empty gains establish extraction failures; the compact historical
artifact does not retain full answer text, so these are not reconstructed traces.

Two general repairs, tested using dev Q09/Q13/Q35 and arbitrary synthetic
identifiers (N8/N9), with no held-out identifiers/needles in implementation:

- Signed wafer economics must offer semiconductor scope. Renewable-energy price
  changes cannot pass just because the model scores them highly. Coarse menus
  can omit price while establishing Kestrel/TSMC/wafer context; those remain
  eligible. Missing, forged and unsigned menus remain unknown. Existing subject,
  year, budget, cap, trust and threshold checks remain in place.
- Passage ranking retains mixed letter/digit identifiers of any length, instead
  of dropping short keys. A digit embedded in an identifier alone is not a
  numerical finding. No citation, coverage or access rule changes; only supplied
  accessible passages are ranked. One-charge and spending authority unchanged.

### Final historical comparison

| Metric | #320 after (95% CI) | V7 final (95% CI) |
|---|---:|---:|
| **Pitch: gross spend buying a final-used fact** | **59.32% [31.60, 88.82]** | **80.05% [63.16, 92.00]** |
| Wasted gross spend | 40.68% [11.18, 68.40] | 19.95% [8.00, 36.84] |
| Wasted net spend | 40.68% [11.18, 68.40] | 19.95% [8.00, 36.84] |
| First-purchase F1 (flow) | 0.526 [0.349, 0.667] | 0.545 [0.361, 0.689] |
| Selection F1 (sweep) | 0.660 [0.484, 0.800] | 0.688 [0.507, 0.812] |
| Supported-fact uplift | 35.87 pts [22.11, 49.50] | 38.04 pts [24.00, 51.14] |

Gross/net waste change **−20.73 pts [−47.51, 0.00]**; headline change
**+20.73 pts [0.00, 47.51]**. Flow change +0.0191 [0.0000, 0.0589]; sweep
+0.0275 [0.0000, 0.0769]; uplift +2.17 pts [0.00, 6.82]. The point estimate is
below 25%; **the CI crosses 25% and the paired change CI includes zero**.
There is no statistically established below-target population rate or strict
improvement. Twenty source clusters, 2,000 replicates, seed 700, same CI code.

S$26.55 → S$20.30 gross purchases; S$10.80 → S$4.05 wasted; S$15.75 → S$16.25
final-used cost; no refunds in either benchmark. Wasted purchase count 24 → 13.
Free-supported facts 13 → 13; final-supported facts 46 → 48 of 92. The model
still misses many purchases/facts; neither F1 nor fact recall is the headline.

This is **historical #320 versus one fresh final run**, not a concurrent pair.
The user explicitly requested classifying the old held-out errors; that exposure
makes this a **reused question holdout**, not independent unseen-test evidence.
No threshold fitting, label/menu/source changes or held-out iteration occurred.
The candidate was frozen before live dev and the single final held-out run;
no quality code changed afterwards. Dev measured 19.31% gross waste, flow F1
0.513, uplift 22.64 pts; only four dev topic clusters, not a narrow confidence
claim. Existing historical reports and same-input comparison guards are retained.

Final run `2026-11-03T03:47:11.448Z`, base HEAD `1e279c8` with dirty candidate
source fully pinned by frozen input hash
`7b5f6b4f7a244de769b5ef7c7d61c22c2388022c8e42cb0097ddd110e769b0e9`.
Data/config fingerprints match #320; policy and extraction fingerprints differ.
`node --import tsx scripts/report-numbers-v7.ts <final-report.json>` verifies
those constraints and reproduces `numbers-v7-results.json` without calls.
Intervals condition on synthetic sources and observed draws, not provider
variability, human labels, production traffic or unseen-corpus generalization.

### Live product and verification evidence

`docs/evidence/numbers-v7-testnet.md` and `.json` retain independently validated
Testnet hashes. UC2: NotFT purchased, final live coverage 3/3. UC3: AlphaLeak
proof failed, 0.03 XRP refund confirmed, then The Fab Floor verified, coverage
2/3. Live DeepSeek planner/writer and Luna decisions/coverage, keyword search,
synthetic articles; no fixture answers. Scope made a successful provider call,
but its returned label was not retained in this first run. Gross buyer payments
0.16 XRP, net 0.13 XRP, 48 drops total fees. No real money or cloud resources.
These two sanity runs support product settlement, not an on-chain estimate of
the benchmark headline or complete UC3 acceptance.

Benchmark audit **0 violations / 10 API runs / 646 wire observations**; live
Testnet audit **0 / 2 / 64 search observations**, valid 25-entry money chain.
Independent final gate audit passes. All live trials (dev, final heldout,
Testnet decision and research) total **US$0.3389854 / US$4**, 699 requests,
zero estimated-usage calls; dated harness rates, not invoices, research cache
discounts ignored. `numbers-v7-spend.json` includes the complete ledger.
No failed paid trials or quality reruns omitted; no cross-run cache replay.

`OFFSET=700 npm run check:fast`: 691 tests pass; four e2e browser tests pass.
Bank/corpus and leak checks unchanged, all pass. Frozen dev fixture repeat with
`--check --compare` passes, every quality delta zero, zero provider calls.
README generator check, source-boundary, secret scan and diff whitespace checks
pass. No tests, leak thresholds, gate audits, score thresholds or spending caps
loosened. Ship-pr review step 4 skipped as requested; final CI gates the merge.
