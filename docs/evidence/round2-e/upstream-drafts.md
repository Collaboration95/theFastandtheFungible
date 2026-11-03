# Upstream issue drafts · 2026-11-04

Both are **draft, not submitted**. Owner posting decisions belong in pinned #265; this lane sends nothing externally and has not updated that issue.

## t54: publish asset and binding conformance fixtures

Target: x402-xrpl 0.3.4 documentation/SDK maintainers; deployed facilitator revision unknown.

Reproduction: run `npx vitest run tests/starter-kit-interop.test.ts tests/x402.test.ts` against the pinned package. Header-only PAYMENT-REQUIRED is not retried by x402Fetch; Express requires payload.invoiceId alongside accepted.extra.invoiceId. ResearchAgent typed issued assets differ from currency-string plus extra.issuer, and memo-only binding lacks our InvoiceID requirement.

Evidence: ../starter-kit-interop.md and ../../x402-xrpl.md. Native XRP exact/both binding succeeded in two historical Testnet directions; issued codec execution remains unproven.

Request: publish shared positive/negative fixtures for headers, duplicate invoice fields, tags, issued currency+issuer, exact delivered_amount, and both/memo/InvoiceID profiles. Preserve one signed blob across ambiguous settlement and redelivery. Unsupported profiles should fail before signing.

## Ripple / RLUSD: document issuer-gated token escrow preflight

Target: RLUSD developer documentation and Starter Kit maintainers.

Reproduction: inspect committed ../rlusd-funding.json and ../rlusd.md. On 2026-11-03 official Testnet issuer Flags 2174353408 lacked AllowTrustLineLocking. We did not submit an RLUSD escrow; tecNO_PERMISSION is predicted from documented permission rules, not an observed failure. Exact payments and cooperative refunds did execute.

Request: show a dated two-part preflight: network amendment state AND issuer permission. Explain who can enable permission, how to report unsupported status, and preserve exact/refund fallback. Document authenticated native XRPL faucet access separately from XRP activation and EVM sponsorship.

Mainnet issuer status and escrow execution remain unmeasured. No request to loosen permission checks.
