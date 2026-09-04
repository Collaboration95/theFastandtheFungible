# Ripple XRPL Rights Clearing Agent Research Dossier

**Audience:** theFastandtheFungible hackathon team  
**Research date:** 4 September 2026, Singapore time  
**Purpose:** establish the factual and problem context before proposing a product.

## Executive answer

The promising problem is not “help an AI buy an image.” It is the gap between an
agent’s natural-language commercial brief and a defensible, transaction-bound
decision that a particular asset, seller, licence and resulting artefact are
usable for that brief. Payment is only one control point. A credible system has
to preserve the delegation, normalise rights terms, establish counterparty and
asset integrity, bind the exact quote to payment, prove fulfilment, and retain
an evidence package that can be reviewed later.

The selected concept has a strong fit with the challenge because it naturally
creates a complete economic loop: a customer needs commercially usable content;
an agent discovers offers and evaluates constraints; it purchases the chosen
licence; and it returns both the finished content and a machine-readable rights
record. This is a better use of XRPL than a decorative transfer, but it must not
claim that a ledger transaction or Content Credential itself proves legal
clearance.

## Scope and conclusions

This dossier covers Ripple/XRPL, t54, the supplied hackathon repository and
slides, and the risk surface of an AI licensing/rights-clearing workflow. It is
product and technical research, not legal advice. The analysis uses US and
international standards sources for transferable technical issues; commercial
licensing must be reviewed under the law and supplier terms applicable to the
actual campaign and territory.

**Bottom line on the supplied resources.** The challenge requires XRPL and at
least one successful XRPL transaction. The XRPL AI Starter Kit, x402/MPP, and
the supplied resource skill are recommended, not mandatory. No required
business dataset was found in the supplied repository. Its feedback hook only
collects builder-feedback telemetry for the judging category and is unrelated to
the product or ideation. The documentation pack is valuable for validation, but
it is not a mandatory integration.

## What the slides say

The eight supplied photos are a t54/Trustline presentation, not a Ripple
technical specification. They make three useful claims about the problem space:

1. Trustline is presented as a transaction-level trust layer for the agent
   economy: it checks identity, authorisation/intent, transaction risk,
   protocol compatibility and evidence/dispute support.
2. The slides make six agent-payment failure modes concrete: a prompt-injected
   purchase route, counterfeit seller, silent auto-renewal, redirected payment,
   quiet downgrade and opinion laundering. Treat the stated performance figures
   as vendor-presented figures rather than independent benchmarks.
3. t54 positions itself upstream of XRPL x402/RLUSD payment flows and says it
   provides “pre-execution” governance. That is relevant to a rights-clearing
   flow because the decision must happen before an irrevocable payment.

## Ecosystem map

### Ripple and XRPL

Ripple is the company; the XRP Ledger (XRPL) is the public ledger the challenge
requires. The official challenge asks for an AI-native commercial loop rather
than a wallet demo: need, discovery, constrained decision, transaction and
delivered value. XRPL’s agent guidance highlights deterministic settlement,
predictable fees, multi-asset payments, escrow, multisigning, DepositAuth,
SourceTag and Memo as potentially useful controls. For a prototype, default to
testnet and expose the transaction hash and delivery receipt.

The practical implication is narrow: use XRPL as the observable settlement and
receipt layer for an exactly defined purchase. Do not put customer briefs,
licence PDFs, personal data or full agent reasoning on-chain. A hash/reference
can anchor an off-chain evidence bundle; it cannot make incorrect licence terms
correct.

### XRPL implementation boundaries that matter

RLUSD can be used for direct payments, but an account must establish the
issuer trust line before it can receive it. That onboarding condition and the
ledger reserve are real product friction, even where an x402 flow avoids a
traditional merchant account. Direct settlement is the safest assumption for a
prototype. Do not promise “RLUSD escrow”: the current canonical RLUSD issuer
configuration does not enable the trust-line locking prerequisite for native
token escrow. XRPL escrow has useful time/hash conditions, but it is not a
general content-delivery oracle or a dispute-resolution system.

An approved or validated payment also is not sufficient evidence of economic
fulfilment. For payment types that can deliver a different amount, the validated
`delivered_amount` must be reconciled; a `tesSUCCESS` alone is not a licence
receipt. Credentials, DIDs, NFTs, InvoiceID, SourceTag and Memos can provide
attestation or correlation, but they do not create a native licence-rights
entitlement. In particular, Memos are public and limited; they should contain
only an opaque correlation ID or hash, never licence terms, customer data or
access secrets.

XRPL multisigning and permission delegation can contribute account controls,
but their documented permission model does not provide a general on-chain
per-vendor/per-amount spending cap. A policy-aware signer or approval service
therefore remains necessary to enforce the mandate outside the ledger.

### t54, spelled t54 rather than T45

t54 is independent agent-payment risk infrastructure, not Ripple. Its core
platform is Trustline, a pre-execution underwriting layer for agent-mediated
financial actions. Its documentation says the engine evaluates transaction
context, agent and principal context, evidence/mandate references, policies,
external signals and outcomes. It returns an allow/review/deny posture and
retains audit context. Production access is KYB-gated.

