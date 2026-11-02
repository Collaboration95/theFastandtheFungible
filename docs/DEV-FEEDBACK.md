# Informal dev feedback

Developer feedback on the XRPL and x402 documentation and integration experience. These research-based observations were submitted on 4–5 September 2026 and describe the materials reviewed at that time.

## Submission inventory

All 15 submissions below received an acceptance response. Times are Singapore time (UTC+8).

| # | Topic | Submitted |
|---|---|---|
| 1 | Facilitator reliability and reconciliation | 2026-09-04 23:56:25 |
| 2 | Bounded autonomous signing | 2026-09-04 23:56:25 |
| 3 | Wrong chain starter examples | 2026-09-04 23:56:25 |
| 4 | Package version pinning | 2026-09-04 23:57:53 |
| 5 | Network and asset validation | 2026-09-04 23:57:53 |
| 6 | Python version prerequisites | 2026-09-05 00:09:10 |
| 7 | TypeScript quickstart coverage | 2026-09-05 00:09:10 |
| 8 | RLUSD trustlines and issuer onboarding | 2026-09-05 00:09:10 |
| 9 | SourceTag default mismatch | 2026-09-05 00:09:10 |
| 10 | Payment retry and duplicate settlement | 2026-09-05 00:14:16 |
| 11 | Network identifier compatibility | 2026-09-05 02:28:03 |
| 12 | DestinationTag and X address support | 2026-09-05 02:28:04 |
| 13 | SourceTag ownership and attribution | 2026-09-05 02:28:04 |
| 14 | Testnet reset recovery | 2026-09-05 02:28:05 |
| 15 | Endpoint transport and network identity | 2026-09-05 02:28:06 |

## Submitted feedback

### 1. Facilitator reliability and reconciliation

While preparing an XRPL agentic-payment flow, I found a reliability gap in the x402 quickstart: it requires T54's hosted testnet facilitator, which the XRPL documentation labels best-effort with no committed SLA, but the guide does not provide a local facilitator, deterministic simulator, or clear reconciliation guidance for facilitator outages versus invalid payments. A local test harness plus documented retry, idempotency, and receipt-reconciliation behavior would make hackathon and production integration much easier to debug.

### 2. Bounded autonomous signing

The XRPL agent documentation has an autonomy ambiguity: the x402 guide describes payment as requiring no human in the loop, while the Agent Wallet skill requires explicit human confirmation for every signature by default. The docs mention auto-signing but do not show one concise, end-to-end example of bounded autonomy with network, destination, amount, and expiry constraints. A single approved-autonomy example, clearly separated from production policy-gated signing, would prevent builders from either blocking unattended x402 flows or weakening authorization controls.

### 3. Wrong chain starter examples

The general x402-secure reference examples default to Base Sepolia and generic x402.org facilitator endpoints, while the XRPL path uses the separate x402-xrpl package, XRPL-specific network identifiers, and a different facilitator. For an XRPL hackathon, following the generic starter path can produce a syntactically valid but wrong-chain prototype before the mismatch is obvious. An XRPL-first quickstart, install command, and runtime validation that rejects unsupported network and asset combinations would prevent this expensive integration detour.

### 4. Package version pinning

The XRPL x402 documentation warns that the x402-xrpl package is early-stage and recommends pinning a specific version, but its quickstart installs x402-xrpl without a version pin and provides no tested lockfile or compatibility matrix. That makes a hackathon demo vulnerable to silent SDK changes and makes bug reports hard to reproduce. Publishing the exact tested package version, a lockfile, and a small protocol-compatibility table would materially improve reliability for builders.

### 5. Network and asset validation

The XRPL x402 payer quickstart sets network_filter=None, meaning the client accepts any network declared by the server, while the same wallet guidance emphasizes explicit network checks and safe authorization. Because a 402 response supplies the payment terms that the client signs, the example should default to an explicit testnet network and asset allowlist, with a clear warning before accepting mainnet or unexpected terms. A fail-closed network and destination validation example would prevent a misconfigured or malicious paywall from steering an agent into an unintended payment path.

### 6. Python version prerequisites

The XRPL agent documentation has conflicting Python prerequisites: the general Getting Started tutorial says Python 3.9+, while the XRPL x402 guide requires Python 3.11+. A builder following the first page can pass the stated prerequisite and still fail when installing or running the x402 path. The docs should declare one supported matrix per workflow and publish a tested requirements or lock file so environment failures are distinguishable from XRPL integration failures.

