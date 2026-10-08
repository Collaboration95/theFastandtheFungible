# Calibration fit · openai · gpt-6-luna

Prompt version: `batch-evidence/v1+gap-plain · originality original,rewrite,overlap · credibility 0,1,2`

**Accepted**. Calibrator file: `data/calibration/openai-gpt-6-luna-35d990c7.json`.

Sample: 593 rows, 4 groups by family, 4 folds, 34 open-fact decisions; addresses-gap 30/584 positive, original 530/593, buy positives 21, unknown buy labels 0.

| Target | Method | CV Brier raw | Platt | Isotonic |
|---|---|---|---|---|
| P(addresses gap) | platt | 0.039 | 0.034 | 0.036 |
| P(original) | identity | 0.030 | 0.034 | 0.035 |

| Purchase decisions | Threshold | F1 | Precision | Recall | Wasted |
|---|---|---|---|---|---|
| Raw, production threshold | 0.200 | 0.414 | 0.750 | 0.286 | S$1.20 |
| Raw, best threshold (post hoc) | 0.015 | 0.700 | 0.737 | 0.667 | S$2.60 |
| Calibrated (out of fold), proposed threshold | 0.119 | 0.708 | 0.630 | 0.810 | S$4.15 |

Purchase F1 after calibration uses out-of-fold calibrated values, but the threshold is chosen on those same values, so it is optimistic (in-sample for the threshold). rawBestThreshold is the same optimism applied to raw scores, for a fair comparison.

The proposed threshold is on the calibrated value scale and applies only with `DECISION_CALIBRATION=on` and this exact key. Never set `BUY_THRESHOLD` to it.
