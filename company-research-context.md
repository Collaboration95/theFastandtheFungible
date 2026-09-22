# Company and protocol context

Updated 22 September 2026. This document keeps durable product and integration
decisions. It is not an event record, implementation status report, or
substitute for current protocol documentation.

## Executive decision

ResearchAgent should remain a narrow demonstration of controlled evidence
acquisition:

> Use accessible evidence first. When a material gap remains, recommend one
> premium source, enforce the user's exact mandate, require explicit approval,
> verify settlement and fulfilment separately, and show what changed.

The product is not a general-purpose shopping agent. Its defensible value is
the link between research quality and spend control:

```text
question
  → approved evidence universe
  → open-evidence baseline
  → material gap
  → optional premium proposal
  → deterministic policy and manual approval
  → settlement
  → resource fulfilment
  → cited impact and receipt
```

XRPL is a fast, inspectable settlement rail. x402 supplies a machine-readable
payment challenge and retry boundary. Neither replaces the product's source,
evidence, policy, access, and citation controls.

## Product positioning

Primary user: a researcher or analyst preparing a defensible brief.

Primary job: decide whether available evidence is sufficient and, when it is
not, spend a small approved budget on the source most likely to improve the
answer.

Position the product around five promises:

1. Accessible evidence can answer without a purchase.
2. Repeated reporting is not treated as independent corroboration.
3. A recommendation cannot spend; only exact user approval can.
4. Payment cannot unlock the wrong or unverifiable resource.
5. Final claims resolve to accessible evidence spans.

Avoid positioning based on the number of protocols connected. A small complete
loop is stronger than a broad architecture with untested integrations.

## Current versus future truth

| Layer | Current prototype | Future proof target |
| --- | --- | --- |
| Evidence | 12 synthetic local records | One authorized public source and one protected resource |
| Research model | Fixture by default; optional Groq | Evaluated provider path with deterministic fallback |
| Payment challenge | x402-style structured quote | Pinned x402 version and real HTTP 402 retry |
| Settlement | Fixture simulation; optional XRPL Testnet adapter | Validated Testnet transaction and reconciliation |
| Fulfilment | Synthetic exact access grant | Versioned artifact verified after settlement |
| Persistence | Local JSON | Transactional, authenticated, retention-aware storage |
| Risk control | Local deterministic budget and access guard | Versioned policy, external signer, audit pipeline |

Fixture, Testnet, and production claims must never be blended. Testnet proves
an integration path; it does not prove licensing, operational resilience,
regulated custody, or production security.

## Spend-control contract

The model may interpret the objective, compare evidence, summarize trade-offs,
and propose a purchase. It must not own an unconstrained payment tool.

The deterministic control plane owns:

- mandate identity, version, and expiry;
- approved network, asset, issuer, payee, and resource type;
- per-source and cumulative budgets using integer units;
- quote identity, amount, terms, and expiry;
- manual-approval requirements;
- invoice replay and idempotency controls;
- signer isolation and transaction-field validation;
- settlement reconciliation;
- resource/version/hash verification;
- access grants and evidence receipts.

The UI should expose a concise reason and safe next action. Internal model
reasoning is not a policy artifact and should not be stored as one.

### Mandate shape

```text
mandate_id
principal_id
task
allowed_networks
allowed_assets_and_issuers
approved_payees
approved_resource_types
max_amount_per_purchase
rolling_budget
expires_at
approval_policy
policy_version
mandate_hash
```

### Quote shape

```text
quote_id
invoice_id
resource_id
resource_version
network
asset_and_issuer
pay_to
amount
expiry
source_tag_or_destination_tag
terms_hash
quote_hash
```

Changing the amount, payee, asset, issuer, invoice, resource, expiry, network,
or critical terms invalidates the earlier decision and approval.

### Decision shape

```text
decision: APPROVE | BLOCK | APPROVAL_REQUIRED
reason_codes
checks:
  authority
  amount
  cumulative_budget
  network
  asset_and_issuer
  payee
  resource
  invoice
  expiry
policy_hash
evidence_manifest_hash
```

For a blocked attempt, the receipt should say plainly:

```text
No transaction was signed or submitted.
```

## x402 and XRPL integration contract

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

## XRP first; RLUSD later

RLUSD on XRPL requires the exact issuer and canonical currency code plus a
configured trust line. Issuer values, reserves, and operational instructions
must be read from current Ripple/XRPL documentation when implementation begins.

Use Testnet XRP for the first live proof because it has fewer setup variables.
Add RLUSD only after the product can visibly diagnose issuer, trust-line,
reserve, destination, and liquidity readiness. A bare `RLUSD` label is not a
sufficient payment requirement.

## Ripple and broader operating context

Ripple's agentic transaction material supports a useful separation:

```text
agent decides
  → deterministic guard authorizes
  → wallet constructs and signs
  → XRPL validates settlement
  → application verifies fulfilment
  → receipt connects outcome to evidence
```

Production stablecoin or cross-border use adds jurisdiction, reserve and issuer
risk, liquidity, FX, custody, treasury operations, sanctions/compliance, and
on/off-ramp availability. Those are operating-system concerns, not details a
prototype payment automatically solves.

Credit is a separate authority. A research budget does not authorize borrowing.
Any future credit-backed flow needs independent underwriting, limits,
repayment, default, privacy, and compliance contracts.

## Integration priorities

### Now

- Preserve deterministic fixture mode and its evaluation suite.
- Validate all final citations against source, access, and exact span.
- Keep open-only synthesis as a first-class outcome.
- Exercise blocked, expired, unknown, and fulfilment-failure states.
- Produce a receipt that separates decision, settlement, fulfilment, and
  evidence use.

### Next

- Add one authorized source adapter with versioned provenance.
- Add one pinned HTTP 402/x402 protected resource.
- Validate one XRPL Testnet XRP payment end to end.
- Add an external signer boundary and robust reconciliation.
- Verify the delivered artifact before access.

### Later, only with evidence

- RLUSD and trust-line support.
- A policy/risk service such as t54 Trustline.
- Fiat/card/bank rails such as Unlimit.
- Credit capacity or underwriting integrations.
- Multi-user and production deployment architecture.

## Language guardrails

Safe claims:

- “Fixture mode models the research, approval, settlement, and access boundary.”
- “The server enforces budget and quote rules before a purchase.”
- “Optional XRPL Testnet mode can submit and validate a Testnet transaction.”
- “Final citations are checked against accessible evidence spans.”
- “Payment and content fulfilment are separate.”

Claims requiring direct current evidence:

- A real risk provider approved the transaction.
- A real publisher was paid or licensed the content.
- Mainnet, RLUSD, fiat, card, credit, or production custody is integrated.
- An on-chain transaction proves off-chain fulfilment.
- The system is production-ready, regulated, or legally compliant.

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

## Research limits

- Protocols, headers, hosted services, issuer details, and SDK behavior can
  change. Re-read current primary documentation before implementation.
- No live Trustline or Unlimit credentials were used in this research.
- No real publisher purchase or external-funds transfer is evidenced here.
- Sponsor and vendor claims are not independent security or compliance review.
- Testnet success does not establish mainnet safety or production readiness.
