# Coverage judge: writer self-grading vs the decision model (#213)

**Date:** 9 October 2026, about 03:00 SGT. **LIVE** calls on the **REAL corpus** (`data/corpus/v2`, synthetic
articles written for the demo), with requirement labels constructed by the scripted needle check in `eval/coverage/`
(#218). The harness: `npx tsx eval/coverage/run.ts --arms writer,luna --live`, with the coordinator's `EVAL_*` account.

## Setup

- 116 fixed evidence snapshots and 129 requirement judgments from the bank's requested facts. Snapshot states: free
  reads, free + paid, trap passages, partial evidence, conflicting sources.
- Gold labels: 76 supported, 8 partial, 42 missing, 3 conflicting.
- **Writer arm:** DeepSeek grades the coverage of its own answer evidence (self-assessment, one call per snapshot).
- **Decision-model arm:** OpenAI Decisions `gpt-6-luna`, one multi-question request per snapshot with one choice
  question per requirement (options pinned: supported, partial, missing, conflicting; the #213 rubric).
- **Not run:** Clef-flash, to keep the Cloudflare allowance for the demo.

## Results

| Arm | Accuracy (4 statuses) | False-complete | False-missing | Supported graded "partial" | p50 / p95 latency | Cost (116 calls) |
|---|---|---|---|---|---|---|
| Writer (DeepSeek, self-grading) | 0.760 | 0.019 (1 of 53) | 0 | 22 of 76 | 2,239 / 2,898 ms | US$0.112 |
| **Decision model (`gpt-6-luna`)** | **0.938** | 0.019 (1 of 53) | 0.013 (1 of 76) | 0 of 76 | **285 / 647 ms** | **US$0.009** |

False-complete counts a requirement the evidence does not support that the arm calls supported (the stop-too-early
error). It is the headline metric. False-missing counts a supported requirement called missing.

Confusion (rows: gold; columns: predicted supported / partial / missing / conflicting):

| Gold | Writer | Decision model |
|---|---|---|
| supported (76) | 54 / 22 / 0 / 0 | 75 / 0 / 1 / 0 |
| partial (8) | 0 / 7 / 1 / 0 | 1 / 6 / 1 / 0 |
| missing (42) | 1 / 4 / 37 / 0 | 0 / 2 / 40 / 0 |
| conflicting (3) | 0 / 2 / 1 / 0 | 0 / 0 / 3 / 0 |

**Hard cases:**
- **Traps:** neither arm marked a trap "complete". That held for forecast-as-fact (7), topic-only (16), wrong date (9)
  and wrong entity (17).
- **Conflicts:** neither arm detects them. The decision model calls all 3 conflicting cases "missing", which is safe
  because it is not a false complete. The writer calls 2 "partial" and 1 "missing".
- **Where each arm's false complete came from:** the writer's was a missing fact on free evidence; the decision
  model's was a partial-evidence snapshot.

## Recommendation and decision

**The decision model grades requested-fact coverage.** This was adopted for #208 (E1) and shipped in #221.
- **Writer self-grading is too conservative.** It marks 29% of fully supported facts as partial, which would trigger
  needless follow-up searches and purchases.
- **The decision model is cheaper, faster and more accurate.** It costs about one-twelfth of the writer arm per state
  and is about 8x faster at p50, with the same false-complete rate.
- **Rubric:** the four statuses with the definitions in `server/agents/requirements.ts` (`COVERAGE_RUBRIC`), with
  options pinned in that order. A missing or malformed answer is `unknown`, which is never complete.

## Calibration plan for the coverage judge

- **Data:** collect per-requirement status probabilities (not only the top choice) on the same 116 snapshots, plus
  the live runs' coverage rows. Group by question for CV.
- **Target:** P(supported) against gold supported. Calibrate it with the same identity / Platt / isotonic grouped-CV
  selection as #207 (`eval/decisions/calibration.ts`).
- **Threshold:** the operating threshold would minimise false-complete subject to a false-missing cap. Do this only if
  a larger sample shows false-complete above 2%.
- **What remains:**
  - conflict detection, which no arm does;
  - the Clef-flash arm, run on a paid Cloudflare plan;
  - more partial and conflicting snapshots: there are only 8 and 3 gold cases today.

Full output (not committed): `eval/decisions/out/coverage-writer-luna.json` in the coordinator's worktree.