t54 also supplies x402-Secure, an open-source SDK/proxy that adds risk-session
and trace/evidence controls to x402 flows, and an XRPL x402 facilitator.
The XRPL implementation supports XRP and issued assets such as RLUSD. Its
public testnet facilitator is appropriate to demonstrate a prototype flow; it
does not establish a production dependency or solve licence law.

### Rights and provenance standards

Creative Commons shows that licensing can be made discoverable through
machine-readable metadata, but its legal code remains the operative layer.
W3C ODRL provides an expressive model for permissions, prohibitions, duties,
parties and constraints. These standards can structure a policy evaluation;
they do not guarantee that every supplier expresses terms completely or that a
legal interpretation is universally correct.

C2PA Content Credentials provide signed, tamper-evident provenance assertions
and can bind a credential to an asset. C2PA expressly does not make a value
judgment about whether the provenance is “good” or whether the rights are
sufficient. Therefore it is useful as an asset/provenance record, not as proof
that an advertising licence covers the requested use.

## The end-to-end rights-clearing flow

1. **Delegated brief.** The customer states deliverable, commercial purpose,
   audience, media, territory, duration, budget, required asset types and
   exclusions. The system turns this into a signed, versioned mandate.
2. **Discovery.** The agent retrieves asset offers, licence terms, seller
   identity, price, expiry/renewal terms, delivery mechanics and provenance
   evidence from trustworthy sources.
3. **Rights evaluation.** A deterministic policy layer compares each offer to
   the mandate: commercial use, channel, territory, time, audience, edit rights,
   attribution, AI/generative restrictions, exclusivity, derivatives and
   sublicensing. Ambiguity moves the case to review.
4. **Decision.** The agent scores only eligible offers on cost, quality and
   reliability, records the rejected alternatives and creates a payment intent
   bound to one seller, asset/SKU, licence version, amount, currency and expiry.
5. **Pre-payment controls.** Check policy, risk and integrity. Challenge on
   missing evidence, changed terms, mismatched seller/destination, renewals or
   anything outside delegated authority.
6. **Settlement.** Make an XRPL payment tied to the approved payment intent.
   x402 is a natural fit when the seller exposes a paid digital endpoint; it is
   not a substitute for a merchant contract or refund process.
7. **Fulfilment.** Verify that the paid response is the exact asset/licence
   package expected: hash, version, seller receipt, delivery timestamp and
   effective terms. Handle partial or failed delivery explicitly.
8. **Artefact and evidence.** Produce the content plus a rights manifest that
   joins the mandate, evaluated terms, decision, payment/settlement receipt,
   asset hashes, provenance and attribution/usage instructions.
9. **Post-use governance.** Track expiry, renewal and scope changes. A future
   reuse request is a new policy decision, not a free consequence of the first
   purchase.

## Pain-point dossier

| Where the flow breaks | Why it is a real problem | Minimum evidence or control | Slide connection |
|---|---|---|---|
| Natural-language brief to mandate | “Commercially licensed” is underspecified: it may omit channel, territory, term, modification, attribution or exclusivity. | Structured mandate; unknown fields block or require review; immutable version and approval. | Authorisation and intent; prompt-injected path. |
| Discovery and offer integrity | Web pages, tool outputs and metadata can be malicious, stale or designed to redirect an agent. | Trusted connector/allowlist; origin capture; content hash; quote freshness and URL/domain checks. | Prompt-injected path; redirected payment. |
| Licence semantics | Licences differ in scope, definitions and exceptions. A label such as “commercial” does not automatically cover the intended combination or campaign. | Structured policy representation (e.g. ODRL-like fields), term version, human/legal escalation for ambiguity. | Quiet downgrade. |
| Seller and rights-holder identity | A page can offer a genuine-looking asset while lacking authority to license it. | Verified merchant/issuer identity, authority relationship and seller-to-payee binding. | Counterfeit route. |
| Asset identity and derivation | The preview, delivered file and eventual ad may diverge through replacement, cropping, AI modification or embedded components. | Asset hash; version/ingredient graph; C2PA where supported; final output ingredient manifest. | Counterfeit route; quiet downgrade. |
| Price, subscription and renewal | A one-off price may hide a credit pack, recurring obligation or later rate change. | Price/term snapshot, renewal flag, total-cost ceiling, separate approval for recurring commitments. | Silent auto-renew. |
| Counterparty quality signals | Ratings and catalog order can be manipulated; “best” is not a factual property. | Source diversity, provenance for ratings, policy forbidding review-only selection. | Opinion laundering. |
| Bounded authority | A wallet balance is not a sufficient mandate. Agent may exceed total budget or buy an ineligible bundle. | Per-task amount/currency/payee/SKU/expiry limits; deterministic budget ledger; approval boundary. | Authorisation and intent. |
| Payment binding and replay | A payment that is not bound to exact merchant, amount, asset and invoice can be redirected, replayed or settle after terms change. | Exact invoice/quote binding, nonce/expiry, destination/amount check, idempotency and settlement receipt. | Redirected payment. |
| Delivery versus settlement | Irreversible payment can succeed while the download fails, terms are missing or asset is unusable. | Two-stage fulfilment state, receipt reconciliation, retry/refund/escalation path; escrow only where the merchant can support the condition. | Evidence and dispute. |
| Provenance versus legal proof | A signed credential can show who made an assertion and whether it was altered, not whether the assertion was legally complete or truthful. | Display provenance status separately from rights eligibility and seller verification. | Evidence and dispute. |
| Audit, dispute and privacy | Full reasoning may contain prompts, commercial strategy or personal data; a bare transaction hash is not enough for review. | Redacted event log, policy/term snapshots and hashes; protected off-chain evidence store; retention/access policy. | Evidence and dispute. |

