Signed fact menus shipped in PR #304, commit `7807ce311f0bb3ae3807eb476436c7c6ba009f52`.
This is a historical backfill, tagged on that commit; no newer app or payment changes are included.

Measured live decision evaluation (synthetic corpus; fixture research and simulated payments):

- Selection F1 (flow): **0.235 → 0.419**.
- Supported-fact uplift: **+11.3 → +17.0 percentage points**.
- Wasted spend **regressed: 36.2% → 47.2%**. Both selection and waste targets were missed; the decision-policy fix is in progress in #276.
- Zero hard-gate violations in the recorded evaluation. These are evaluation results, not production reliability or live throughput claims.

See [PR #304](https://github.com/Collaboration95/theFastandtheFungible/pull/304) for the implementation and evidence.
