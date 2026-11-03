# Calibration fit · openai · gpt-6-luna

Prompt version: `batch-evidence/v3-fact-menu+gap-plain · originality original,rewrite,overlap · credibility 0,1,2`

**Not accepted**: purchase F1 0.488 < raw 0.513. Calibrator file: not written.

Sample: 593 rows, 4 groups by family, 4 folds, 34 open-fact decisions; addresses-gap 30/584 positive, original 530/593, buy positives 21, unknown buy labels 0.

| Target | Method | CV Brier raw | Platt | Isotonic |
|---|---|---|---|---|
| P(addresses gap) | platt | 0.045 | 0.039 | 0.043 |
| P(original) | isotonic | 0.081 | 0.076 | 0.075 |

| Purchase decisions | Threshold | F1 | Precision | Recall | Wasted |
|---|---|---|---|---|---|
| Raw, production threshold | 0.200 | 0.513 | 0.556 | 0.476 | S$3.05 |
| Raw, best threshold (post hoc) | 0.317 | 0.514 | 0.643 | 0.429 | S$2.05 |
| Calibrated (out of fold), proposed threshold | 0.078 | 0.488 | 0.500 | 0.476 | S$3.00 |

Purchase F1 after calibration uses out-of-fold calibrated values, but the threshold is chosen on those same values, so it is optimistic (in-sample for the threshold). rawBestThreshold is the same optimism applied to raw scores, for a fair comparison.

The proposed threshold is on the calibrated value scale and applies only with `DECISION_CALIBRATION=on` and this exact key. Never set `BUY_THRESHOLD` to it.
