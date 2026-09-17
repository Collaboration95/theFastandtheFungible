# Company and Protocol Research Context

## Agent Spend Guard — Ripple + t54 + Unlimit

**Research date:** 5 September 2026 (Singapore time)
**Purpose:** Convert sponsor and protocol research into actionable product,
architecture, demo, and pitch decisions for the SingHacks 2026 Ripple track.
**Working product hypothesis:** Let an AI agent purchase a small digital
service within a human-defined budget and approved destination, while proving
the blocked over-budget path, an approval or evidence-recovery step, a real
XRPL Testnet settlement, fulfilment, and a useful receipt.

This document is an evidence-backed working context, not a claim that the team
has a commercial relationship with every company named here. Public company
pages and sponsor material are labelled as sponsor-stated where appropriate.
Protocol behavior, field names, and network availability must be rechecked
against the live documentation and pinned SDK versions immediately before
implementation and demo day.

## 1. Executive decision

The strongest hackathon wedge is **Agent Spend Guard**, a deterministic policy
and evidence boundary between an agent's discovery/reasoning and an XRPL
signer:

~~~text
human objective and mandate
  -> agent discovers and compares paid digital services
  -> exact quote and destination are extracted
  -> Agent Spend Guard checks authority, budget, asset, payee, expiry, invoice
  -> Trustline-compatible risk/evidence decision
  -> approve, challenge, or block before signing
  -> x402 payment request and payer-signed XRPL Payment
  -> facilitator verifies and settles on XRPL Testnet
  -> paid resource is delivered and hashed
  -> receipt explains the decision, settlement, and delivered value
~~~

The product should not present itself as another wallet, another generic
payment protocol, or a chatbot with a payment button. The compelling claim is:

> An agent can act economically, but it cannot silently change what it was
> allowed to buy, who it pays, how much it spends, or what evidence remains.

### What to build now

1. Use XRP on XRPL Testnet for the first live path. It avoids the additional
   issued-asset trustline setup and is the shortest route to a validated
   transaction.
2. Implement a local deterministic guard first, with the data contract shaped
   like Trustline's async underwriting API. This keeps the demo reliable when
   sponsor credentials or hosted services are unavailable.
3. Integrate a local or hosted x402-style merchant endpoint that returns a
   structured payment challenge. Pin one x402 wire version and test it end to
   end.
4. Make the negative path a hard policy block: an amount above the mandate is
   rejected before signing and therefore has no transaction hash.
5. Make the positive path require an explicit human approval when the quote is
   within budget but the merchant is new or the evidence is incomplete. This
   demonstrates useful autonomy plus a real control boundary.
6. Show one real validated XRPL Testnet Payment, its hash, an explorer link, and
   a fulfilment hash in the receipt.
7. Describe Trustline, x402 Secure, Verifiable Intent, ARS, ClawCredit, and
   Unlimit as layered integration/roadmap options with honest maturity labels.

### What to defer

- RLUSD as the primary live payment, unless both payer and merchant trustlines,
  the exact issuer, the correct canonical currency code, and the testnet
  funding path are already proven.
- Direct production Trustline integration, because public documentation says
  production access requires KYB and explicit t54 enablement.
- ClawCredit as the MVP funding source. It is a beta credit service, custodial
  from the agent's perspective, invite-based, and its documented repayment
  path is currently manual.
- Unlimit API integration in the judged loop. Its public BaaS surface is
  oriented toward accounts, card issuing, card transactions, and fiat payment
  rails, with sandbox access and onboarding credentials. It is useful as a
  future funding, payout, card, or fiat off-ramp adapter, not necessary to
  prove the XRPL digital-service purchase.
- Full ARS protocol implementation. The public reference implementation
  includes EVM/AP2 and VI-specific components that do not map directly to the
  Ripple challenge's XRPL-only qualifying transaction. Borrow its lifecycle
  and settlement-risk ideas without claiming to implement the full protocol.

### Why this has winning potential

It aligns the strongest signals from the challenge and sponsors:

| Requirement or signal | Agent Spend Guard response |
| --- | --- |
| XRPL must be used and a successful transaction shown | Payer-signed XRPL Payment on Testnet, validated with tesSUCCESS, hash, and explorer link |
| Ripple wants a real AI-native business loop | Agent discovers and chooses a paid digital resource that unlocks a useful outcome |
| t54 focuses on agent identity, intent, risk, evidence, and settlement | Guard captures mandate, trace summary, public-safe reason codes, challenge/approval, and receipt |
| x402 is an HTTP-native machine payment flow | Paid service returns exact payment requirements; agent retries with payment evidence |
| ARS separates service fee from principal and delivery risk | Receipt and state machine distinguish payment settlement from fulfilment verification |
| ClawCredit explores agent credit and repayment behavior | Optional future credit-backed spending mode, kept outside the reliability-critical MVP |
| Unlimit provides cross-border fiat/card/BaaS infrastructure | Future rail adapter for funding, payout, cards, and regulated operating workflows |
| Judges score reachability, creativity, feasibility, depth, UX, and feedback | One narrow, legible commercial loop with an honest production path and explicit negative tests |

## 2. Research method and evidence quality

Research combined:

- Computer-use inspection of the sponsor pages and their interactive demos in
  the already-open Brave Browser.
- Direct reading of the active hackathon repository and the public GitHub
  repositories for t54's Agentic Risk Standard and x402 Secure.
- Official Ripple and XRPL documentation.
- Three parallel Luna high-reasoning research passes covering Ripple,
  implementation/challenge materials, and t54's ecosystem.
- A final single Terra medium-reasoning synthesis pass after this draft was
  written. The Terra output is recorded later in this file as a critique and
  prioritization layer.

### Evidence labels

- **Protocol/documented:** field names, routes, lifecycle states, and
  constraints stated in official documentation or public source.
- **Sponsor-stated:** product positioning, customer counts, performance
  figures, partner claims, or marketing language published by Ripple, t54,
  ClawCredit, or Unlimit.
- **Observed in interactive demo:** behavior or copy seen through browser
  interaction on the stated research date; not proof of production readiness.
- **Recommendation/inference:** a product or engineering conclusion derived
  from the evidence.

Do not turn sponsor-stated performance or partnership language into an
independently verified benchmark. Do not expose private prompt content,
secrets, raw reasoning, or credentials in a public repository or ledger
metadata.

## 3. Sponsor and protocol map

### Ripple

Ripple's public material frames XRPL as an agent-ready settlement network:
quick deterministic finality, predictable low fees, native multi-currency
payments, RLUSD, DEX liquidity, and controls such as escrow, DepositAuth,
multi-signing, SourceTag, and Memos. The XRPL AI Starter Kit packages this into
documentation, wallet/payment skills, a tutorial, and x402 support.

### t54.ai

t54's ecosystem can be understood as four layers:

1. **Trustline:** agent-aware underwriting, risk, evidence, audit, and
   challenge handling.
2. **x402 Secure:** intent/evidence-aware risk protection around x402.
3. **XRPL x402 Facilitator:** an XRPL-specific public payment edge for
   payer-signed Payment transactions, with a documented testnet endpoint.
4. **ClawCredit:** agent-facing, credit-backed access to x402 services.

t54's **Agentic Risk Standard (ARS)** is research infrastructure and a useful
design source for separating service compensation, execution principal,
underwriting, collateral, evaluation, and settlement. It is not the same thing
as the Trustline commercial API.

### Unlimit

Unlimit BaaS is a banking-as-a-service and payments infrastructure surface.
Its public pages emphasize:

- multi-currency acceptance and cross-border payment rails;
- inbound and outbound transfers;
- merchant acquiring, card issuing, and banking services;
- accounts, virtual/physical cards, card lifecycle and card transactions;
- a sandbox API with OAuth-style bearer tokens and asynchronous webhooks.

This is valuable for a production expansion story: a guard decision could
authorize a fiat funding, card, or payout rail after the XRPL/x402 digital
service path is proven. The public materials inspected do not establish that
Unlimit is required by the Ripple challenge or that a hackathon team has
instant access to production credentials.

### Important naming distinction

There are two unrelated concepts named “Trustline”:

- **t54 Trustline:** a risk and underwriting product that assesses an
  agent-mediated action.
- **XRPL trust line:** ledger state allowing an account to hold or receive a
  specific issued currency such as RLUSD, with reserve and issuer rules.

The UI and documentation should say “t54 Trustline decision” versus “XRPL RLUSD
trust line” to avoid confusing a judge.

## 4. SingHacks / Ripple challenge contract

The active challenge repository is the operative source:

