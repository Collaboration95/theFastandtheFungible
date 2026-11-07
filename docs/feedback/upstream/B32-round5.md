# IOU cold start blocks the first tool call

Prepared 7 Nov 2026; not filed. Project integration finding, not an upstream defect claim.

Observed: 102.9 s provisioning within a 134.1 s first ask; about 103–134 s depending on the boundary.

Evidence: docs/evidence/r5-r/review-timings.txt; docs/evidence/m1-iou/README.md.

Workaround: Reuse private cached faucet wallets and warn about first-call latency.

Requested improvement: Expose provisioning progress; batch read-only checks while keeping signing serial.

Severity: high onboarding friction. Mainnet impact: Faucet timing is Testnet-only; no mainnet latency established.