### 7. TypeScript quickstart coverage

The XRPL x402 landing page advertises a TypeScript client, but the XRPL-specific implementation guide explicitly says it currently includes Python examples only. This leaves Node.js builders to infer the XRPL header, signing, receipt, and retry flow from a different ecosystem example. A minimal tested TypeScript quickstart using the XRPL package, with the exact network and facilitator configuration, would make the advertised client support real rather than discoverable only through reverse engineering.

### 8. RLUSD trustlines and issuer onboarding

The XRPL x402 guide says x402-xrpl supports RLUSD for stable pricing, but the runnable quickstart demonstrates XRP only and does not show the required trustline creation, issuer verification, reserve impact, or the failure mode when the recipient cannot hold the issued currency. XRPL trustline tokens cannot be delivered without an appropriate trust line. A complete RLUSD example should provision and validate the trustline before signing, and explain how to surface tecPATH_DRY or issuer mistakes.

### 9. SourceTag default mismatch

Agent attribution is inconsistent across the XRPL agent materials: the Agent Wallet and Payments skills use SourceTag 20260530, while the XRPL x402 quickstart defaults to 20260601. A builder combining the wallet skill with the x402 middleware can produce valid payments that split across attribution queries, making agent volume and audit trails incomplete. The ecosystem should publish one canonical tag policy or clearly define separate tags and their intended ownership.

### 10. Payment retry and duplicate settlement

The XRPL x402 quickstart describes payment, facilitator receipt retrieval, and the HTTP retry as one automatic flow, but it does not explain the crash window where the on-ledger Payment succeeds and the client times out before receiving the receipt or final resource. A naive retry could submit a second payment for the same request, while abandoning the request loses a successful settlement. The client and merchant examples should show an invoice or idempotency key, hash-based reconciliation, and a safe retry-after-settlement procedure.

### 11. Network identifier compatibility

The XRPL x402 guide uses xrpl:1 for Testnet and xrpl:0 for Mainnet, while the OpenWallet Standard reference uses the canonical CAIP-2 identifiers xrpl:testnet and xrpl:mainnet. A builder combining x402 payments with a policy-gated wallet can pass a valid-looking identifier that another layer rejects or interprets differently. Publishing one canonical mapping and a conversion helper would remove a subtle cross-tool integration failure.

### 12. DestinationTag and X address support

The XRPL x402 quickstart models payTo as a plain classic address, but many hosted accounts require a DestinationTag and XRPL payments can fail when the destination account enforces one. The quickstart should explain whether x402 payment requirements can carry a destination tag or X-address, how the client validates it, and how a merchant advertises the requirement. Without that path, an agent can pay the right institution but still receive a validated failure such as tecDST_TAG_NEEDED.

### 13. SourceTag ownership and attribution

The XRPL x402 payer example says the on-chain SourceTag is the value declared by the merchant, while the Agent Wallet guidance presents SourceTag as a way to attribute agent-generated activity. Those ownership models conflict: an untrusted paywall can choose the tag that appears in the payer’s transaction and distort agent or merchant analytics. The protocol should define whether the payer, merchant, or facilitator owns each attribution field and provide a tamper-resistant convention for both sides.

### 14. Testnet reset recovery

The XRPL faucet documentation warns that testnet balances and ledger history may be reset, while the agentic-payment quickstart presents a wallet, payment, and explorer flow without a reset-aware test fixture or verification strategy. After a reset, saved addresses, transaction hashes, and trustline state can silently become invalid and make a demo look nondeterministic. A documented disposable-wallet bootstrap, network-health check, and reset-safe integration test would make agent demos much easier to reproduce.

### 15. Endpoint transport and network identity

The XRPL agent materials use a WebSocket endpoint on port 51233 for the wallet flow and an HTTP JSON-RPC endpoint on port 51234 for the x402 payer, but do not explain why the transports and ports differ or how to health-check that they refer to the same network. A builder can copy the wrong endpoint into an otherwise correct payment flow and get opaque connection or ledger-state errors. The quickstarts should show a network-identity check and a small endpoint matrix for WebSocket, JSON-RPC, Testnet, and Mainnet.
