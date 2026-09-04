# XRPL feedback submission log

This is a local audit trail for feedback submitted through `hook/submit.mjs`.
It records topics and outcomes so later reports can stay distinct. The entries
below are based on the command results returned by the feedback server.

## Earlier accepted reports

1. Test-path example: Testnet faucet failures without retry guidance.
2. x402 testnet facilitator is best-effort/no-SLA without a local fallback or reconciliation guide.
3. x402 “no human in the loop” wording conflicts with the wallet skill’s default confirmation ceremony.
4. General x402 examples default to Base Sepolia, creating a wrong-chain path for XRPL builders.
5. The x402 package is described as early-stage but the quickstart leaves the dependency unpinned.
6. The payer quickstart leaves `network_filter=None`, weakening fail-closed network validation.
7. XRPL documentation has conflicting Python minimums (3.9+ versus 3.11+).
8. TypeScript support is advertised, but the XRPL-specific x402 guide provides Python-only examples.
9. RLUSD support is mentioned without a runnable trustline, issuer-validation, and reserve-onboarding path.
10. Agent attribution uses inconsistent SourceTag defaults (`20260530` versus `20260601`).

Each earlier entry was reported as a separate submission and returned `feedback submitted`.

## New six-report batch

| # | Topic | Evidence | Submitted text | Result | Time |
|---|---|---|---|---|---|
| 1 | x402 payment/HTTP retry crash window and idempotency | [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402), payment flow lines 110–119 | The XRPL x402 quickstart describes payment, facilitator receipt retrieval, and the HTTP retry as one automatic flow, but it does not explain the crash window where the on-ledger Payment succeeds and the client times out before receiving the receipt or final resource. A naive retry could submit a second payment for the same request, while abandoning the request loses a successful settlement. The client and merchant examples should show an invoice or idempotency key, hash-based reconciliation, and a safe retry-after-settlement procedure. | feedback submitted | 2026-09-05 |
| 2 | Cross-tool chain identifiers | XRPL x402 guide; OpenWallet Standard supported chains | The XRPL x402 guide uses `xrpl:1` for Testnet and `xrpl:0` for Mainnet, while the OpenWallet Standard reference uses the canonical CAIP-2 identifiers `xrpl:testnet` and `xrpl:mainnet`. A builder combining x402 payments with a policy-gated wallet can pass a valid-looking identifier that another layer rejects or interprets differently. Publishing one canonical mapping and a conversion helper would remove a subtle cross-tool integration failure. | feedback submitted | 2026-09-05 02:28 +08 |
| 3 | Destination tags and hosted-account payments | XRPL destination-tag tutorial; XRPL x402 guide | The XRPL x402 quickstart models `payTo` as a plain classic address, but many hosted accounts require a DestinationTag and XRPL payments can fail when the destination account enforces one. The quickstart should explain whether x402 payment requirements can carry a destination tag or X-address, how the client validates it, and how a merchant advertises the requirement. Without that path, an agent can pay the right institution but still receive a validated failure such as `tecDST_TAG_NEEDED`. | feedback submitted | 2026-09-05 02:28 +08 |
| 4 | SourceTag ownership and audit integrity | XRPL x402 guide; Agent Wallet skill | The XRPL x402 payer example says the on-chain SourceTag is the value declared by the merchant, while the Agent Wallet guidance presents SourceTag as a way to attribute agent-generated activity. Those ownership models conflict: an untrusted paywall can choose the tag that appears in the payer’s transaction and distort agent or merchant analytics. The protocol should define whether the payer, merchant, or facilitator owns each attribution field and provide a tamper-resistant convention for both sides. | feedback submitted | 2026-09-05 02:28 +08 |
| 5 | Testnet resets and reproducible agent tests | XRPL Testnet faucets; XRPL x402 guide | The XRPL faucet documentation warns that testnet balances and ledger history may be reset, while the agentic-payment quickstart presents a wallet, payment, and explorer flow without a reset-aware test fixture or verification strategy. After a reset, saved addresses, transaction hashes, and trustline state can silently become invalid and make a demo look nondeterministic. A documented disposable-wallet bootstrap, network-health check, and reset-safe integration test would make agent demos much easier to reproduce. | feedback submitted | 2026-09-05 02:28 +08 |
| 6 | JSON-RPC and WebSocket endpoint pairing | XRPL x402 guide; Agent Wallet skill | The XRPL agent materials use a WebSocket endpoint on port 51233 for the wallet flow and an HTTP JSON-RPC endpoint on port 51234 for the x402 payer, but do not explain why the transports and ports differ or how to health-check that they refer to the same network. A builder can copy the wrong endpoint into an otherwise correct payment flow and get opaque connection or ledger-state errors. The quickstarts should show a network-identity check and a small endpoint matrix for WebSocket, JSON-RPC, Testnet, and Mainnet. | feedback submitted | 2026-09-05 02:28 +08 |

## Automation note

The earlier unattended runner was stopped. Reports 2–6 were later submitted
individually after explicit user authorization; no background scheduler remains.