- [SingHacks 2026 Ripple challenge repository](https://github.com/Singhacks-2026/ripple)
- [challenge README](https://github.com/Singhacks-2026/ripple/blob/main/README.md)
- [challenge resources](https://github.com/Singhacks-2026/ripple/blob/main/resources.md)

### Hard requirements

- XRPL must be used for the blockchain component.
- At least one successful XRPL transaction must be demonstrated.
- Qualifying blockchain functionality must run on XRPL Mainnet, Testnet, or
  Devnet.
- The XRPL EVM Sidechain and other blockchains do not qualify for the
  qualifying transaction.
- The submission needs a working prototype, public source, setup
  instructions, product overview, architecture, and transaction hash or
  explorer link.
- The demo needs to show the customer problem, agent behavior, transaction,
  and delivered outcome.

### Judging weights

| Criterion | Weight | Implication |
| --- | ---: | --- |
| Reachability | 20% | Explain how a bounded payment control can generalize to many paid services and regulated rails |
| Creativity | 20% | Make the agent's economic choice and safety boundary central, not decorative |
| Feasibility | 20% | Keep the MVP narrow, deterministic, testnet-first, and honest about integrations |
| Technical depth | 20% | Show exact quote binding, risk/evidence states, x402, XRPL finality, idempotency, and fulfilment verification |
| UX and design | 10% | Make the need, decision, block/approval, settlement, and value visible in one surface |
| Builder feedback | 10% | Use and report the developer experience, including facilitator and SDK caveats |

### Challenge input signals

The README describes agent inputs such as objective, preferences, budget,
services/providers, pricing, quality/performance, availability, transaction
requirements, payment conditions, and previous actions. It explicitly asks for
transparency, authorization, spending controls, security, traceability,
failure handling, and safeguards. These map directly to the Guard's mandate,
quote, policy, decision, and receipt model.

## 5. t54 Agentic Risk Standard research

Primary sources:

- [ARS research page](https://www.t54.ai/ars)
- [ARS documentation](https://www.t54.ai/docs/research/agentic-risk-standard)
- [ARS GitHub repository](https://github.com/t54-labs/AgenticRiskStandard)
- [ARS protocol landscape](https://github.com/t54-labs/AgenticRiskStandard/blob/main/docs/protocol-landscape.md)
- [arXiv paper](https://arxiv.org/pdf/2604.03976)

### Thesis

ARS describes an “agentic risk” gap: conventional model metrics such as
accuracy, latency, or task success do not tell a customer what happens when an
agent fails to deliver, misexecutes a task, drifts from intent, loses money, or
causes a downstream financial loss. The proposed answer is to quantify and
price task risk and to make execution outcomes contractually enforceable at a
settlement layer.

The page presents four core concepts:

- **Escrow:** lock and release service fees against verified delivery.
- **Underwriting:** assess fund-moving risk before releasing principal.
- **Premium:** price residual failure risk.
- **Collateral:** require provider capital or other protection against explicit
  failure triggers.

### Fee track versus principal track

This is the most useful ARS idea for Agent Spend Guard:

| Track | What happens | Guard implication |
| --- | --- | --- |
| Fee/service track | Fee is held or bound to a job, provider delivers, evaluator verifies, then fee is released or refunded | A small digital-service payment should not be treated as done until the resource is verified |
| Principal/fund-moving track | Principal may need to move before the outcome is known; underwriting, premium, collateral, and an override/human path protect the user | Credit, trading, and large-value workflows need a separate higher-risk policy, not merely a larger budget |

The product should visibly separate:

1. **Settlement:** did the exact XRPL payment validate?
2. **Fulfilment:** did the paid resource arrive and match the promised
   deliverable?
3. **Exception/dispute:** what happens if settlement succeeded but fulfilment
   failed?

### Roles

The ARS page identifies:

- Requestor: supplies the specification and payment authority.
- Business agent: supplies the service, signs the agreement, and provides
  evidence/collateral.
- Underwriter: prices risk and checks solvency.
- Evaluator/arbiter: assesses delivery and disputes.
- Settlement layer: records events and enforces the outcome.

The public repository also describes the settlement layer as the fifth base
role. Some older or visual materials may count roles differently; use the
current repository wording when necessary.

### Lifecycle

The canonical high-level lifecycle is:

~~~text
REQUEST -> NEGOTIATION -> TRANSACTION -> EVALUATION -> CLOSED
                                      \-> CANCELLED
~~~

For Agent Spend Guard, use a smaller implementation lifecycle:

~~~text
DRAFT
  -> DISCOVERED
  -> ELIGIBLE | REVIEW | DENIED
  -> PAYMENT_INTENT_CREATED
  -> AUTHORIZED
  -> SUBMITTED
  -> SETTLED
  -> FULFILMENT_VERIFIED | FULFILMENT_EXCEPTION
  -> RECEIPT_ISSUED
~~~

Every transition should be attributable, timestamped, idempotent, and safe to
replay or reconcile.

### ARS risk model

The research page gives a simple quantitative vocabulary:

- Premium is a fair premium multiplied by a risk-loading factor:
  premium = fair premium × (1 + loading).
- Estimated underwriting failure probability depends on false-negative and
  false-positive rates:
  p_hat_uw = p × (1 - false_negative) + (1 - p) × false_positive.
- Collateral is a sigmoid function of estimated risk and exposure, so it
  increases protection without making every low-risk job friction-heavy.

The practical lesson is not to invent a fake confidence score. Expose the
reason, evidence, policy, and decision path. If a risk model is simulated,
label it simulated.

### Repository findings

The public repository is mostly Python with a small Solidity component and
contains:

- signed, event-sourced job lifecycle primitives;
- Ed25519 signatures, RFC 8785 canonicalization, SHA-256 hashes;
- append-only SQLite storage;
- replay-based state derivation;
- explicit invalid-transition and authorization errors;
- a mock settlement seam;
- an AP2 implementation using x402 and EIP-3009 escrow;
- a Mastercard Verifiable Intent implementation using ES256, SD-JWT
  credential chains, and selective disclosure.

At browser inspection time the public GitHub page showed a main branch with
roughly 36 stars, 3 forks, 33 commits, Python as the dominant language, and a
recent documentation update around 1 September 2026. These repository
metadata values can change and are included only to record what was reviewed,
not as a quality or adoption benchmark.

The AP2 path models:

- user IntentMandate with budget, merchant whitelist, SKU constraints, TTL,
  and whether principal is required;
- merchant CartMandate with final items, price, and a short TTL;
- user PaymentMandate with final payment authorization bound to the cart.

The repository deliberately separates a shopping agent from a credential
provider/payment processor. The shopping agent should not hold the payment
credential. This is directly applicable: the LLM may discover and explain, but
the bounded signer/control layer owns the authority to move funds.

### Protocol landscape

The ARS landscape document makes a useful five-layer distinction:

1. Identity: Visa TAP, Web Bot Auth, FIDO and related identity signals.
2. Intent authorization: AP2 and Mastercard VI.
3. Commerce interaction: ACP, UCP and related catalog/checkout protocols.
4. Payment/rails: x402, MPP, cards, stablecoins and other settlement media.
5. Settlement risk: escrow, evaluation, underwriting, collateral and dispute
   handling, which ARS addresses.

The positioning opportunity is clear:

> Agent Spend Guard is the policy and settlement-risk boundary that makes an
> x402/XRPL purchase safe to execute and legible after it completes.

It should be additive to x402, AP2, VI, ACP, MPP, and Unlimit—not a claim that
one protocol replaces all the others.

### ARS interactive demo observations

The [ARS demo](https://www.t54.ai/ars) is titled “Quantifying Hidden Agent Risk”
and presents scenario cards plus a risk slider. The scenarios observed in the
browser were:

- **TokyoFastFX Currency Exchange:** a user exchanges 10,000 USD to JPY; high
  apparent success but hidden reputation laundering/systemic wash trading;
  ARS claims fully protected exposure, a premium, and collateral.
- **AlphaGrowth Portfolio Bot:** a 5,000 USD investment is reallocated based on
  viral NVIDIA contract-loss sentiment; hidden misexecution and a realized
  loss; ARS shows an excess refund, premium, and collateral.
- **QuickBet Sports Exchange:** a 1,000 USD bet is exposed to congestion and
  slippage; ARS shows an adjusted payout, premium, and collateral.

The page states that its simulation uses 5,000 transactions, a log-normal
transaction-size distribution, a Beta prior with mean failure probability 0.15,
adoption/loss/failure/solvency metrics, and parameters such as false-positive
rate 0.05, false-negative rate 0.10, and risk loading 0.30. Those are
research-demo settings, not production guarantees.

The observed cards also provide concrete risk-story numbers:

| Scenario | Hidden failure/risk signal | Unprotected illustration | ARS illustration |
| --- | --- | --- | --- |
| TokyoFastFX | Reputation laundering shown at 93%; 12,400 internal wash exchanges | 10,000 USD principal exposure | 0 USD guaranteed exposure, 5 USD premium, 2,000 USD collateral |
| AlphaGrowth | 17% hidden misexecution from a viral misinformation signal | 1,050 USD realized loss | 400 USD excess refunded, 6 USD premium, 800 USD collateral |
| QuickBet | 12% slippage risk; 7-second congestion delay | 450 USD value loss | payout adjusted to 0 USD, 2 USD premium, 300 USD collateral |

These values are useful for explaining why transaction success alone is not
enough, but they belong to the sponsor's illustrative simulation. They should
not be reused as empirical rates in our product.

The slider and scenario cards communicate the important story, but the
interactive page itself does not prove a real settlement. Agent Spend Guard
should borrow the risk-explanation pattern and add the missing concrete
artifact: a validated XRPL hash and a fulfilment receipt.

## 6. t54 Trustline research

Primary sources:

- [Trustline product page](https://www.t54.ai/trustline)
- [Trustline overview](https://www.t54.ai/docs/trustline/overview)
- [Getting started](https://www.t54.ai/docs/trustline/getting-started)
- [Developer portal](https://www.t54.ai/docs/trustline/developer-portal)
- [Async underwriting API](https://www.t54.ai/docs/trustline/async-underwriting)
- [Agentic Challenge](https://www.t54.ai/docs/trustline/agentic-challenge)
- [Webhooks and Monitoring](https://www.t54.ai/docs/trustline/webhooks-and-monitoring)
- [Compliance and Audit](https://www.t54.ai/docs/trustline/compliance-audit)
- [Risk Engine](https://www.t54.ai/docs/trustline/risk-engine)
- [Underwriting](https://www.t54.ai/docs/trustline/underwriting)
- [Subject and Label System](https://www.t54.ai/docs/trustline/unified-subject-label-system)
- [External Signals](https://www.t54.ai/docs/trustline/external-signals)

### Product positioning

t54 positions Trustline as the “trust layer institutional finance runs agents
on” and as pre-execution underwriting rather than simple fraud scoring. The
decision asks whether an action is sufficiently:

- authorized by the principal;
- understandable from the evidence and trace;
- consistent with policy and mandate;
- economically reasonable;
- attributable to a verified agent, owner, and workload.

The landing page identifies the institutional trust gap as:

- identity binding: a KYC'd human does not automatically identify the runtime
  agent that acts;
- proof of intent: a rail may record a trade but not why the agent made it;
- liability: card controls and chargebacks assume a human click;
- runtime drift: models, plugins, tools, and environments change over time.

Trustline's KYA framing is especially relevant: bind the action to an agent,
owner, workload, and environment; detect identity rotation or environment
shifts; maintain a living trust graph rather than performing a one-time check.

The product page groups the offering into five practical capabilities:

1. **KYA:** a live graph of agents, owners, and workloads, including changes in
   runtime identity and environment.
2. **Authorization and intent:** ask for an intent explanation or trace when
   the action is ambiguous or outside the original context, then log the
   approve/decline/challenge decision.
3. **Transaction risk:** show validator/risk confidence and retain a
   tamper-evident audit chain.
4. **Integration:** read intent/mandate and payment evidence across AP2, VI,
   x402, A2A, MCP, and related agent protocols without routing funds itself.
5. **Evidence and disputes:** preserve signed, replayable evidence and provide
   a dispute/evaluation path.

The landing page shows illustrative decision copy such as a KYA-owner-mandate
check, merchant binding, validator count, confidence, latency, and a tiny XRP
assessment fee. These are UX/product examples, not a guarantee that every
Guard transaction would use the same validator model or pricing.

### What Trustline evaluates

The docs group inputs into three categories:

1. **Transaction-native:** amount, currency/asset, merchant, wallet, payee,
   destination, invoice, chain, and settlement context.
2. **Agent-native:** agent identity, owner/delegation, mandate, task,
   reasoning summary, tool trace, code/runtime information, and history.
3. **External signals:** wallet/entity risk, sanctions or blocklists,
   high-risk counterparty tags, and provider confidence.

Trustline explicitly separates evidence from policy. Evidence records what was
known; policy determines what action is taken. That separation is an excellent
design pattern for the Guard because the same evidence can be evaluated under a
strict consumer policy, a sandbox policy, or a higher-risk institution policy.

### Decision semantics

Trustline's broader posture vocabulary is:

- Allow
- Review
- Deny
- Record

The workload API itself returns a binary final decision:

- APPROVE
- DECLINE

“Review” is represented through reason context and product handling rather than
a third final decision value. A public integration should not invent a third
Trustline decision value. In the Guard UI, local product states can still be
APPROVED, APPROVAL_REQUIRED, BLOCKED, and CHALLENGE_REQUIRED, while the
adapter maps the final Trustline result to APPROVE or DECLINE.

### Async underwriting API

The documented flow is:

~~~text
POST /api/v1/validation/assess-async
  -> durable trustline transaction id and poll URL
  -> GET /api/v1/underwriting/transactions/{trustline_transaction_id}
  -> final APPROVE or DECLINE, or a challenge state
~~~

The base URL is documented as:

~~~text
https://portal.t54.ai/api/v1
~~~

Sandbox keys are environment-scoped and look like a t54 Trustline sandbox key
prefix. Production access requires KYB and explicit enablement after a launch
review. The submission requires an Idempotency-Key.

The important request fields are:

~~~text
assessment_type: "transaction"
agent_id
transaction_data.transaction:
  amount
  currency
  recipient
  chain
  merchant
  intent
  transaction_id
audit_context:
  current_task
  reasoning_process
request_body:
  http:
    url
    method
  body:
    ...
metadata:
  source
  environment
~~~

The docs warn that thin or missing audit context is more likely to trigger an
Agentic Challenge. This supports collecting a concise, redacted trace summary
before the payment attempt.

Documented status values include:

- accepted
- queued
- running
- running_validators
- finalizing
- requires_information
- information_submitted
- reassessing
- completed
- failed
- expired
- canceled

Poll responses are public-safe. They expose status, decision, risk level,
confidence, reason brief, reason codes, warnings, and audit references, but
not raw prompts, private policy material, raw evidence, restricted URIs, or
other tenant data.

### Agentic Challenge

The [Agentic Challenge documentation](https://www.t54.ai/docs/trustline/agentic-challenge)
is a powerful model for the requested approval step. A challenge is not an
approval; it is a structured request for evidence when more context could
change the outcome.

Eligible reason codes and triggers include:

- EVIDENCE_INSUFFICIENT
- REASONING_INCONSISTENCY
- POLICY_CONSTRAINT_MISMATCH
- TRANSACTION_PATTERN_RISK
- BEHAVIOR_ANOMALY
- PAYMENT_NOT_REQUIRED
- AGENT_IDENTITY_MISMATCH
- AMOUNT_EXCEEDS_LIMIT
- MERCHANT_RISK
- AFFORDABILITY_RISK
- INSUFFICIENT_CREDIT_HISTORY
- missing trace or low validator confidence

PROMPT_INJECTION_RISK and SECURITY_RISK are challengeable only in limited
cases. Critical-risk, failed audit-integrity, and high-confidence high-risk
declines are final and do not get a challenge.

The public-safe challenge object includes:

~~~text
schema_version: agentic_challenge.v1
challenge_id
status: open
reason_brief
required_information:
  - intent_explanation
  - agent_trace_delta
  - supporting_artifacts
submit_url
poll_url
expires_at
~~~

The answer endpoint is:

~~~text
POST /api/v1/underwriting/transactions/{trustline_transaction_id}/challenge-response
~~~

The response must include the challenge ID, a response idempotency key, agent
ID, and only the requested public-safe information. Responses are hashed,
classified, redacted, audited, and reassessed under the same transaction ID.
Payloads are limited to 32 KB and individual text fields to 4,000 characters.
Sensitive keys such as password, token, secret, private_key, prompt, and raw
are stripped. Artifacts are referenced by URI and SHA-256 hash rather than
uploaded inline.

Challenge status flow:

~~~text
open
  -> information_submitted
  -> reassessing
  -> completed with final decision
      or expired / canceled
~~~

A transaction is challenged at most once. The response is evidence, not a
grant of permission. The final decision still must be polled.

### Webhooks and monitoring

t54's [webhook documentation](https://www.t54.ai/docs/trustline/webhooks-and-monitoring)
states that webhooks are hints, while the transaction resource is the source
of truth.

Two event types are emitted today:

- underwriting.transaction.requires_information
- webhook.endpoint.test

Completion/failure/reassessment event names are documented as reserved but are
not currently emitted. Therefore, the Guard should poll for final decision and
reassessment outcomes even if it later adds webhook wakeups.

Webhook requests include:

- X-Trustline-Webhook-Id
- X-Trustline-Timestamp
- X-Trustline-Signature: v1=<hex_hmac_sha256>

The signed base string is:

~~~text
<timestamp>.<raw_body>
~~~

The receiver should read the raw body, reject timestamps outside a 300-second
window, compute HMAC-SHA256 with the endpoint secret, compare in constant time,
and deduplicate on the webhook ID before any business action. Delivery is
at-least-once with a 5-second HTTP timeout. The documented retryable cases
include timeouts, connection failures, 5xx, 408, 409, 425, and 429, with up to
three attempts and exponential backoff at roughly 60 seconds and 120 seconds.
Other 4xx responses are dead-lettered. This is an excellent production pattern
for the Guard's own decision and settlement events.

### Compliance and audit

Trustline says each decision has a tamper-evident, hash-chained audit trace.
The public summary can include:

- ordered event history and head hash;
- sequence and previous-hash links;
- signature summary and key IDs;
- evidence-manifest hash and verification counts;
- finalizer decision, risk, confidence, reason codes, input/output hashes;
- policy snapshot references;
- retention state;
- export eligibility;
- support-safe and agent-facing explanation views.

The compliance surfaces intentionally redact raw prompts, raw tool outputs,
restricted evidence, internal URIs, private policy, and other tenant data.
That gives the Guard a precise principle:

> A receipt should prove what was evaluated without becoming a public dump of
> private reasoning.

### Trustline marketing claims

The Trustline landing page states figures such as 20 million-plus agentic
transactions protected/screened, 41,000-plus agents KYA'd, 97.6% approval,
87.3% average confidence, 1.63 million successful decision completions, and
sub-five-second average latency. It also gives illustrative wallet-risk
examples and labels a research paper.

These should be cited as **t54 sponsor-stated claims**, not as independent
benchmarks. The hackathon pitch should focus on the architecture and observed
demo rather than relying on performance numbers that the team did not verify.

The Trustline page also presents sponsor-stated ecosystem proof points:

- Ripple is described as a customer since June 2025 using Trustline and
  ClawCredit, with t54 contributing x402 support and bringing RLUSD agent
  payment volume to XRPL.
- Mastercard is described as a June 2026 partner around Agent Pay for
  Machines, Trustline, KYA, transaction risk, and lifecycle traceability.
- AWS Bedrock AgentCore is described as a spend-limit/budget/connectors
  integration where Trustline can score a transaction before completion.
- Franklin Templeton is listed in the ecosystem around an AI financial
  agentic kit.

These statements are useful questions to ask sponsors and useful positioning
signals. They are not a license to claim customer status, endorsement,
certification, or a production integration for our project.

### Trustline implementation recommendation

Create an interface such as:

~~~text
RiskProvider.assess(payment_intent, evidence_envelope)
  -> APPROVED | BLOCKED | CHALLENGE_REQUIRED | PROVIDER_UNAVAILABLE
~~~

Implement two providers:

1. LocalPolicyRiskProvider: deterministic rules for the live demo.
2. TrustlineAsyncProvider: optional adapter using the documented async API
   when sandbox credentials are available.

Keep the UI and receipt schema identical in both modes. Display the actual
provider and environment:

~~~text
Decision source: Local Spend Guard (demo policy)
or
Decision source: t54 Trustline sandbox
~~~

This prevents a reviewer from mistaking a local mock for a live sponsor
decision and makes a future integration low-risk.

## 7. t54 x402 Secure research

Primary sources:

- [x402 Secure product page](https://www.t54.ai/x402-secure)
- [x402 Secure docs](https://www.t54.ai/docs/products/x402-secure)
- [x402 Secure developer guide](https://www.t54.ai/docs/products/x402-secure-developer-guide)
- [x402 Secure partner brief](https://www.t54.ai/docs/products/x402-secure-partner-brief)
- [x402 Secure operations runbook](https://www.t54.ai/docs/products/x402-secure-operations-runbook)
- [x402 Secure GitHub](https://github.com/t54-labs/x402-secure)

### Product role

t54 describes x402 Secure as risk protection embedded around x402:

~~~text
agent/tool trace + intent evidence
  -> secure envelope binds evidence to payment terms
  -> Trustline risk evaluation
  -> allow / deny / review posture
  -> facilitator or proxy verifies/settles
  -> receipt and evidence remain available
~~~

The product supports an XRPL-first hosted facilitator plus a hosted paid API
and an open-source proxy for other supported chains. It is designed to catch
what a normal x402 payment does not understand: whether the agent was
prompt-injected, whether the merchant/destination is counterfeit, whether
terms contain auto-renewal, whether a tool altered a tenant or payee, whether
the item was silently downgraded, and whether reviews were manipulated.

### Observed interactive demo scenarios

The browser demo exposes three scenario buttons:

- Token Mint, with a deliberately suspicious scam-example.invalid request;
- Concert Ticket, with a budget-bound Billie Eilish ticket request;
- Coffee Maker.

Selecting a scenario changes the agent request. Sending the message showed a
waiting state for a buyer agent to initiate the payment request. It was a
product-flow demonstration, not a real XRPL settlement. This is a useful
benchmark for our UX: the Guard should make the actual settlement artifact the
hero moment.

The six detailed failure modes are reusable negative tests:

1. Prompt-injected shopping path: a comparison page rewrites outbound URLs to
   an affiliate merchant that was not authorized.
2. Counterfeit route: title, image, and price match, but the seller is not an
   authorized merchant and the wallet owner is wrong.
3. Silent auto-renew: a one-month trial includes a future recurring charge
   without a recurring mandate.
4. Tool-chain tampering: middleware swaps tenant ID, destination tag, memo, or
   beneficiary.
5. Spec creep/downgrade: a 24 GB GPU is replaced with a 16 GB equivalent at
   the same price.
6. Opinion laundering: a “best” recommendation is based on an SEO-poisoned,
   non-independent review network.

For Agent Spend Guard, turn these into a compact test matrix:

| Test | Guard behavior |
| --- | --- |
| Amount above budget | Hard block before signing; no hash |
| Payee not in allowlist | Hard block or step-up, depending on policy |
| Invoice ID reused | Reject as replay |
| Price/terms changed | Recompute quote hash and require a new decision |
| Prompt-injected route | Reject untrusted destination change |
| Missing evidence | Approval or Agentic Challenge, never silent auto-pay |
| Payment validates but body is wrong | Fulfilment exception and receipt with mismatch |

### x402 Secure evidence and headers

The developer materials describe:

- risk session creation;
- trace collection and trace IDs;
- a paid resource request;
- 402 response;
- retry with payment plus risk/trace evidence headers;
- settlement only after risk enforcement.

The open-source SDK names concepts such as BuyerClient, RiskClient,
OpenAITraceCollector, trace storage, and a payment helper. Documented
seller-side headers include:

- X-PAYMENT
- X-PAYMENT-SECURE
- X-RISK-SESSION
- optional AP2/VI evidence headers.

Large evidence should be stored by reference with hashes rather than copied
into payment requests. This is also the right posture for our receipt.

### Verifiable Intent and AP2

x402 Secure's “evidence in / binding layer / decision out” model is:

- accept VI presentation references, AP2 mandate references, holder binding,
  and trace pointers;
- bind them to amount, asset, destination, resource, buyer, merchant, and
  trace context;
- return an auditable allow/deny/review result with violation/evidence refs.

The XRPL x402 VI documentation describes:

1. L1 issuer credential binding owner identity, allowed chains/assets, and
   spending ceiling.
2. L2 owner-signed delegation authorizing a particular agent key under
   constraints.
3. L3 agent-signed action binding the exact invoice and payment requirements.

This makes a good future technical-depth upgrade, but generating an actual
credential chain should not jeopardize the basic Testnet transaction.

### Operational caveats

- Trustline production access is gated by KYB and explicit enablement.
- The public language “liability protection” should not be presented as a
  legal guarantee, insurance policy, or automatic dispute outcome.
- A partner brief says VI-aware/VI-compatible is not the same as Mastercard
  certification.
- Framework support is uneven; the web page highlights OpenAI Responses API
  and Agent SDK, while other frameworks are described as forthcoming.
- The open-source repository documents a mandate-fetcher SSRF concern and
  says an allowlist default should be tightened for production.
- Hosted endpoints should be treated as prototype infrastructure with
  timeouts, observability, and fail-closed behavior.

## 8. XRPL x402 Facilitator research

Primary sources:

- [XRPL x402 facilitator](https://xrpl-x402.t54.ai/)
- [facilitator overview](https://xrpl-x402.t54.ai/docs/overview)
- [quickstart](https://xrpl-x402.t54.ai/docs/quickstart)
- [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
- [Verifiable Intent](https://xrpl-x402.t54.ai/docs/verifiable-intent)
- [VI agent guide](https://xrpl-x402.t54.ai/docs/verifiable-intent/agent-guide)
- [FastAPI merchant guide](https://xrpl-x402.t54.ai/docs/merchant-guides/fastapi)
- [Python client guide](https://xrpl-x402.t54.ai/docs/client-guides/python)

### x402 v2 wire contract

The XRPL exact scheme uses a payer-signed standard XRPL Payment transaction.
The payer signs; the facilitator submits the signed blob; the payer's signed
fee is included in the transaction.

The documented x402 v2 headers are:

| Direction | Header | Meaning |
| --- | --- | --- |
| Server to client | PAYMENT-REQUIRED | Base64 JSON payment challenge |
| Client to server | PAYMENT-SIGNATURE | Base64 JSON signed payment payload |
| Server to client | PAYMENT-RESPONSE | Base64 JSON settlement result |

CAIP-2 network IDs:

| Network | ID |
| --- | --- |
| Mainnet | xrpl:0 |
| Testnet | xrpl:1 |
| Devnet | xrpl:2 |

An example signed payload contains:

~~~text
x402Version: 2
accepted:
  scheme: exact
  network: xrpl:1
  asset: XRP
  payTo: rDestinationAddress...
  amount: 1000000
  maxTimeoutSeconds: 600
  extra:
    sourceTag: 804681468
    invoiceId: INV-abc123
payload:
  signedTxBlob: hex-encoded XRPL transaction
~~~

One million drops equals one XRP. XRP amounts must be integer drop strings.
For an issued asset, use the canonical 40-hex currency code, decimal amount,
and exact issuer address. The documented canonical RLUSD code is:

~~~text
524C555344000000000000000000000000000000
~~~

### Required payment requirements

The exact scheme documents:

- scheme, always exact;
- CAIP-2 network;
- asset;
- payTo classic XRPL address;
- amount;
- maxTimeoutSeconds;
- extra.invoiceId;
- extra.sourceTag;
- extra.issuer for issued currencies;
- optional destination tag.

### Invoice binding and replay

The facilitator requires the signed transaction to commit to the invoice:

- MemoData equals the hex encoding of the UTF-8 invoice ID, or
- InvoiceID equals SHA-256 of the invoice ID.

A valid payment without invoice binding must be rejected because it could be
replayed against multiple resources. The Guard should also consume each invoice
once after settlement.

### Verification checks

The documented verification sequence checks:

1. x402 version, scheme, and supported network;
2. decodable signed transaction;
3. transaction type is Payment;
4. destination equals payTo;
5. NetworkID matches the CAIP-2 network;
6. amount equals the required amount;
7. LastLedgerSequence is present for bounded expiry;
8. Memo or InvoiceID binds the invoice;
9. fee limits, no partial payments, and no cross-currency behavior.

Common error codes include invalid network, requirements mismatch, invalid
transaction blob, non-Payment transaction, destination mismatch, source-tag
mismatch, amount mismatch, missing or incorrect invoice binding, and missing
LastLedgerSequence.

### Settlement response

A successful PAYMENT-RESPONSE contains:

~~~text
success: true
transaction: XRPL transaction hash
network: xrpl:1
payer: rPayerAddress...
~~~

The app should still query the XRPL node or explorer and wait for a validated
result. A facilitator response or preliminary submit response is not enough.

### Version mismatch to resolve before implementation

The official XRPL agentic x402 page currently describes an X-PAYMENT retry
header, while the current t54 XRPL facilitator docs use x402 v2
PAYMENT-REQUIRED, PAYMENT-SIGNATURE, and PAYMENT-RESPONSE. The open-source
x402 Secure artifacts also contain v1-style X-PAYMENT examples.

Do not mix the contracts mechanically. Pin the exact SDK/facilitator version,
write one integration test that captures the actual response and retry
headers, and display the chosen version in the technical receipt.

### Recommended first payment numbers

Use deterministic testnet values:

- mandate cap: 10,000 drops;
- over-budget quote: 15,000 drops, hard blocked;
- allowed quote: 8,000 drops, within the cap but approval-required for a new
  merchant;
- XRPL fee: autofilled and separately shown;
- invoice: unique per attempt;
- source tag: stable project or workflow value;
- memo: opaque receipt correlation only.

These are demo values, not pricing recommendations. The merchant endpoint can
return a small digital report, data snapshot, image transformation, or
structured research result. The value must be verifiable after payment.

## 9. Ripple research

Requested primary sources:

- [Stablecoin payments fintech checklist](https://ripple.com/insights/fintech-checklist-stablecoin-payments-journey/)
- [XRPL AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/)
- [XRPL lending protocol](https://ripple.com/insights/the-xrpl-lending-protocol-bringing-credit-infrastructure-onchain/)
- [UDAX Brazil](https://ripple.com/insights/ripple-launches-university-digital-asset-xcelerator-udax-in-brazil/)

### Stablecoin payments checklist

Ripple's fintech checklist frames stablecoin payments as more than a fast
transfer. Production complexity moves into:

- jurisdiction and regulatory treatment;
- reserve transparency and auditability;
- where funds are held;
- liquidity corridors;
- FX exposure;
- on-chain and off-chain balance management;
- fragmented liquidity;
- treasury and daily operational processes;
- the decision to build, partner, or use a unified platform.

Use this as the production expansion checklist for Agent Spend Guard. The
prototype can be XRP Testnet, but a serious product must eventually answer:

1. Which legal entity is the principal and which is the payee?
2. Which asset and issuer are allowed in each jurisdiction?
3. Where are funds held before and after the agent acts?
4. What happens if an on/off-ramp or corridor is unavailable?
5. How are FX and stablecoin exposure presented to the principal?
6. Which controls are automated versus owned by an operations/compliance team?

### XRPL AI Starter Kit

Ripple's AI Starter Kit article says agents already need to pay for compute,
APIs, invoices, and constrained services. It highlights:

- XRPL documentation MCP server;
- XRPL Agent Wallet Skill;
- XRPL Payment Skill;
- agentic transaction guidance on xrpl.org;
- x402 payment support using XRP and RLUSD, with t54's contribution to XRPL
  support;
- a testnet tutorial designed for a short setup path;
- source-tag tracking and spending controls.

Ripple's framing of XRPL includes:

- deterministic finality in roughly 3–5 seconds;
- predictable tiny transaction fees;
- native multi-currency payments and DEX functionality;
- no smart-contract execution risk for a basic Payment;
- escrow, multi-signing, DepositAuth, and trustline controls.

This is exactly the right layer for our live demo: the agent chooses a service,
the Guard decides whether the exact terms are permitted, and XRPL provides a
publicly inspectable settlement result.

### XRPL lending protocol

Ripple's lending article makes an important governance distinction:

> Credit judgment remains off-chain; standardized loan execution and records
> can be on-chain.

The article describes Single Asset Vault and Lending Protocol components,
XLS-65 and XLS-66, subject to validator approval. It gives a payment-provider
example that borrows against expected RLUSD inflows, with compliance checks,
verifiable credentials, first-loss capital, and standardized loan terms.
The linked lending environment is a development/demo environment and is not a
reason to add borrowing to our MVP.

Use this as a future “credit escalation” story:

~~~text
small prepaid service -> Guarded XRP/RLUSD purchase
larger or recurring spend -> underwriting + credit facility
working-capital principal -> separate risk, collateral, and compliance policy
~~~

Never imply that a payment budget automatically authorizes borrowing.

### UDAX Brazil

Ripple's UDAX article describes an eight-week accelerator with Fundação Getulio
Vargas and nine startups. Examples include:

- Levery: institutional wallets, permissioned pools, swaps, tokenized assets,
  and reported on-chain activity;
- Kapitale: receivables tokenization;
- VS1: bonds;
- BillPay: Brazil–Paraguay corridor;
- TrustBond: donation traceability and impact auditing;
- Lendara: family-farming microcredit and regulatory work;
- C9 Tech: XRPL Mainnet operations and corporate customers.

The article also gives participant-reported maturity, investment-readiness,
confidence, and active-user figures. Treat those figures as sponsor/participant
reported, not independently verified.

The strategic lesson is that Ripple rewards serious operating context:
regulated counterparties, auditability, liquidity, and a path beyond a
technology demo. Frame the Guard as infrastructure that lets a regulated
organization delegate small actions without giving an agent an unbounded
wallet.

## 10. Official XRPL agentic documentation

Primary sources:

- [XRPL agentic transactions](https://xrpl.org/docs/agents/agentic-transactions)
- [getting started with agentic transactions](https://xrpl.org/docs/agents/getting-started-with-agentic-transactions)
- [agentic x402 payments](https://xrpl.org/docs/agents/agentic-payments-x402)
- [track agent behavior](https://xrpl.org/docs/agents/track-agent-behavior)
- [XRPL Agent Wallet Skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill)
- [XRPL Payments Skill](https://xrpl.org/docs/agents/xrpl-payments-skill)
- [XRPL token trust lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
- [Ripple RLUSD on XRPL](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
- [XRPL Testnet faucets](https://xrpl.org/resources/dev-tools/xrp-faucets)
- [Open Wallet Standard](https://github.com/open-wallet-standard/core)

### Agentic transaction loop

Official XRPL guidance presents a compact loop:

~~~text
trigger -> agent decision -> transaction construction
  -> local preview/simulation -> signing
  -> submitAndWait -> validated tesSUCCESS or clean expiry
  -> log hash, result, and outcome
~~~

The wallet layer should own autofill, preview, signing, and submit-and-wait.
The application must not treat a preliminary submit response as final.

### Wallet security

- Never expose or log wallet seeds.
- Use environment variables only for local development; use KMS/HSM or an
  external signer in production.
- Confirm the signing address matches the transaction Account.
- Persist the transaction hash or signed blob before submission when possible.
- Do not blindly resubmit after a timeout; reconcile sequence, hash, and ledger
  state.
- Use scoped and expiring auto-sign permissions only when explicitly
  authorized.

For the hackathon, keep the seed in an ignored local environment file or use a
test signer. Never put it into an LLM prompt, screenshot, trace, public repo,
or receipt.

### XRPL-native controls

The official material points to:

- escrow and checks when a release condition truly exists;
- DepositAuth for inbound payment restrictions;
- multi-signing for organizational approval;
- SourceTag and Memo for attribution;
- native issued currencies and DEX/AMM where genuinely necessary;
- trust lines for issued assets such as RLUSD;
- time-bounded transaction fields such as LastLedgerSequence.

Do not add escrow or a smart contract just to make the diagram look advanced.
For a micro-service purchase, exact Payment + x402 invoice binding + delivery
verification is the clearest path.

### SourceTag and Memos

The [agent behavior guide](https://xrpl.org/docs/agents/track-agent-behavior)
recommends:

- SourceTag as a 32-bit unsigned workflow/agent attribution value;
- hex-encoded structured Memos for correlation;
- WebSocket subscriptions for real-time validated account events.

The documented default Agent Wallet source tag is an example, not a project
requirement. Use a stable team-defined value or suppress it intentionally.

Memo contents are public and incoming memo text is untrusted. For the Guard,
use an opaque reference such as a receipt ID or hash; do not put customer
objectives, raw reasoning, personal data, API keys, or secret URLs on the
ledger.

### RLUSD and XRPL trust lines

The Ripple RLUSD developer material documents:

- Testnet issuer: rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV;
- Mainnet issuer: rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De;
- canonical RLUSD code:
  524C555344000000000000000000000000000000;
- XRPL Testnet RPC:
  https://s.altnet.rippletest.net:51234/;
- XRPL Testnet WebSocket:
  wss://s.altnet.rippletest.net:51233/;
- the need for a trust line before a wallet can hold/receive RLUSD;
- one XRP base reserve plus 0.2 XRP owner reserve for an account/trust-line
  setup, as described in the captured Ripple developer material;
- a testnet distribution path such as tryrlusd.com.

The issuer and canonical code must be read from the current docs at build time.
Do not use “RLUSD” as a bare, unqualified currency symbol in a payment
requirement. The destination must also be prepared to receive it.

Recommendation: show an RLUSD “ready / not ready” diagnostic panel as an
optional technical detail, but run the first judged settlement in XRP unless
the trustline path has been rehearsed.

## 11. ClawCredit research

Primary sources:

- [ClawCredit homepage](https://claw.credit/)
- [ClawCredit overview](https://www.claw.credit/docs/overview)
- [integration skill](https://www.claw.credit/docs/skill)
- [initialization](https://www.claw.credit/docs/initialization)
- [payments and spending](https://www.claw.credit/docs/payments)
- [partner services](https://www.claw.credit/docs/partner-services)
- [repayment](https://www.claw.credit/docs/repayment)
- [agent credit score](https://www.claw.credit/docs/credit-score)
- [ClawCredit Terms](https://www.claw.credit/terms)
- [ClawCredit Privacy](https://www.claw.credit/privacy)
- [ClawCredit SDK](https://www.npmjs.com/package/@t54-labs/clawcredit-sdk)

### Product role

ClawCredit is presented as an agent-native credit service:

1. an agent registers through a skill-first flow;
2. t54 underwriting evaluates runtime identity, code/security, reasoning and
   x402 payment behavior;
3. an eligible agent receives a credit line;
4. the agent spends on x402 services without pre-funding or directly holding
   private keys;
5. the user repays and the line can grow with on-time behavior.

The homepage shows sponsor-stated live counters for active agents, x402
payments, and credit extended. Treat them as marketing metrics, not an
independent benchmark.

At the time inspected, the homepage displayed approximately 127,092 active
agents/pre-qualifying nodes, 3,670,523 cumulative x402 payments settled, and
446,549 USD of total credit extended. The values are dynamic and sponsor
reported. The partner-services documentation names a machine-readable registry
and examples such as Heurist, Lucy, and Ask Surf; it describes partner
verification and monitoring, but does not turn that directory into a general
guarantee of service quality.

### SDK and supported services

The public snippet uses:

~~~text
new ClawCredit({ agentName: "MyAgent" })
credit.register({ inviteCode, runtimeEnv })
credit.pay({ transaction: { recipient, amount, chain, asset } })
~~~

The service is expressly for x402 endpoints such as compute, data, premium
APIs, and other paid resources. Arbitrary P2P transfers and general wallet
payments are rejected. Documented settlement contexts include:

- Base/USDC;
- Solana/USDC;
- XRPL/RLUSD.

The docs describe ClawCredit as a proxy gateway and custodial settlement path:
the agent does not hold the private key or pay gas directly. This may improve
agent onboarding but is a materially different trust model from a user-owned
XRPL signer.

### Credit score

The public docs describe a dynamic 200–850 score, with new agents capped at
500, based on:

- basic code/security quality;
- reasoning quality;
- anomaly detection;
- injection resistance;
- consistency between stated capabilities and actions.

The score affects capacity, but it must not replace per-transaction guard
rules. A high historical score does not authorize a new destination or
over-budget amount.

### Repayment maturity

Repayment documentation says:

- the agent monitors repayment status;
- the user receives a Dashboard link;
- the user connects a wallet and pays;
- the limit is restored;
- automatic programmatic repayment from an agent wallet is Phase 2.

This makes ClawCredit an interesting future “buy now / repay later” mode, not a
dependency for the basic spend-control demo.

### Privacy and abuse implications

The privacy policy says underwriting may collect code, system prompts,
function snapshots, reasoning traces, runtime telemetry, transcripts, history,
IP/blockchain data, and KYC/fraud signals. It describes multi-year retention
for financial and audit records. Terms disclaim beta uptime, score accuracy,
and guaranteed fund availability, and describe consequences for default.

t54's first-party fraud-bounty communication reports an attack involving more
than 130 fabricated agent identities and approximately 430 USD Coin drained
before containment. This is a useful reminder that fabricated history,
identity rotation, and Sybil behavior are not theoretical.

Do not ship ClawCredit without a privacy review, consent boundary, and an
explanation of what the agent/provider can inspect.

### Where ClawCredit fits

Use it in the story as:

- a future credit-backed provider for agents that have earned trust;
- an example of why score, runtime identity, and repayment records matter;
- a possible merchant/access network for x402 services.

Do not use it as:

- the reason the guard exists;
- a replacement for budget and payee enforcement;
- a general wallet;
- a production promise without invite, onboarding, API, and repayment access.

## 12. Unlimit research

Primary sources inspected in Brave:

- [Unlimit BaaS payments](https://www.baas.unlimit.com/payments/)
- [Unlimit BaaS use cases](https://www.baas.unlimit.com/use-cases/)
- [Unlimit BaaS developer portal](https://www.baas.unlimit.com/dev-portal/)
- [UNL BaaS API introduction](https://ubc-dev.unlimint.com/docs/ubc-api/3bg1xs8j9k2gz-introduction)
- [UNL BaaS API overview](https://ubc-dev.unlimint.com/docs/ubc-api/q9fuvilnmb4oz-unl-baa-s-api)
- [UNL BaaS webhooks](https://ubc-dev.unlimint.com/docs/ubc-api/rhjnczrxhku8x-list-of-available-webhooks)

### Public product surface

The payments page says Unlimit BaaS connects partners to cross-border payment
rails and supports bespoke programs. It highlights:

- currencies such as EUR, USD, and GBP;
- international payments to more than 35 currencies in more than 50 countries;
- BACS, Faster Payments, SEPA, and peer-to-peer transfers;
- merchant acquiring, card issuing, and banking services.

The use-case page calls out financial-service firms, neobanks, fintech
incubation/sandbox environments, insurance payouts, crypto-enabled cards, and
instant disbursements. It describes virtual cards that can be generated and
loaded per transaction, useful for cost-centre accounting and controlled
disbursement.

### Developer API findings

The public API documentation identifies:

- API version 2.35.6 at the time inspected;
- sandbox base URL:
  https://ubc-sandbox.unlimint.io/api/v1;
- a mock server;
- OAuth 2.0-style bearer authentication;
- onboarding-provided credentials for initial token issuance;
- access-token and refresh-token lifetimes;
- account opening, card issuance/cancellation, card status and information,
  payment, and lifecycle management;
- a sandbox environment, while live access is provided during partner
  onboarding;
- asynchronous workflow: requests are accepted/queued and results arrive via
  HTTPS webhooks.

The documentation includes sample credentials and token material in example
blocks. No credentials were entered, used, copied into this repository, or
treated as real. Never paste documentation examples into a production
configuration.

### Webhook model

Unlimit says partners provide HTTPS URLs during onboarding. Webhooks use POST
requests and contain a data section plus metadata identifying notification type
and ID. The available categories include account/card status, card
transactions, customer risk score, incoming account transaction, invoice
transaction, KYC updates, load operations, and payment status.

This is relevant to Agent Spend Guard's operating model:

~~~text
XRPL/x402 payment decision
  -> external fiat/card/payout rail if needed
  -> asynchronous provider event
  -> reconcile by idempotent external ID
  -> unified customer receipt
~~~

### Recommendation

Unlimit should appear in the “scale beyond the demo” architecture:

- a fiat funding adapter;
- a card or bank payout adapter;
- a regulated merchant/acquirer route;
- an event-driven reconciliation provider.

It should not be wired into the primary judged loop unless the team receives
documented hackathon sandbox credentials, a clear use case, and enough time to
test the async lifecycle. The primary proof remains an XRPL Testnet Payment.

## 13. Recommended product specification

### User and job

**User:** a person or small business delegating a narrow, low-value digital
purchase to an AI agent.
**Problem:** useful paid APIs and digital services are easy for an agent to
discover but hard for the principal to trust; a prompt, price, endpoint, or
merchant can change between discovery and settlement.
**Provider:** an x402-compatible digital service with a known pay-to address.
**Paid deliverable:** a deterministic, hashable digital artifact such as a
structured research snapshot, data lookup, image transformation, or report.
**Agent value:** compare options, choose the best eligible one, explain why,
complete the purchase, and return the artifact without giving the agent
unbounded wallet authority.

### Mandate

The user should be able to express one sentence:

> Find a current competitor snapshot from an approved digital research
> service, pay at most 10,000 XRP drops on XRPL Testnet, use only this
> destination, and return the report.

Represent that as structured data:

~~~text
mandate_id
principal_id
agent_id
task
allowed_networks: [xrpl:1]
allowed_assets: [XRP]
max_amount_drops: 10000
rolling_budget_drops: 10000
approved_payees: [rMerchantAddress...]
approved_resource_types: [competitor_snapshot]
expires_at
requires_human_approval_for:
  - new_payee
  - changed_terms
  - amount_above_auto_approve_threshold
policy_version
mandate_hash
~~~

### Quote

Every paid service response should be normalized into:

~~~text
quote_id
invoice_id
merchant_id
resource_url
resource_type
network
asset
issuer_if_issued
pay_to
destination_tag_if_required
amount
max_timeout_seconds
source_tag
terms_hash
quote_hash
observed_at
~~~

The agent may summarize the quote, but the Guard compares the exact structured
fields. A changed amount, payee, asset, invoice, network, expiry, or critical
term must invalidate the earlier decision.

### Decision result

~~~text
decision_id
decision: APPROVE | BLOCK | APPROVAL_REQUIRED | CHALLENGE_REQUIRED
decision_source: local_guard | trustline_sandbox
reason_codes
reason_brief
checks:
  authority
  amount
  cumulative_budget
  network
  asset
  issuer
  payee
  invoice
  expiry
  injection_signal
  evidence_sufficiency
policy_hash
evidence_manifest_hash
expires_at
~~~

The public UI should show a short reason. The detailed evidence view can show
which fields matched and which were redacted, without displaying chain of
thought.

### Payment intent

The payment intent should bind:

- mandate ID and version;
- task/resource reference;
- quote and invoice ID;
- quote hash;
- network and asset/issuer;
- amount;
- exact payTo and destination tag;
- source tag;
- expiry and LastLedgerSequence;
- approval reference;
- nonce/idempotency key.

The signer should refuse a transaction unless the exact signed transaction
matches this intent.

### Receipt

A compact receipt can contain:

~~~text
receipt_id
status: settled_and_fulfilled | blocked | approval_required | exception
task_summary
agent_id
mandate_ref
decision:
  source
  decision
  reason_codes
  policy_version
  decision_timestamp
quote:
  merchant
  resource
  invoice_id
  amount
  asset
  network
  pay_to
settlement:
  tx_hash
  validated_ledger_index
  result_code
  source_tag
fulfilment:
  response_status
  response_hash
  artifact_id
  delivery_timestamp
evidence:
  quote_hash
  mandate_hash
  policy_hash
  trace_reference
~~~

For a blocked attempt, omit settlement fields and explicitly say:

~~~text
No transaction was signed or submitted.
~~~

That single sentence is a high-value safety proof.

## 14. Architecture recommendation

~~~text
┌──────────────────────┐
│ Principal / user      │
│ objective + mandate   │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ Agent orchestrator    │
│ discover / compare /  │
│ summarize / choose    │
└──────────┬───────────┘
           │ exact quote + trace summary
┌──────────▼───────────┐       optional
│ Agent Spend Guard     │◄──────t54 Trustline
│ deterministic policy  │       async adapter
│ budget/payee/expiry   │
└──────────┬───────────┘
           │ approve / challenge / block
┌──────────▼───────────┐
│ x402 client           │
│ invoice binding       │
│ payment requirements  │
└──────────┬───────────┘
           │ payer-signed Payment
┌──────────▼───────────┐       future
│ XRPL signer           │◄──────Open Wallet Standard /
│ Testnet XRP           │       KMS / external signer
└──────────┬───────────┘
           │ signed blob
┌──────────▼───────────┐
│ t54 XRPL facilitator  │
│ verify + settle       │
└──────────┬───────────┘
           │ validated XRPL tx
┌──────────▼───────────┐
│ Merchant resource     │
│ response + artifact   │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ Receipt/evidence      │
│ store + UX timeline   │
└──────────────────────┘

Future fiat/card path:
  approved intent -> Unlimit BaaS adapter -> async webhook -> same receipt
Future credit path:
  approved intent -> ClawCredit / separate underwriting -> x402 service
~~~

### Responsibility boundary

The model can:

- understand the user's objective;
- discover and compare options;
- summarize evidence;
- propose a provider and quote;
- explain a trade-off;
- provide a concise trace summary.

The deterministic control plane must:

- validate mandate, policy version, and expiry;
- enforce amount and cumulative budget;
- enforce network, asset, issuer, payee, resource, and destination;
- bind the invoice and quote hash;
- detect replay and duplicate invoices;
- require approval/challenge on configured conditions;
- protect signing keys;
- reconcile XRPL finality;
- separate settlement from fulfilment;
- produce the receipt.

The LLM must never have a direct unconstrained “send money” tool.

## 15. Exact three-minute demo script

The safest demo has three short runs, all on one work surface.

### 0:00–0:25 — Need and mandate

Show:

> “Get a current competitor snapshot. Use an approved digital research
> service. Max 10,000 drops on XRPL Testnet. Do not use any other destination.”

The agent finds two or three local/x402 service offers and explains its choice
using price, delivery format, freshness, and provider allowlist status.

### 0:25–0:55 — Blocked over-budget case

Select a quote with:

~~~text
amount: 15000 drops
payTo: allowed-looking but not approved
invoiceId: INV-demo-over-budget
network: xrpl:1
~~~

The screen shows:

~~~text
BLOCKED
Amount 15,000 drops exceeds mandate cap 10,000.
The destination is not approved.
No transaction was signed or submitted.
~~~

Do not click an approval button. No XRPL hash should exist for this attempt.
This is the most important “guard” moment.

### 0:55–1:30 — Approval/evidence recovery

Select a safe quote:

~~~text
amount: 8000 drops
network: xrpl:1
asset: XRP
payTo: approved merchant address
invoiceId: INV-demo-allowed
~~~

Make it approval-required because the merchant is new or the trace is thin,
not because the amount is over the hard cap:

~~~text
APPROVAL REQUIRED
Within budget, but first-time payee/evidence gap.
Confirm exact amount, destination, service, invoice, and expiry.
~~~

If Trustline sandbox access exists, show the equivalent Agentic Challenge:
requires_information, required intent_explanation, then
information_submitted and final decision after polling. If it does not,
show the same UX from the local provider and label it “local demo policy.”

### 1:30–2:30 — Real testnet payment

After approval:

1. Parse the exact x402 payment requirements.
2. Create the XRPL Payment using integer drops.
3. Add invoice binding through MemoData or InvoiceID.
4. Set SourceTag and bounded LastLedgerSequence.
5. Preview the destination, amount, asset, invoice, and fee.
6. Sign with the testnet signer.
7. Send the signed payload through the chosen x402 facilitator path.
8. Query XRPL until the transaction is validated with tesSUCCESS.
9. Show the hash and https://testnet.xrpl.org/transactions/<hash>.

Use a local merchant endpoint or a pinned public testnet facilitator with a
fallback. Record the actual hash during rehearsal and never hard-code a fake
hash into the UI.

### 2:30–3:00 — Delivery and receipt

Show the paid digital artifact, its response status, and a compact receipt:

~~~text
FULFILLED
Paid 8,000 drops on XRPL Testnet
Merchant: approved digital research service
Invoice: INV-demo-allowed
Decision: approved after exact-terms review
XRPL: tesSUCCESS + validated hash
Artifact: response hash matches delivered report
~~~

End with:

> “The agent did not receive an unlimited wallet. It received a narrow,
> expiring permission, and every successful or blocked action has a reason.”

## 16. Implementation plan and verification matrix

### Minimum implementation order

1. Build the local merchant endpoint that returns a deterministic x402
   challenge and deliverable.
2. Build the structured mandate and deterministic Guard.
3. Build the blocked and approval UI states.
4. Build XRPL Testnet wallet setup and direct Payment path.
5. Add x402 facilitator verification/settlement.
6. Wait for validated finality and generate the receipt.
7. Add optional Trustline-shaped evidence envelope and provider adapter.
8. Add SourceTag, opaque Memo correlation, and event log.
9. Add optional RLUSD diagnostic and Unlimit/ClawCredit roadmap cards.
10. Run failure tests and rehearse offline/facilitator fallback.

### Negative tests

| Case | Expected result |
| --- | --- |
| Amount > max | block before signing |
| Cumulative spend would exceed budget | block before signing |
| Wrong network ID | reject |
| Wrong asset or RLUSD issuer | reject |
| Payee mismatch | reject or approval-required by policy |
| Destination tag mismatch | reject |
| Invoice replay | reject |
| Quote hash changed | require new decision |
| Missing LastLedgerSequence | reject |
| Partial/cross-currency payment | reject |
| Missing RLUSD trust line | reject with actionable setup reason |
| Trustline unavailable | fail closed or use explicitly labelled local policy |
| Facilitator timeout | reconcile, do not blindly resubmit |
| tes/tec result | show validated result and do not assume payment |
| Payment succeeds, artifact wrong | fulfilment exception, not success |
| Incoming Memo contains instruction | treat as untrusted data |
| Prompt injection changes payee | reject destination change |

### Demo-readiness checklist

- Public repository is reproducible.
- .env and testnet secrets are ignored.
- The actual Testnet transaction was rehearsed at least three times.
- Both blocked and approved states work without network access.
- The final receipt never relies on a fake “success” status.
- The app handles facilitator unavailable and XRPL timeout gracefully.
- The x402 header/version used by the code is documented.
- The transaction hash and explorer link are visible.
- One screenshot or screen recording exists as a fallback, but the live demo
  remains the primary proof.
- Builder feedback is recorded, especially any SDK/facilitator friction.

## 17. Sponsor alignment and language guardrails

### Safe claims

- “Inspired by t54's Trustline model of agent identity, intent, risk, and
  public-safe evidence.”
- “Uses the documented XRPL exact x402 flow and an XRPL Testnet Payment.”
- “The local Guard mirrors the shape of Trustline's async underwriting contract
  when live sponsor credentials are unavailable.”
- “ARS informed the separation between payment settlement and fulfilment.”
- “Unlimit is a future fiat/card/BaaS rail in the production architecture.”
- “ClawCredit is an optional future credit-backed x402 funding mode.”

### Claims to avoid

- “Trustline approved this payment” unless a real Trustline sandbox response is
  captured and named in the receipt.
- “Mastercard certified” or “legal liability protection.”
- “ARS implemented” if only the lifecycle ideas were borrowed.
- “RLUSD payment” without exact issuer, currency code, and trustline proof.
- “Production-ready facilitator” when the docs say a public Testnet route is
  best-effort/no SLA.
- “On-chain proof of fulfilment” when only payment is on-chain and the artifact
  is stored off-chain.
- “ClawCredit automatically repays” while the docs describe manual repayment.
- “Unlimit integration” without actual credentials and a tested sandbox path.

### Best sponsor-facing explanation

~~~text
Ripple gives us a fast, inspectable settlement rail.
t54 gives us the vocabulary and infrastructure for agent identity, intent,
underwriting, evidence, challenge, and x402 risk.
ARS teaches us to distinguish a payment from an outcome.
ClawCredit shows how trust and repayment can become agent capacity over time.
Unlimit is the path from a crypto-native testnet purchase to real fiat,
card, payout, and regulated operating rails.
Agent Spend Guard is the small, usable control layer that makes those pieces
safe enough to compose.
~~~

## 18. Final synthesis and prioritized opportunities

### P0 — must be in the MVP

1. Exact mandate and deterministic pre-sign policy.
2. Hard blocked over-budget state with no hash.
3. Approved destination check.
4. Explicit approval or evidence-recovery state.
5. x402 challenge parsing and invoice binding.
6. XRPL Testnet Payment with validated hash.
7. Separate fulfilment verification.
8. Receipt with public-safe reason and technical detail.
9. Reconciliation and idempotency.

### P1 — high-value technical depth if time allows

1. Trustline-compatible evidence envelope and async adapter.
2. One Agentic Challenge flow with intent explanation and poll state.
3. SourceTag and opaque Memo correlation.
4. quote/policy/mandate hashes.
5. VI/AP2 reference bindings without implementing a full credential issuer.
6. Open Wallet Standard/external signer boundary.
7. One intentional fulfilment failure and exception receipt.

### P2 — roadmap, not demo risk

1. RLUSD with verified XRPL trust lines.
2. ClawCredit funding and repayment.
3. Unlimit fiat/card/bank adapter.
4. ARS fee escrow or provider collateral.
5. Credit escalation based on transaction history.
6. Portfolio/fund-moving workflows and lending protocol integration.

### Decision

The final product should be a calm, narrow, technically real example of
controlled agentic commerce:

~~~text
Agent chooses.
Policy constrains.
Evidence explains.
XRPL settles.
Fulfilment proves value.
Receipt makes it accountable.
~~~

That story is more defensible than adding every sponsor acronym to a generic
wallet. It gives judges a clear reason to care, a visible failure case, a real
ledger artifact, and a credible path toward Trustline, ClawCredit, RLUSD, and
Unlimit integrations.

## 19. Terra final analysis

This is the requested single gpt-5.6 Terra medium synthesis. Terra read this
file and context.md after the three Luna research passes and critically
reviewed the evidence, product recommendation, demo, protocol boundaries, and
source caveats. It did not edit files.

### Terra verdict

Build a narrow deterministic control layer for agentic purchases. The MVP
should prove that an agent can choose and buy one paid digital service on XRPL
Testnet, but cannot exceed a mandate, substitute a payee, reuse an invoice, or
sign without required approval/evidence. This is stronger than a wallet,
generic chatbot, or stack of unproven sponsor integrations.

### Terra's ten highest-value insights

| # | Insight | Evidence class | Winning implication |
| ---: | --- | --- | --- |
| 1 | The challenge requires XRPL and at least one successful XRPL transaction, not every recommended payment or sponsor tool. | Challenge fact | Make a validated XRP Testnet Payment the non-negotiable proof and keep integrations additive. |
| 2 | The challenge values a full commercial loop: discovery, bounded decision, settlement, and useful delivery. | Challenge/sponsor requirement | Show the paid artifact and receipt, not only a transaction hash. |
| 3 | A transaction proves settlement, not authorization, merchant legitimacy, or fulfilment. | Protocol fact/inference | Separate policy decision, XRPL settlement, and fulfilment verification in state and UX. |
| 4 | XRPL's basic Payment is sufficient for the qualifying transaction; XRP avoids issued-token trustline setup. | Protocol fact | Use XRP Testnet for the live MVP and make RLUSD a readiness diagnostic or roadmap item. |
| 5 | The documented XRPL x402 exact scheme binds a payer-signed payment to exact requirements and an invoice. | Protocol fact | Bind amount, asset, network, destination, invoice, expiry, and LastLedgerSequence; reject changed terms. |
| 6 | Trustline's relevant idea is pre-execution underwriting from transaction, agent, and evidence context, not generic fraud scoring. | Documented/sponsor-stated | Shape the local guard like an underwriting adapter and label it local unless a real sandbox decision is shown. |
| 7 | An Agentic Challenge is evidence recovery, not an approval or automatic override. | Documented Trustline behavior | Use it only for recoverable uncertainty; hard policy violations remain blocked. |
| 8 | ARS distinguishes payment settlement from service outcome but is research infrastructure, not an XRPL MVP dependency. | Documented research/inference | Borrow lifecycle and fulfilment-risk framing without claiming ARS implementation, insurance, or collateral. |
| 9 | Ripple's agentic material emphasizes bounded permissions, finality, attribution, and secure wallet handling. | Sponsor/official documentation | The differentiator is a constrained signer boundary; the LLM never gets an unrestricted send-money tool. |
| 10 | ClawCredit and Unlimit are future funding/regulated-rail extensions that introduce custody, onboarding, privacy, and asynchronous operational risk. | Documented/sponsor-stated | Mention them as scale paths, not live dependencies or partnerships. |

### Terra's evidence classification

- **Protocol facts:** XRPL Payment validation, integer XRP drops, issuer-aware
  issued assets, RLUSD trust-line preparation, LastLedgerSequence, public Memo
  safety, and the need to independently validate the result.
- **Documented integration behavior:** t54 facilitator x402 v2 headers and
  exact scheme, Trustline async assessment/polling, final APPROVE/DECLINE, and
  challenge states.
- **Sponsor-stated claims:** Ripple agent-readiness framing; t54 protected
  transaction, agent-count, latency, approval, liability, and product claims;
  ClawCredit counters/score model; Unlimit corridor and product coverage.
- **Observed behavior:** ARS and x402 Secure browser demos showed illustrative
  scenario/product-flow states, not live settlement, underwriting, delivery, or
  production readiness.
- **Inference:** Agent Spend Guard is a useful policy/evidence boundary; XRP
  Testnet is the lowest-risk live path; Trustline-shaped adapters add depth
  without making credentials a blocker; fulfilment receipts strengthen the
  commercial loop.

### Terra's corrections to the draft

| Draft assumption | Correction |
| --- | --- |
| “The facilitator settles payment.” | Say that the payer signs, the selected facilitator may verify/submit, and XRPL validation establishes ledger settlement. |
| Any first-time merchant can be approved. | An approved-but-first-use merchant may require approval; an unapproved payee must remain blocked unless the policy explicitly permits adding it. |
| A challenge can recover any decline. | Only recoverable missing evidence or low-confidence context can be challenged. Budget, expiry, asset, network, and exact-destination violations cannot be overridden. |
| A local provider is Trustline. | Say “Local Spend Guard demo policy, shaped like a Trustline integration.” |
| An XRPL hash proves the service was delivered. | Record payment validation separately from artifact hash, content checks, and fulfilment status. |
| RLUSD automatically improves credibility. | Use XRP first. Show RLUSD only after issuer, currency code, payer/merchant trust lines, reserve, funding, and rehearsal are proven. |
| ClawCredit is an agent wallet. | Describe its documented custodial/proxy credit model and manual repayment maturity. |
| Unlimit is integrated because it appears in the architecture. | Describe it as a designed future adapter unless a real sandbox workflow is shown. |
| x402 headers are stable across all sources. | Pin one implementation and prove its headers in an integration test; do not mix the XRPL v2 facilitator contract with v1-style examples. |
| A self-hosted merchant proves commerce by itself. | The merchant must enforce an unpaid/paid boundary and return a useful, deterministic, independently hashable artifact. |

### Terra's scope decision

**MVP must ship:**

- structured mandate;
- quote normalization;
- deterministic pre-sign checks;
- hard blocked over-budget path;
- approval/evidence-recovery path;
- one x402-style paid digital resource;
- payer-signed XRP Testnet Payment;
- invoice binding;
- validated tesSUCCESS;
- fulfilment verification;
- receipt;
- durable idempotent event log.

**Optional only if proven early:**

- t54 Trustline sandbox adapter;
- a real Agentic Challenge and polling flow;
- the public facilitator route;
- opaque SourceTag/Memo correlation;
- quote/mandate/policy hashes;
- an RLUSD readiness panel.

**Defer:**

- RLUSD as the live path;
- ClawCredit credit and repayment;
- Unlimit sandbox or production flow;
- ARS escrow, collateral, and premiums;
- full AP2/VI credential issuance;
- lending and fund-moving workflows;
- mainnet.

### Terra's strongest three-minute narrative

1. **Problem and mandate:** a research operations lead delegates one narrow
   task: obtain a current competitor snapshot from an approved provider. The
   agent may spend up to 10,000 drops on XRPL Testnet, only with the approved
   destination, before the mandate expires. Show two offers and explain the
   choice using price, freshness, format, and eligibility.
2. **Hard block:** choose a 15,000-drop offer with a changed or unapproved
   destination. Show “Blocked: amount exceeds the 10,000-drop cap. Destination
   is not authorized. No transaction was signed or submitted.” Do not show a
   hash and do not expose an approval button.
3. **Recoverable approval:** choose an 8,000-drop XRP quote from an authorized
   merchant. Make it reviewable because the merchant is first-use or evidence
   is thin, not because it exceeds the cap. Show exact amount, payee, invoice,
   expiry, artifact type, and evidence explanation. If a real Trustline
   sandbox is used, show actual challenge/polling data; otherwise label the
   state Local Spend Guard demo policy.
4. **Real payment:** construct the payer-signed XRPL Testnet Payment with
   integer drops, invoice binding, source tag, and LastLedgerSequence. Submit
   through the selected path, independently wait for validation, and show the
   actual hash, validated result, and explorer link.
5. **Fulfilment/receipt:** reveal the paid snapshot and its response hash.
   Show “Settled and fulfilled,” “validated tesSUCCESS,” and “artifact received
   and hash-verified.”

The closing line should be:

> The agent never received an unlimited wallet. It received an expiring,
> purpose-bound permission, and every blocked or completed purchase is
> explainable.

### Terra's recommended data and state model

The data model should have separate records for:

- Mandate: principal, agent, task, network, assets, amount cap, rolling budget,
  payees, resource types, expiry, approval rules, policy version, hash.
- Quote: invoice, merchant, resource URL/type, network, asset/issuer, payTo,
  tag, amount, timeout, source tag, terms hash, quote hash, observation time.
- Evidence envelope: decision ID, trace summary, source/artifact refs, manifest
  hash, redaction version.
- Decision: source, outcome, reason codes, checks, policy/evidence hashes,
  expiry, approver.
- Payment intent: decision, invoice, quote hash, exact payment fields,
  LastLedgerSequence, nonce, idempotency key, status.
- Settlement: facilitator reference, transaction hash, validated ledger index,
  engine result, validation time, reconciliation status.
- Fulfilment: HTTP status, artifact ID/hash, delivery checks, verification
  time, exception reason.
- Receipt: redacted decision, quote, settlement, fulfilment, and explanation
  references.
- Event: aggregate, event type, actor, idempotency key, previous hash, payload
  hash, timestamp.

The Guard state machine should keep hard failure terminal before signing:

~~~text
DRAFT -> DISCOVERED -> QUOTED
QUOTED -> BLOCKED
QUOTED -> APPROVAL_REQUIRED -> ELIGIBLE
QUOTED -> EVIDENCE_REQUIRED -> EVIDENCE_SUBMITTED -> ELIGIBLE | BLOCKED
ELIGIBLE -> PAYMENT_INTENT_CREATED -> AUTHORIZED -> SIGNED -> SUBMITTED
SUBMITTED -> SETTLED | SETTLEMENT_FAILED | RECONCILIATION_REQUIRED
SETTLED -> FULFILMENT_VERIFIED | FULFILMENT_EXCEPTION
FULFILMENT_VERIFIED -> RECEIPT_ISSUED
~~~

Hard failures—expired mandate, cap exceeded, cumulative budget exceeded,
asset/network/payee mismatch, quote mutation, invoice replay, missing expiry,
or unauthorized destination—must never reach SIGNED.

### Terra's signer boundary

~~~text
LLM/agent:
  discover, compare, summarize, propose
Guard:
  normalize, enforce exact policy, reserve budget, create immutable intent,
  request approval, authorize signer
Signer:
  sign only an unexpired transaction matching the intent
Settlement worker:
  submit once and reconcile; never blindly resubmit
Merchant:
  gate artifact delivery on valid payment and return a verifiable artifact
Receipt service:
  expose redacted decision and outcome evidence
~~~

The model must not hold seeds, private keys, unrestricted wallet RPC access, a
raw signing method, or authority to modify mandates. Production should use
KMS/HSM or an external signer. The hackathon can use an ignored Testnet secret,
but it must never enter prompts, logs, screenshots, traces, or the repository.

### Terra's integration recommendation

Normalize one x402 implementation before building UI. Compute a canonical quote
hash, validate the mandate and exact requirements, create an immutable intent,
reserve budget, and only then construct the XRPL Payment. Use integer XRP
drops, invoice binding, SourceTag, and bounded LastLedgerSequence. Submit once,
query XRPL until validated, and transition to SETTLED only on tesSUCCESS.
Consume the invoice exactly once. On timeout, reconcile hash, sequence, and
ledger state before retrying.

Use:

~~~text
RiskProvider.assess(paymentIntent, evidenceEnvelope)
  -> APPROVED | BLOCKED | EVIDENCE_REQUIRED | PROVIDER_UNAVAILABLE
~~~

The local provider is the live default. The Trustline adapter is optional and
must report the actual provider/environment. An outage must fail closed for
provider-dependent actions; it must not silently become an approval.

### Terra's final sponsor language

~~~text
Ripple gives us a fast, inspectable settlement rail.
t54 gives us the vocabulary and infrastructure for agent identity, intent,
underwriting, evidence, challenge, and x402 risk.
ARS teaches us to distinguish a payment from an outcome.
ClawCredit shows how trust and repayment can become agent capacity over time.
Unlimit is a future path from a crypto-native testnet purchase to fiat, card,
payout, and regulated operating rails.
Agent Spend Guard is the small control layer that makes those pieces safe to
compose.
~~~

Terra's final verdict is therefore the same as the document's product
decision: show one real, bounded, useful purchase; make the block visibly
stronger than the happy path; use evidence and receipt design to communicate
trust; and keep every sponsor integration honest about its current maturity.

## 20. Source index

### Challenge and local context

- [SingHacks Ripple repository](https://github.com/Singhacks-2026/ripple)
- [challenge README](https://github.com/Singhacks-2026/ripple/blob/main/README.md)
- [challenge resources](https://github.com/Singhacks-2026/ripple/blob/main/resources.md)
- [Open Wallet Standard](https://github.com/open-wallet-standard/core)

### Ripple and XRPL

- [Stablecoin payment checklist](https://ripple.com/insights/fintech-checklist-stablecoin-payments-journey/)
- [XRPL AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/)
- [XRPL lending](https://ripple.com/insights/the-xrpl-lending-protocol-bringing-credit-infrastructure-onchain/)
- [UDAX Brazil](https://ripple.com/insights/ripple-launches-university-digital-asset-xcelerator-udax-in-brazil/)
- [XRPL agentic transactions](https://xrpl.org/docs/agents/agentic-transactions)
- [XRPL agentic x402](https://xrpl.org/docs/agents/agentic-payments-x402)
- [XRPL agent wallet skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill)
- [XRPL payments skill](https://xrpl.org/docs/agents/xrpl-payments-skill)
- [track agent behavior](https://xrpl.org/docs/agents/track-agent-behavior)
- [XRPL trust lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
- [RLUSD on XRPL](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
- [XRPL Testnet faucets](https://xrpl.org/resources/dev-tools/xrp-faucets)

### t54

- [t54 ARS page](https://www.t54.ai/ars)
- [ARS repository](https://github.com/t54-labs/AgenticRiskStandard)
- [ARS protocol landscape](https://github.com/t54-labs/AgenticRiskStandard/blob/main/docs/protocol-landscape.md)
- [Trustline](https://www.t54.ai/trustline)
- [Trustline docs](https://www.t54.ai/docs/trustline/overview)
- [Async underwriting](https://www.t54.ai/docs/trustline/async-underwriting)
- [Agentic Challenge](https://www.t54.ai/docs/trustline/agentic-challenge)
- [Webhooks and Monitoring](https://www.t54.ai/docs/trustline/webhooks-and-monitoring)
- [Compliance and Audit](https://www.t54.ai/docs/trustline/compliance-audit)
- [Risk Engine](https://www.t54.ai/docs/trustline/risk-engine)
- [x402 Secure](https://www.t54.ai/x402-secure)
- [x402 Secure repository](https://github.com/t54-labs/x402-secure)
- [x402 XRPL facilitator](https://xrpl-x402.t54.ai/)
- [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
- [Verifiable Intent](https://xrpl-x402.t54.ai/docs/verifiable-intent)
- [ClawCredit](https://claw.credit/)
- [ClawCredit docs](https://www.claw.credit/docs/overview)
- [ClawCredit payments](https://www.claw.credit/docs/payments)
- [ClawCredit repayment](https://www.claw.credit/docs/repayment)
- [ClawCredit score](https://www.claw.credit/docs/credit-score)

### Unlimit

- [Unlimit BaaS payments](https://www.baas.unlimit.com/payments/)
- [Unlimit BaaS use cases](https://www.baas.unlimit.com/use-cases/)
- [Unlimit BaaS developer portal](https://www.baas.unlimit.com/dev-portal/)
- [UNL BaaS API introduction](https://ubc-dev.unlimint.com/docs/ubc-api/3bg1xs8j9k2gz-introduction)
- [UNL BaaS API overview](https://ubc-dev.unlimint.com/docs/ubc-api/q9fuvilnmb4oz-unl-baa-s-api)
- [UNL BaaS webhooks](https://ubc-dev.unlimint.com/docs/ubc-api/rhjnczrxhku8x-list-of-available-webhooks)

## 21. Research limitations

- Sponsor websites can change, and several pages contain future-dated or
  sponsor-reported metrics. Reconfirm dates, counters, availability, and
  product status.
- Hosted x402 facilitator behavior and header versions may change. Pin and
  test the SDK.
- No live Trustline, ClawCredit, or Unlimit credentials were used.
- No real purchase was made and no external funds were moved.
- No claim here substitutes for legal, compliance, security, or financial
  review.
- Testnet XRP and Testnet RLUSD have no financial value and do not prove
  mainnet operational readiness.