## Controls worth testing in a future prototype

The control surfaces that would make the concept credible are: a versioned
customer mandate; a rules-first eligibility gate; a seller/URL/payee binding;
an exact payment intent; explicit allow/review/deny states; an idempotent
settlement and fulfilment state machine; and a separate rights/provenance
receipt. The prototype should visibly refuse at least one unsafe scenario, such
as editorial-only content for an ad, a changed payee, a hidden renewal or a
seller that lacks adequate provenance.

The smallest honest claim is: “This system proves the terms and evidence it
received, applies the disclosed policy, and records why it paid.” It should not
claim to replace counsel, guarantee global rights clearance, authenticate every
creator, or make all downstream uses lawful.

## Source and claim ledger

1. [Official Ripple challenge README](https://github.com/Singhacks-2026/ripple/blob/main/README.md), Singhacks 2026, accessed 4 Sep 2026. Hard requirement, judging, feedback hook and commercial-loop claims.
2. [XRPL Agentic Transactions](https://xrpl.org/docs/agents/agentic-transactions), XRPL Foundation, accessed 4 Sep 2026. Agent controls and XRPL transaction context.
3. [Agentic Payments with x402](https://xrpl.org/docs/agents/agentic-payments-x402), XRPL Foundation, accessed 4 Sep 2026. XRPL x402/T54 implementation role and testnet caveat.
4. [XRPL AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/), Ripple, 9 Jun 2026. Ripple positioning and starter-kit context.
5. [Trustline Overview](https://www.t54.ai/docs/trustline/overview) and [Risk Engine](https://www.t54.ai/docs/trustline/risk-engine), t54, accessed 4 Sep 2026. Product scope, inputs, decisions and evidence model.
6. [XRPL x402 Facilitator Overview](https://xrpl-x402.t54.ai/docs/overview), t54, accessed 4 Sep 2026. HTTP 402, XRP/RLUSD and request-payment-delivery flow.
7. [x402 Specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v1.md), x402 Foundation, accessed 4 Sep 2026. The protocol’s core request/payment/settlement roles and its explicit exclusion of client budget management.
8. [ODRL Information Model 2.2](https://www.w3.org/TR/odrl-model/), W3C, 2018. Machine-readable permissions, prohibitions, duties, parties and constraints.
9. [Creative Commons licensing metadata FAQ](https://creativecommons.org/faq/), Creative Commons, accessed 4 Sep 2026. Machine-readable licence metadata and its discoverability role.
10. [C2PA Content Credentials Specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) and [C2PA Guiding Principles](https://c2pa.org/principles/), C2PA, accessed 4 Sep 2026. Tamper-evident provenance and its limits.
11. [Copyright and Artificial Intelligence](https://www.copyright.gov/ai/), U.S. Copyright Office, accessed 4 Sep 2026. Legal uncertainty around AI/copyright; use as background only, not a global-law conclusion.
12. [RLUSD on the XRP Ledger](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl), Ripple, accessed 4 Sep 2026; [Reserves](https://xrpl.org/docs/concepts/accounts/reserves), XRPL Foundation, accessed 4 Sep 2026; and [Escrow](https://xrpl.org/docs/concepts/payment-types/escrow), XRPL Foundation, accessed 4 Sep 2026. RLUSD trust-line and escrow prerequisites.
13. [Partial Payments](https://xrpl.org/docs/concepts/payment-types/partial-payments), [Credentials](https://xrpl.org/docs/concepts/decentralized-storage/credentials), [Permission Delegation](https://xrpl.org/docs/concepts/accounts/permission-delegation), and [Transaction Common Fields](https://xrpl.org/docs/references/protocol/transactions/common-fields), XRPL Foundation, accessed 4 Sep 2026. Reconciliation, attestations, authority limits and public metadata boundaries.

## Research limitations and stop point

The slides’ performance and partnership figures are treated as t54 claims, not
independently validated results. No supplier contract, marketplace API, actual
licence corpus, user jurisdiction, campaign destination or legal review was
provided. That means this dossier identifies the required decision and evidence
boundaries, but does not decide the legality of a particular asset or propose a
supplier integration. Evidence is sufficient to move to solution framing once
the team selects the first asset category and jurisdiction; further broad
searching would not resolve those product-specific facts.
