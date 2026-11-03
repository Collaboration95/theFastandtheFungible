# Starter Kit interop · 3 Nov 2026

**LIVE XRPL TESTNET · no real value; synthetic content.** Local HTTP servers
bound ephemeral loopback ports. No desktop changes, cloud resources, mainnet
payments, model calls, environment seeds or private keys used in this proof.

## Exact targets and reproduction

`x402-xrpl@0.3.4` (npm, lockfile integrity pinned); see
[research and source commits](../x402-xrpl.md#starter-kit-compatibility).

- Offline: `OFFSET=1200 npx vitest run tests/starter-kit-interop.test.ts tests/x402.test.ts`.
  Actual upstream Express middleware, FacilitatorClient, x402Fetch and
  XRPLPresignedPaymentPayer; labelled synthetic facilitator/ledger, not live proof.
- Live: `OFFSET=1200 node --import tsx scripts/starter-kit-interop.ts --testnet`.
  Fresh faucet-only payer and recipient. Hard-coded Testnet WebSocket
  `wss://s.altnet.rippletest.net:51233`; t54 hosted facilitator
  `https://xrpl-facilitator-testnet.t54.ai`. Running again spends fresh test value.
  This disposable proof uses in-memory journals; production callers must use a
  persistent journal and retain their original intent through recovery.

## Live receipts

Each transaction was independently queried with rippled `tx` after the complete
exchange. Both returned `validated: true`, `tesSUCCESS`, exact delivered_amount,
and an InvoiceID. Fees were 12 drops each.

| Direction | Transaction | Ledger | Quote / delivered drops |
| --- | --- | --- | --- |
| ResearchAgent SDK `pay()` → t54 Express `requirePayment` → hosted t54 facilitator | `FE6EF0F8785B4FC776551B378B62B8E9BA480D17FA375A3BB637FCE310AD1373` | 22029442 | 1000 / 1000 |
| t54 `x402Fetch` + `XRPLPresignedPaymentPayer` → ResearchAgent publisher/facilitator | `570DE6EB58157FB8C5D1F8E23ECAF0A8340750ADFCB6A238CB8E70E2FD4B5588` | 22029444 | 60000 / 60000 |

First InvoiceID: `845076E0C20178E24C42D304C2E7F73DB129B944A06120F9D35D421A1AA66641`;
SourceTag 804681468 and DestinationTag 7 survived signing and settlement.
Second InvoiceID: `2001829C4277088737F21A26399D41401428DF90D221438E74E0603490E0B5F3`.
Both paid responses were HTTP 200. Replaying direction B's exact signed header
returned HTTP 200 with the same transaction receipt, without a new submission.
A preliminary exploratory run also settled direction A before exposing the
body-only client mismatch in direction B; the table records the final complete
run, not total exploratory faucet expenditure.

## Gates and limits

The harness checks unpaid 402 bodies contain no paid content and verifies the
paid response contains the expected synthetic passage. Offline tests also reject
a 999-drop budget against a 1000-drop quote before submission, reject invalid
tags, and assert no second submit when retrying either direction. t54 consumes
its invoice, so direction A may refuse redelivery; our SDK retains the same
signed blob rather than creating another charge. Existing delivered_amount,
partial-payment, cross-currency, manifest and policy tests remain mandatory.

No Starter Kit fork or reimplementation substitutes for the client/middleware.
Only the offline ledger/facilitator is synthetic. The hosted facilitator's
source/version is not exposed by `/supported`; its deployed commit is unknown.
The npm SDK exposes neither repository nor gitHead metadata, so no source commit
is invented. Public wallet skills, docs MCP and Python gateway were researched
but not run. Compatibility is native XRP/exact/Testnet, not RLUSD, memo-only
binding, upto, escrow, mainnet readiness, or an MCP wallet claim.
