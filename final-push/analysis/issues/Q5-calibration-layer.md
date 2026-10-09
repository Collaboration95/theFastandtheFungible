**Why:** calibration is the largest effect the decisions benchmark measured, and it is the talk's thesis.
- **Held-out** (synthetic, 28 topic families): purchase F1 went from 0.505 to 0.783, and four-question Brier from 0.186 to 0.075.
- **Dev:** calibration alone, with the production wording, took F1 from 0.400 to 0.797. That is in-sample, because the threshold was chosen on dev.
- **The synthetic calibrators break the demo:**
  - They buy nothing in UC2 (NotFT 0.350 < 0.38) or in UC3 round 2 (Fab Floor 0.225).
  - The originality calibrator lifts the MarketPulse rewrite's raw P(original) from 0.26 to 0.99. That defeats the `rewrite >= original` guard (`server/agents/decision.ts:118`), so the package would buy the rewrite at any threshold of 0.34 or below.
- Calibrators must therefore be fitted on in-domain data, and fitted last.

**Do:**
- **Versioned calibrators** keyed by (model, hash of the question wording): identity, Platt or isotonic, chosen by topic-grouped cross-validation on Q1 data. Reuse `bench/decisions/calibration.ts` and `metrics.ts`.
- **Apply them in `decide()`** before computing `value`.
  - Keep the rewrite guard on raw originality, or prove that the calibrated triple preserves it.
- **Record both raw and calibrated scores** in the decision row and in Langfuse. Label the UI "calibrated (vN)".
- **Re-tune the buy threshold** on the calibrated scale, then lock it with the UC regression.
- **Never set `BUY_THRESHOLD`** to the benchmark's 0.38. That number applies to calibrated values, and the setting also governs the fixture fallback (`decision.ts:69-71,103`).

**Write scope:**
- `server/agents/decision.ts`
- a new `server/agents/calibration.ts`
- `shared/contracts/decision.ts` (raw and calibrated fields)
- tests and `eval/`

**Acceptance:**
- UC1–UC3 regression passes, including "MarketPulse rewrite never bought" and the Q2 UC3 cases.
- On Q1 data, held-out Brier and purchase F1 are no worse than raw.
- The calibrator version is shown in the run labels (gate 5).

**Depends on:** Q1, Q2, Q3 and #194 E1. E1 changes Clef's gap input, which would invalidate earlier calibrators.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>`.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
