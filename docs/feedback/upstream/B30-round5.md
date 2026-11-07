# Fixture threshold borrowed from luna

Prepared 7 Nov 2026; not filed. Project integration finding, not an upstream defect claim.

Code-derived: metadata-fixture uses the default 0.20 luna threshold despite a different heuristic; observed J5 held-out buy-and-cite is 8/20.

Evidence: server/agents/decision.ts; docs/evidence/j5-coverage/README.md.

Workaround: Keep policy unchanged and disclose misses.

Requested improvement: Calibrate a versioned fixture-only threshold on dev, with blind held-out and negative gates; ship nothing if gates fail.

Severity: medium. Mainnet impact: Availability of expertise may be reduced; no mainnet execution or live-model calibration claim.
