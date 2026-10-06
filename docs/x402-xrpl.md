# x402 and XRPL integration contract

_Extracted 6 Oct 2026 from the archived `company-research-context-v1.md`. Product direction lives in [FINAL-PUSH.md](../FINAL-PUSH.md); where they differ (e.g. x402 v2 headers, refunds via `/challenge`), FINAL-PUSH wins._


The current t54 XRPL exact scheme documentation describes x402 v2 headers:

| Direction | Header | Meaning |
| --- | --- | --- |
| Server → client | `PAYMENT-REQUIRED` | Base64 payment requirements |
| Client → server | `PAYMENT-SIGNATURE` | Base64 signed payment payload |
| Server → client | `PAYMENT-RESPONSE` | Settlement result |

Some XRPL and older x402 examples use different headers. Do not combine them
from memory. Pin the facilitator and SDK versions, capture the actual challenge
and retry exchange in an integration test, and record the version in the
technical receipt.

Relevant CAIP-2 network identifiers are `xrpl:0` for Mainnet, `xrpl:1` for
Testnet, and `xrpl:2` for Devnet. The first live proof should use XRP on
Testnet. One XRP equals one million drops; quote amounts must use exact integer
drop strings.

### Required validation before signing

1. Supported x402 version and exact scheme.
2. Expected network and asset/issuer.
3. Exact destination and any destination tag.
4. Exact amount within per-purchase and cumulative limits.
5. Unique invoice bound to the signed transaction.
6. Expected resource and quote/terms hashes.
7. Valid expiry and bounded `LastLedgerSequence`.
8. Explicit approval reference when policy requires it.
9. No partial-payment or unintended cross-currency behavior.
10. An unused idempotency key and invoice.

The invoice should be committed through the documented memo or `InvoiceID`
mechanism. A valid payment without invoice binding can be replayed against a
different resource and must be rejected.

### Submission and finality

```text
construct exact Payment
  → preview and compare with approved intent
  → sign outside model/browser authority
  → persist transaction identity
  → submit
  → wait for validated ledger result
  → require tesSUCCESS
  → record hash, ledger, payer, payee, and amount
```

A preliminary submit or facilitator response is not final settlement. After a
timeout, reconcile the transaction hash, account sequence, invoice, and ledger
before enabling retry. Blind resubmission can double-settle.

### Fulfilment after settlement

Settlement and delivery are independent states. After validated payment:

1. request the exact resource;
2. verify resource ID and version;
3. verify content hash or signed delivery metadata;
4. apply license and retention rules;
5. grant access to the exact evidence spans;
6. update the receipt; and
7. allow synthesis only from accessible evidence.

If fulfilment fails, preserve the settled receipt, keep content locked, and
offer recovery without charging again.

## XRPL wallet and data safety

- Never expose, log, screenshot, or send wallet seeds to a model.
- An ignored local environment variable is acceptable only for Testnet
  development; production needs KMS/HSM or an external signer.
- Confirm the signing address matches the transaction `Account`.
- Treat memo text as public and untrusted. Store only an opaque receipt or
  correlation identifier, never customer objectives, private reasoning,
  personal data, credentials, or secret URLs.
- Use SourceTag only as a stable workflow/agent attribution value.
- Keep mainnet disabled until custody, approval, reconciliation, monitoring,
  legal, and incident-response controls are reviewed.

XRPL native features such as multisigning, DepositAuth, escrow, Checks, issued
currencies, and trust lines can strengthen a real product when a requirement
exists. Do not add them merely to make the architecture look sophisticated.

## Primary references

### XRPL and Ripple

- [Agentic transactions](https://xrpl.org/docs/agents/agentic-transactions)
- [Getting started with agentic transactions](https://xrpl.org/docs/agents/getting-started-with-agentic-transactions)
- [Agentic x402 payments](https://xrpl.org/docs/agents/agentic-payments-x402)
- [Track agent behavior](https://xrpl.org/docs/agents/track-agent-behavior)
- [XRPL payment skill](https://xrpl.org/docs/agents/xrpl-payments-skill)
- [XRPL wallet skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill)
- [Token trust lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
- [RLUSD on XRPL](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
- [XRPL Testnet faucets](https://xrpl.org/resources/dev-tools/xrp-faucets)
- [Ripple XRPL AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/)
- [Ripple stablecoin payments checklist](https://ripple.com/insights/fintech-checklist-stablecoin-payments-journey/)

### x402 and risk

- [t54 XRPL facilitator overview](https://xrpl-x402.t54.ai/docs/overview)
- [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
- [Verifiable Intent](https://xrpl-x402.t54.ai/docs/verifiable-intent)
- [t54 Trustline overview](https://www.t54.ai/docs/trustline/overview)
- [t54 async underwriting](https://www.t54.ai/docs/trustline/async-underwriting)
- [t54 compliance and audit](https://www.t54.ai/docs/trustline/compliance-audit)
- [Agentic Risk Standard](https://github.com/t54-labs/AgenticRiskStandard)
- [Open Wallet Standard](https://github.com/open-wallet-standard/core)

### Future operating rails

- [Unlimit BaaS payments](https://www.baas.unlimit.com/payments/)
- [Unlimit developer portal](https://www.baas.unlimit.com/dev-portal/)

