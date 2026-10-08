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
