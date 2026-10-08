# Calibration fit · openai · gpt-6-luna

Prompt version: `batch-evidence/v1+gap-plain · originality original,rewrite,overlap · credibility 0,1,2`

**Accepted**. Calibrator file: `not committed (comparison fit only)`.

Sample: 988 rows, 4 groups by family, 4 folds, 69 open-fact decisions; addresses-gap 54/973 positive, original 881/988, buy positives 42, unknown buy labels 0.

| Target | Method | CV Brier raw | Platt | Isotonic |
|---|---|---|---|---|
| P(addresses gap) | platt | 0.045 | 0.039 | 0.040 |
| P(original) | identity | 0.029 | 0.033 | 0.034 |

| Purchase decisions | Threshold | F1 | Precision | Recall | Wasted |
|---|---|---|---|---|---|
| Raw, production threshold | 0.200 | 0.386 | 0.733 | 0.262 | S$1.90 |
| Raw, best threshold (post hoc) | 0.015 | 0.684 | 0.730 | 0.643 | S$4.15 |
| Calibrated (out of fold), proposed threshold | 0.117 | 0.659 | 0.612 | 0.714 | S$8.05 |

Purchase F1 after calibration uses out-of-fold calibrated values, but the threshold is chosen on those same values, so it is optimistic (in-sample for the threshold). rawBestThreshold is the same optimism applied to raw scores, for a fair comparison.

The proposed threshold is on the calibrated value scale and applies only with `DECISION_CALIBRATION=on` and this exact key. Never set `BUY_THRESHOLD` to it.
