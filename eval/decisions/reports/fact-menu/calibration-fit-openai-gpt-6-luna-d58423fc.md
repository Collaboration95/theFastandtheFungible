# Calibration fit · openai · gpt-6-luna

Prompt version: `batch-evidence/v2-fact-menu+gap-plain · originality original,rewrite,overlap · credibility 0,1,2`

**Accepted**. Calibrator file: `data/calibration/openai-gpt-6-luna-d58423fc.json`.

Sample: 593 rows, 4 groups by family, 4 folds, 34 open-fact decisions; addresses-gap 30/584 positive, original 530/593, buy positives 21, unknown buy labels 0.

| Target | Method | CV Brier raw | Platt | Isotonic |
|---|---|---|---|---|
| P(addresses gap) | isotonic | 0.030 | 0.029 | 0.025 |
| P(original) | identity | 0.023 | 0.025 | 0.027 |

| Purchase decisions | Threshold | F1 | Precision | Recall | Wasted |
|---|---|---|---|---|---|
| Raw, production threshold | 0.200 | 0.681 | 0.615 | 0.762 | S$4.95 |
| Raw, best threshold (post hoc) | 0.425 | 0.769 | 0.833 | 0.714 | S$0.90 |
| Calibrated (out of fold), proposed threshold | 0.202 | 0.762 | 0.762 | 0.762 | S$2.70 |

Purchase F1 after calibration uses out-of-fold calibrated values, but the threshold is chosen on those same values, so it is optimistic (in-sample for the threshold). rawBestThreshold is the same optimism applied to raw scores, for a fair comparison.

The proposed threshold is on the calibrated value scale and applies only with `DECISION_CALIBRATION=on` and this exact key. Never set `BUY_THRESHOLD` to it.
