# FleetCredit — Autonomous Build Goal and Verification Contract

**Hackathon context:** SingHacks 2026, Ripple/XRPL track

**Product:** FleetCredit

**Working pitch:** *A fleet vehicle with no payment history can earn just enough credit to buy the energy it needs to finish its job.*

**Primary user:** Amira, a SwiftMed fleet operations lead in Singapore

**Primary machine actor:** SwiftMed vehicle V-204, newly provisioned with no charger account, prepaid balance, or repayment history

**Document role:** This is the authoritative implementation goal for a coding agent working in repeated autonomous loops. It is simultaneously the product contract, technical specification, backend contract, UI brief, test plan, demo script, and definition of done.

**Selected design direction:** **Prompt 4 — Tactical Signal Grid**, adapted from `archive/website-template/observability-design-prompts.md` into a mission-control workspace. Do not substitute a different template or merge visual motifs from the other supplied directions.

**Required outcome:** a polished, locally runnable, resettable full-stack prototype with a real backend and a deterministic no-credential demo mode. Optional live LLM, XRPL Testnet, and sponsor integrations must sit behind honest adapters and must never be required to understand the core demo.

---

## 0. How to use this goal

Build, run, inspect, and verify FleetCredit. Keep iterating until every mandatory requirement has current evidence. Do not stop at a static dashboard, a convincing animation, a frontend whose buttons only mutate local component state, a mocked API hidden behind a “live” label, or an LLM response that directly authorizes spending.

Requirement words have precise meanings:

- **MUST**: mandatory for completion.
- **MUST NOT**: prohibited.
- **SHOULD**: expected unless a repository constraint makes it unreasonable; document any deviation.
- **MAY**: optional enhancement only after all MUST items pass.

The implementation agent MUST:

1. Inspect the repository, current branch, working tree, package manager, existing assets, instructions, and neighboring prototype conventions before editing.
2. Read every applicable `AGENTS.md` and preserve all unrelated user changes.
3. Invoke the installed `frontend-design` and `frontend-design-premium` skills before substantial UI work when they are available.
4. Create and maintain `DESIGN.md`, `UX-CONTRACT.md`, `.env.example`, `README.md`, `ARCHITECTURE.md`, and `VERIFICATION.md` in this prototype unless an inspected convention supplies equivalent files.
5. Establish one runtime token owner and map the durable design tokens in `DESIGN.md` to it; do not scatter hard-coded colors and spacing through components.
6. Build the smallest working vertical slice early: load mission → compare offers → block unsafe quote → request bounded credit → purchase authorization → charge → restore mission viability → show receipt.
7. Make all visible controls functional against shared application/domain state.
8. Use a server-owned state machine. The browser must not manufacture approvals, settlements, or receipt evidence.
9. Run tests after each milestone and conduct real-browser verification at desktop and 390 px mobile widths.
10. Clearly distinguish `FIXTURE DEMO`, `LIVE LLM`, `RECORDED TESTNET`, and `LIVE · XRPL TESTNET` evidence.
11. Never describe synthetic underwriting, fixture settlement, a submitted transaction, or an explorer-shaped URL as live or validated.
12. Continue looping until the strict definition of done in §24 is satisfied.

If an external integration is unavailable, retain its adapter seam, expose its actual availability, and continue through a deterministic fixture. External downtime is not permission to create false evidence.

---

## 1. Mission and product thesis

Build one focused experience in which SwiftMed vehicle V-204 is carrying a temperature-sensitive package to NUS Hospital. Its battery falls to 8%. It cannot reach the destination with the mandated 10 km safety reserve. The vehicle agent must evaluate charging offers in the context of deadline, detour, queue, charging speed, connector, price, penalties, merchant trust, and the operator’s mandate.

The cheapest charger must fail the mission deadline. A seemingly attractive quote must be blocked when its final terms exceed the occupancy-fee mandate and its payment destination no longer matches the approved operator. The best eligible charger costs S$7.40, while V-204 has S$0.00 operating balance. FleetCredit must underwrite one narrow, short-lived mission-credit authorization based on verified fleet ownership, a real dispatch, energy necessity, merchant approval, proportional amount, and time-bounded purpose. It then purchases a specific charging authorization and simulates the physical fulfilment from reservation through charging.

The user-visible transformation is:

```text
8% battery + impossible mission + S$0 balance
  → agent compares economic actions
  → unsafe final quote is deterministically blocked
  → S$8 mission credit approved for one merchant and one purpose
  → S$7.40 charging authorization purchased
  → charger reserved, vehicle connected, 8 kWh delivered
  → battery reaches 23%
  → predicted arrival changes from impossible to 7:09 PM
  → mission remains on schedule with the required reserve
```

### Product promise

> FleetCredit does not give machines unrestricted wallets. It gives them bounded economic capacity when a verified mission justifies it.

### What makes this an agent product

The product is not a charger finder. The agent selects an economic action under competing time, energy, safety, trust, and cost constraints; adapts when final terms change; and explains why the selected option is the cheapest eligible action that preserves the mission SLA.

### What makes this more than an AI narrative

Deterministic services—not the model—verify arithmetic, policy, credit bounds, quote integrity, merchant destination, idempotency, signing payload, settlement finality, delivered energy, and mission outcome. The model may propose and explain. It may never approve its own credit or sign its own transaction.

---

## 2. Self-explaining demo gate

Opening `/demo` or `/` MUST immediately show a populated SwiftMed scenario. There is no authentication wall, setup wizard, blank map, wallet-connect prerequisite, or need for presenter narration.

Within ten seconds, the first viewport must make these facts legible:

1. **Person and operator:** Amira is monitoring a time-sensitive SwiftMed medical delivery.
2. **Machine:** V-204 is newly provisioned and has no payment history or charger account.
3. **Problem:** battery is 8%; the mission cannot finish with the required reserve.
4. **Authority:** the vehicle may spend or borrow at most S$12 for necessary energy, from approved operators, with occupancy fees no higher than S$0.20/min.
5. **Decision:** the agent is comparing mission outcomes, not merely distance or sticker price.
6. **Economic need:** the selected charger costs S$7.40 and the vehicle balance is S$0.
7. **Outcome:** one narrow credit authorization enables 8 kWh, restores the route, and leaves an inspectable receipt.

The initial viewport MUST contain:

- a plain-language headline such as **“V-204 cannot finish Dispatch MED-4182 on its current charge”**;
- a mode badge (`FIXTURE DEMO`, `LIVE LLM`, `RECORDED TESTNET`, or `LIVE · XRPL TESTNET`);
- mission deadline, current battery, remaining range, destination distance, and required reserve;
- one dominant **Run guided mission** action;
- a small “Why this needs an agent” disclosure;
- a compact mandate summary;
- no crypto-first hero language.

### Guided demo phases

The guided action MUST drive the same server-owned domain state as manual controls:

```text
Threat detected
  → Compare offers
  → Quote changed / blocked
  → Select VoltFast
  → Request mission credit
  → Credit approved
  → Purchase authorization
  → Reserve / connect / charge
  → Mission restored
  → Receipt
```

Provide a persistent phase rail with these user-facing labels:

- **Mission risk**
- **Compare**
- **Safety check**
- **Credit**
- **Purchase**
- **Charge**
- **On schedule**

The rail MUST show completed, current, upcoming, blocked, and failed semantics with icons/text, not color alone. It MUST provide **Next step**, **Back**, **Replay mission**, and **Reset scenario**. Reduced-motion mode changes state without animated travel or forced delays.

### Rehearsal modes

`FIXTURE DEMO` MUST run end to end from a clean checkout without network, wallet seed, or LLM key. All fixture decisions and payments must say fixture/local.

`LIVE LLM` MAY use OpenAI or Groq for candidate explanation and narrative summaries, but deterministic selection and safeguards remain authoritative.

`RECORDED TESTNET` MAY replay a real previously validated transaction as immutable evidence. Keep its actual hash, timestamp, ledger index, destination, and result; never call it a fresh live run.

`LIVE · XRPL TESTNET` MUST use a server-side signer and independently reconcile `validated: true` and `tesSUCCESS` before displaying settlement success.

---

## 3. Persona, scenario, and mandate

### 3.1 Primary operator: Amira Rahman

- Fleet operations lead for SwiftMed in Singapore.
- Supervises medical delivery exceptions, not wallets or blockchain infrastructure.
- Needs to understand why a vehicle is spending, what it is allowed to do, and whether a delivery remains safe.
- Uses a laptop operations console, sometimes checks alerts on mobile.
- Values concise causal evidence, predictable controls, and clear recovery paths.

### 3.2 Machine actor: V-204

- Newly provisioned electric delivery vehicle.
- Fleet identity is verified; payment and repayment history are empty.
- Connector: CCS2.
- Initial battery: 8%.
- Estimated remaining range: 21 km.
- Destination distance: 28 km.
- Required post-arrival reserve: 10 km.
- Current mission is Dispatch `MED-4182`.
- Carries a temperature-sensitive parcel.
- Has no prepaid wallet balance and no bilateral charger account.

### 3.3 Mission

- Origin: one deterministic Singapore demo coordinate.
- Destination: NUS Hospital demo destination.
- Required arrival: 7:15 PM Asia/Singapore.
- Initial status: `AT_RISK`.
- Required energy purchase: 8 kWh.
- Successful predicted arrival after charging: 7:09 PM.
- Successful projected battery: 23%.
- Successful projected reserve: at least 10 km.

### 3.4 Standing mandate

Display and enforce this mandate:

> Complete assigned deliveries while maintaining at least 10 km reserve. You may spend or borrow up to S$12 for energy when necessary to meet a confirmed mission. Use approved charging operators only. Never accept occupancy fees above S$0.20/min. Authorization expires after 20 minutes and is valid only for the active vehicle, dispatch, charger, and quote.

The mandate MUST be parsed into deterministic fields:

```ts
type MissionMandate = {
  mandateId: string;
  version: number;
  fleetId: 'swiftmed';
  vehicleId: 'V-204';
  dispatchId: 'MED-4182';
  purpose: 'MISSION_ENERGY';
  maxSpendSgdCents: 1200;
  maxBorrowSgdCents: 1200;
  minReserveKm: 10;
  maxOccupancyFeeSgdCentsPerMinute: 20;
  allowedOperatorIds: string[];
  allowedConnector: 'CCS2';
  expiresAt: string;
};
```

Model prose is never a substitute for these fields.

---

## 4. Product hypotheses and falsifiable tests

### H1 — Agent necessity

The agent must rank genuinely different offers under mission constraints and adapt after a final quote changes.

**Pass:** the visible recommendation changes if queue, price, deadline, reserve, or policy changes; the explanation is derived from scored facts.

**Fail:** VoltFast is always selected by a hard-coded UI branch regardless of inputs.

### H2 — Bounded authority

The model cannot exceed amount, purpose, merchant, vehicle, dispatch, quote, expiry, or fee constraints.

**Pass:** tampering and changed-quote tests are rejected before signing; the blocked UI proves no payment intent was signed or submitted.

**Fail:** model output can directly construct or mutate the transaction.

### H3 — Contextual cold-start credit

A machine with no repayment history can receive conservative capacity because fleet identity, mission, energy need, amount, and counterparty are verifiable.

**Pass:** removing any critical evidence can deny or reduce the authorization; the reason codes remain deterministic.

**Fail:** a fixture always returns “approved” without evaluating evidence.

### H4 — Payment unlocks a specific service

Settlement purchases one charger authorization, not a generic balance.

**Pass:** the reservation endpoint rejects unpaid/incorrect/replayed invoices and returns a charger token only after valid settlement evidence.

**Fail:** charging starts because the frontend advances a timer.

### H5 — Physical outcome is verified separately

Payment, reservation, connection, energy delivery, and mission restoration are distinct facts.

**Pass:** support `SETTLED → FULFILMENT_EXCEPTION`; delivered kWh and route recalculation are separately recorded.

**Fail:** “paid” automatically means “charged” or “mission complete.”

### H6 — The product explains itself without hidden chain-of-thought

Show inputs, calculations, reason codes, compact rationale, and event evidence. Never request or expose private chain-of-thought.

---

## 5. Scope

### 5.1 Mandatory MVP

- One populated SwiftMed mission.
- Three charger offers with real differences.
- Server-side mission viability calculation.
- Server-side quote comparison and deterministic policy evaluation.
- Changed-quote and merchant-destination block.
- Server-side cold-start credit decision with reason codes.
- A one-time, quote-bound payment intent.
- Fixture payment rail that is clearly labelled.
- Protected reservation/charge authorization resource.
- Charger fulfilment simulation driven by backend events.
- Mission recalculation after energy delivery.
- Receipt connecting mandate, evaluation, credit, payment, fulfilment, and outcome.
- OpenAI-compatible provider interface supporting both OpenAI and Groq.
- Deterministic no-key LLM fixture.
- Persistent state for the current run; SQLite is preferred, JSON-file persistence is acceptable only if atomic and tested.
- Real frontend-to-backend requests; no primary flow implemented only in React state.
- Desktop and 390 px mobile experience.
- Automated unit, integration, E2E, and accessibility tests.

### 5.2 Strongly desired after mandatory completion

- Live XRPL Testnet payment and recorded-testnet evidence import.
- Optional t54/Trustline risk adapter if current credentials and docs permit an honest integration.
- Optional ClawCredit adapter if the available product actually supports this physical-service use case; otherwise keep it disabled and documented as conceptual.
- A second failure fixture for charger offline after settlement.
- One small “capacity after repayment” epilogue, clearly future-facing.

### 5.3 Explicitly out of scope

- Fleet-wide administration dashboards.
- User management, SSO, billing, subscriptions, or production KYC.
- Real vehicle telematics or charger hardware.
- Live navigation, traffic, or map tiles.
- A production credit product, interest calculation, debt collection, or financial advice.
- Mainnet funds.
- A chatbot-first layout.
- A generic crypto wallet screen.
- Dozens of chargers or a fake marketplace.
- Claims that fixture underwriting is a real credit decision.

---

## 6. Technology and runnable-backend contract

### 6.1 Inspect-first stack rule

If the folder is empty, prefer this intentionally small stack unless repository conventions clearly favor another:

- Node.js 20+
- TypeScript in strict mode
- React + Vite frontend
- Fastify or Express backend; prefer Fastify for typed schemas if starting fresh
- Zod for runtime schemas
- SQLite through a maintained library, with migrations committed
- Vitest for unit/integration tests
- Playwright for E2E and browser screenshots
- `@axe-core/playwright` for automated accessibility checks
- `openai` JavaScript SDK behind a custom compatibility adapter
- `xrpl` only in the optional server-side XRPL adapter

Do not add a large framework, auth stack, map SDK, agent framework, vector database, or UI component library unless it materially reduces verified work.

### 6.2 One-command development

The final project MUST provide:

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` must launch frontend and backend, print both URLs, and select `FIXTURE DEMO` when no keys are present. Also provide:

```bash
npm run build
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run verify
```

### 6.3 Environment variables

Use server-only secrets and document every variable:

```dotenv
APP_MODE=fixture
PORT=8787
PUBLIC_APP_URL=http://localhost:5173
DATABASE_URL=file:./data/fleetcredit.db

LLM_PROVIDER=fixture
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
LLM_TIMEOUT_MS=20000

XRPL_MODE=fixture
XRPL_NETWORK=testnet
XRPL_RPC_URL=wss://s.altnet.rippletest.net:51233
XRPL_PAYER_SEED=
XRPL_CHARGER_DESTINATION=
```

Support provider aliases for convenience, but normalize them at startup:

- OpenAI: `OPENAI_API_KEY`, default base URL from the SDK.
- Groq: `GROQ_API_KEY`, base URL `https://api.groq.com/openai/v1`.
- Explicit generic: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.

Never expose keys through Vite-prefixed variables, API responses, logs, receipts, source maps, or browser storage.

---

## 7. Logical architecture

```text
React mission workspace
  │ REST + SSE
  ▼
FleetCredit API
  ├─ ScenarioService
  ├─ MissionEngine
  ├─ OfferDiscoveryService
  ├─ DecisionAgent
  ├─ QuoteVerifier
  ├─ MandateGuard
  ├─ CreditUnderwriter
  ├─ PaymentIntentService
  ├─ LedgerAdapter (fixture | recorded | xrpl-testnet)
  ├─ ChargerProviderAdapter (fixture provider)
  ├─ FulfilmentEvaluator
  ├─ ReceiptService
  ├─ LlmProvider (fixture | openai-compatible)
  └─ EventStore / SQLite
```

### Required boundaries

#### `MissionEngine`

Pure deterministic functions for remaining range, energy need, arrival estimate, reserve, deadline outcome, and post-charge mission viability.

#### `DecisionAgent`

May use the LLM to summarize tradeoffs or propose an ordering. Its output is schema-validated and treated as untrusted advice. Final eligibility and deterministic score are computed outside the model.

#### `QuoteVerifier`

Compares discovered quote and final quote. Detects amount, operator, destination, resource, connector, occupancy-fee, expiry, and quote-hash changes.

#### `MandateGuard`

Returns structured allow/deny reason codes. It must run immediately before credit authorization and immediately before signing.

#### `CreditUnderwriter`

Evaluates cold-start context and returns `APPROVED`, `DENIED`, or `REVIEW_REQUIRED`. It does not call the signer.

#### `LedgerAdapter`

Fixture and live adapters return the same typed settlement shape. Only the live adapter may set `evidenceMode: 'live-testnet'`.

#### `ChargerProviderAdapter`

Implements quote, payment challenge, reservation, connect, and metered-energy events. The default provider is local but runs behind HTTP/service boundaries like a real merchant.

#### `EventStore`

Every significant transition has event ID, aggregate version, timestamp, actor, reason code, mode, and previous-event hash. Hash chaining is desirable and should be added if it does not delay the vertical slice.

---

## 8. Domain records

Define schemas first and share generated/inferred TypeScript types between server and frontend.

### `Mission`

```ts
type Mission = {
  missionId: 'MED-4182';
  fleetId: 'swiftmed';
  vehicleId: 'V-204';
  cargoClass: 'TEMPERATURE_SENSITIVE_MEDICAL';
  destinationLabel: 'NUS Hospital';
  deadlineAt: string;
  timezone: 'Asia/Singapore';
  distanceRemainingKm: number;
  requiredReserveKm: number;
  predictedArrivalAt: string | null;
  status: 'ON_TRACK' | 'AT_RISK' | 'IMPOSSIBLE' | 'RESTORED' | 'FAILED';
};
```

### `VehicleState`

Include battery percentage, usable capacity, average consumption, remaining range, connector, balance, telemetry freshness, and source mode.

### `ChargerOffer`

Include operator identity, charger ID, connector, detour minutes/km, queue minutes, power kW, energy offered, base price, occupancy fee, destination account, trust state, quote expiry, resource ID, and canonical quote hash.

### `OfferAssessment`

Include arrival projection, reserve projection, eligible boolean, hard-failure reasons, total expected cost, uncertainty flags, normalized score components, and compact explanation.

### `CreditRequest`

Include exact requested amount, maximum capacity, mission/vehicle/quote binding, evidence references, expiration, idempotency key, and model provenance if an LLM supplied non-authoritative rationale.

### `CreditDecision`

Include status, approved amount, reason codes, evidence snapshot hash, exposure cap, merchant restriction, purpose restriction, expiry, decision engine version, and `simulated: boolean`.

### `PaymentIntent`

Include invoice ID, quote hash, mandate hash/version, credit authorization ID, payer/destination, display amount in SGD cents, testnet amount in drops when applicable, resource ID, expiry, idempotency key, and state.

### `Settlement`

Include mode, transaction hash, submitted timestamp, validated timestamp, ledger index, engine result, delivered amount, destination, invoice binding, and reconciliation status.

### `ChargeSession`

Include reservation token, charger, lifecycle status, connected timestamp, delivered kWh, initial/final battery, stop reason, and fulfilment state.

### `MissionReceipt`

Include the mandate snapshot, offer assessments, blocked quote evidence, credit decision, settlement, charge fulfilment, mission before/after, limitations, and public/private field classification.

---

## 9. State machines and invariants

### 9.1 Scenario state

```text
READY
  → RISK_DETECTED
  → OFFERS_DISCOVERED
  → OFFERS_EVALUATED
  → UNSAFE_QUOTE_BLOCKED
  → OFFER_SELECTED
  → CREDIT_REQUESTED
  → CREDIT_APPROVED
  → PAYMENT_AUTHORIZED
  → PAYMENT_SUBMITTED
  → PAYMENT_SETTLED
  → RESERVED
  → CONNECTED
  → CHARGING
  → ENERGY_DELIVERED
  → MISSION_RESTORED
  → RECEIPT_READY
```

Failure branches MUST include:

- `QUOTE_REJECTED`
- `CREDIT_DENIED`
- `PAYMENT_REJECTED`
- `PAYMENT_UNKNOWN`
- `SETTLED_FULFILMENT_EXCEPTION`
- `CHARGER_UNAVAILABLE`
- `MISSION_FAILED`
- `CANCELLED`

### 9.2 Invariants

1. No credit request without a verified active mission and selected eligible quote.
2. No approval above the lesser of requested amount, mandate cap, and conservative cold-start capacity.
3. No payment intent without an unexpired approval and exact quote/mandate bindings.
4. No signing when final quote hash differs from the authorized quote hash.
5. No signing when destination differs from the approved operator destination.
6. No two successful settlements for one invoice or idempotency key.
7. No reservation before settlement reconciliation.
8. Settlement success does not imply reservation or energy delivery.
9. Mission restoration requires independently measured fixture telemetry for delivered energy plus a fresh deterministic recalculation.
10. Reset may delete fixture runs but must never alter recorded/live transaction evidence.

---

## 10. Seeded offers and deterministic calculations

The exact fixture must be credible and resettable.

### Charger A — ChargeNow Central

- 2-minute detour.
- S$4.20 base quote.
- 17-minute predicted queue.
- Compatible CCS2.
- Final projected arrival: 7:24 PM.
- Deterministic result: `INELIGIBLE_MISSES_DEADLINE`.
- UI explanation: **“Cheapest, but the queue makes the delivery late.”**

### Charger B — VoltFast SG-1042

- 5-minute detour.
- S$7.40 for 8 kWh authorization.
- No queue.
- 150 kW.
- Approved operator and matching destination.
- Occupancy fee at or below the mandate.
- Final projected arrival: 7:09 PM.
- Deterministic result: `ELIGIBLE_SELECTED`.
- UI explanation: **“Cheapest eligible option that preserves the deadline and reserve.”**

### Charger C — RapidPlug

- 3-minute detour.
- Initial price S$5.90.
- Initially appears eligible.
- Final quote changes occupancy fee to S$0.45/min.
- Final payment destination differs from the registered operator.
- Deterministic result: `BLOCKED_TERMS_CHANGED` and `BLOCKED_DESTINATION_MISMATCH`.
- UI explanation: **“Final terms exceed the mandate and the payee no longer matches the approved operator. No money moved.”**

### Mission arithmetic

Implement calculations in named pure functions and test boundary values. Document units. At minimum:

```text
availableRangeKm = batteryKwhAvailable / averageKwhPerKm
requiredRangeKm = routeDistanceKm + requiredReserveKm
energyDeficitKwh = max(0, (requiredRangeKm × averageKwhPerKm) - batteryKwhAvailable)
chargeMinutes = min(providerEstimate, energyRequestedKwh / effectiveChargeKw × 60 + overhead)
arrivalAt = now + detour + queue + charge + onwardTravel
missionEligible = connectorMatches
  && operatorApproved
  && finalQuoteValid
  && projectedReserveKm >= mandate.minReserveKm
  && arrivalAt <= deadlineAt
```

Do not imply automotive-grade precision. Label all values “demo estimates” and show telemetry freshness.

### Offer score

Hard constraints eliminate offers before scoring. Among eligible offers, use a documented deterministic score such as:

```text
score =
  0.40 × normalizedArrivalMargin
  + 0.20 × normalizedReserveMargin
  + 0.15 × normalizedTrust
  + 0.15 × normalizedCostEfficiency
  + 0.10 × normalizedQuoteStability
```

The model may write a short rationale from these components but may not change eligibility or score inputs.

---

## 11. Cold-start underwriting simulation

This is a contextual policy simulation, not a real lending decision. The UI and README MUST say so.

### Evidence signals

- Verified fleet identity.
- Vehicle enrolled in fleet registry.
- Active dispatch with freshness and status.
- Telemetry proves energy need.
- Amount is proportional to energy required.
- Selected merchant is approved.
- Quote is unexpired and payee-bound.
- Purpose is energy only.
- Exposure is at or below S$12.
- Authorization expires after 20 minutes.
- No repayment history; apply conservative initial capacity.

### Deterministic decision

For the primary fixture:

```text
INITIAL CREDIT APPROVED — S$8.00
Requested: S$7.40
Reason: verified fleet + active mission + necessary energy + approved merchant
Maximum exposure: S$8.00
Valid for: 20 minutes
Merchant: VoltFast SG-1042 only
Purpose: 8 kWh mission-energy authorization only
```

Reason codes MUST be machine-readable. Include negative tests for unverified fleet, stale telemetry, inactive dispatch, amount above cap, unapproved merchant, mismatched quote, expired request, and irrelevant purchase purpose.

The UI must not show an invented probabilistic “credit score.” Show evidence checks and resulting capacity.

---

## 12. LLM compatibility and agent contract

### 12.1 Common provider interface

Implement one server-side interface:

```ts
interface LlmProvider {
  generateStructured<T>(input: {
    operation: 'explain_offer' | 'summarize_decision' | 'summarize_receipt';
    system: string;
    prompt: string;
    schema: unknown;
    signal?: AbortSignal;
  }): Promise<{ value: T; model: string; provider: string; usage?: unknown }>;
}
```

Use an OpenAI-compatible API seam and the official OpenAI JavaScript SDK or a small standards-compliant HTTP client. Support:

- OpenAI with its normal base URL and model set by environment.
- Groq with `https://api.groq.com/openai/v1` and model set by environment.
- Generic compatible endpoint through explicit base URL.
- Fixture provider with deterministic outputs.

Prefer the common Chat Completions subset for portability unless the current SDK and both configured providers have been integration-tested with Responses. Do not use provider-hosted search/tools in the mandatory path.

### 12.2 Structured output discipline

- Request JSON Schema structured output when the selected model supports it.
- Validate every response with Zod.
- If strict schema is unavailable, request JSON, validate, and allow at most one bounded repair attempt.
- On invalid output or timeout, fall back to deterministic templated explanations derived from reason codes.
- Record provider/model and latency, not raw secrets or hidden reasoning.
- Treat all model strings as untrusted display content and escape them normally.

### 12.3 Model may

- Rephrase deterministic tradeoffs in plain language.
- Summarize why an eligible offer is preferred.
- Produce a concise receipt narrative from supplied facts.
- Suggest which visible evidence to highlight.

### 12.4 Model must not

- Change route arithmetic or telemetry.
- Declare a merchant approved.
- Approve credit.
- Change a mandate.
- Construct arbitrary payment fields.
- Receive wallet seeds.
- mark a transaction validated.
- Trigger charging without deterministic state authorization.
- Generate facts not present in supplied records.

---

## 13. API contract

Use versioned JSON routes and shared schemas. Suggested minimum:

```text
GET    /api/health
GET    /api/v1/config/public
GET    /api/v1/scenarios/swiftmed
POST   /api/v1/scenarios/swiftmed/reset
POST   /api/v1/scenarios/swiftmed/step
GET    /api/v1/runs/:runId
GET    /api/v1/runs/:runId/events
GET    /api/v1/runs/:runId/stream
POST   /api/v1/runs/:runId/discover
POST   /api/v1/runs/:runId/evaluate
POST   /api/v1/runs/:runId/select
POST   /api/v1/runs/:runId/quotes/:quoteId/finalize
POST   /api/v1/runs/:runId/credit-requests
POST   /api/v1/runs/:runId/payment-intents
POST   /api/v1/runs/:runId/payments
GET    /api/v1/runs/:runId/payments/:paymentId
POST   /api/v1/runs/:runId/reservations
POST   /api/v1/runs/:runId/charge-sessions/:id/advance
GET    /api/v1/runs/:runId/receipt
```

Mutation requirements:

- accept `Idempotency-Key`;
- return current aggregate version;
- reject stale `If-Match`/version with a recoverable conflict;
- use explicit error codes and safe messages;
- never return secrets or private signing material;
- preserve stable response shapes across fixture/live adapters.

SSE events SHOULD include `id`, `event`, and JSON `data`, support reconnect through `Last-Event-ID`, heartbeat comments, and terminal event types. Client cancellation must stop UI consumption without corrupting server state.

---

## 14. Payment and protected-resource flow

### Fixture rail

The local merchant exposes a quote and one protected reservation resource. Before settlement it returns a payment-required challenge or equivalent typed application response. After the fixture ledger accepts the exact invoice, it returns a single-use reservation token.

### Live Testnet rail

If implemented:

1. Create exact server-owned transaction fields.
2. Bind invoice using a canonical 256-bit invoice identifier where supported.
3. Convert XRP to drops with the XRPL library; never use floating-point arithmetic.
4. Apply `LastLedgerSequence`.
5. Re-run mandate and quote checks immediately before signing.
6. Sign only in the server process.
7. Submit and wait.
8. Independently verify final `validated: true`, `tesSUCCESS`, destination, delivered amount, account, invoice, and ledger network.
9. Treat unknown finality as `PAYMENT_UNKNOWN`, not failure or success.
10. Reconcile before releasing the reservation token.

The display price is S$7.40. XRP Testnet has no real fiat value. If a symbolic Testnet amount is used, show both fields and explicitly state there is no FX claim.

### Replay and recovery

- One invoice can settle once.
- Repeat identical requests return the prior outcome.
- A reused transaction for a different invoice is rejected.
- Crash after submit but before response must reconcile rather than resubmit blindly.
- Resetting the scenario cannot remove live/recorded evidence.

---

## 15. Fulfilment simulation

The backend must simulate a real sequence, not the browser:

```text
RESERVED
  → VEHICLE_EN_ROUTE_TO_CHARGER
  → ARRIVED
  → CONNECTED
  → CHARGING (meter events)
  → 8_KWH_DELIVERED
  → DISCONNECTED
  → ROUTE_RECALCULATED
```

At least four metering events update delivered energy and battery from 8% to 23%. The UI may animate between server events but must settle to server values. Provide a failure fixture where payment settles but the charger fails before connection; show fulfilment exception, preserve settlement, and offer retry/alternate-station recovery without pretending a refund occurred.

---

## 16. UI direction — Tactical Mission Grid

### 16.1 Experience thesis

The interface should feel like **a precise instrument with a pulse**: serious enough for medical logistics, immediate enough for a stage demo, and calm enough that warning states are unmistakable. It is an operations workspace, not a marketing landing page.

Follow only Prompt 4’s design family:

- near-black command surface;
- off-white text and panels;
- crisp one-pixel rules;
- modular rectangular panels with near-square corners;
- compact mono utility labels;
- one acid yellow/lime intervention accent;
- explicit green, amber, and red semantics with labels/icons;
- minimal elevation;
- no glass, neon fog, glowing cyberpunk costume, rainbow charts, or gradient-card dashboard.

### 16.2 Specific visual system

Seed `DESIGN.md` with a concrete token system and adjust only after real browser review:

```text
Command black       #10120F  global shell
Instrument black    #171A16  raised operational surface
Paper               #F3F1E8  main content/value
Muted steel         #A6AAA0  secondary text
Rule                #353A32  borders/dividers
Signal lime         #D7F23A  active step/primary intervention
Safe green          #52C878  success with text/icon
Warning amber       #F4B942  attention with text/icon
Block red           #F05D5E  blocked/danger with text/icon
```

Typography:

- Display/status: a condensed technical sans such as **IBM Plex Sans Condensed** or an inspected repository equivalent.
- Body/control: **IBM Plex Sans** or system fallback.
- Data/labels: **IBM Plex Mono**.
- Do not default to Inter unless the project already establishes it.
- Self-host or package fonts if feasible; do not let network font failure shift controls.

Shape and spacing:

- 0–4 px radii; use the same radius family everywhere.
- One-pixel border hierarchy; avoid borders around every tiny datum.
- Dense but breathable 4/8/12/16/24/32 rhythm.
- Shadows only for overlay separation.
- Charts use direct labels whenever feasible.

### 16.3 Signature visual: Mission Viability Ribbon

Adapt Prompt 4’s live anomaly ribbon into a horizontal **Mission Viability Ribbon**. It is the one memorable visual.

It must connect:

- current 8% battery;
- remaining 21 km range;
- 28 km destination distance;
- 10 km required reserve;
- charger detour/queue/charge time;
- 7:15 PM deadline;
- selected offer;
- restored 7:09 PM arrival.

Before intervention, the ribbon crosses a red “mission impossible” threshold. During comparison it overlays three compact charger paths. RapidPlug visibly terminates at a blocked marker. VoltFast continues through credit and charge to a green on-time arrival. Use inline SVG/CSS with semantic text. Every fact must remain readable without motion or color.

### 16.4 Desktop composition

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ FLEETCREDIT / SWIFTMED   MED-4182   FIXTURE DEMO   19:02:14 SGT   RESET    │
├───────────┬───────────────────────────────────────────────┬──────────────────┤
│ Phase     │ Mission headline + viability ribbon          │ Mandate          │
│ rail      ├───────────────────────────────────────────────┤ / evidence       │
│           │ Mission facts        Vehicle facts           │                  │
│           ├───────────────────────────────────────────────┤                  │
│           │ Charger comparison / quote change            │                  │
│           ├──────────────────────────┬────────────────────┤                  │
│           │ Credit decision          │ Action / progress  │                  │
├───────────┴──────────────────────────┴────────────────────┴──────────────────┤
│ Event ledger / compact receipt strip                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Keep the central story visible without requiring page-length scrolling at a normal laptop viewport. Long evidence belongs in a drawer with its own scroll ownership.

### 16.5 Header

Include product wordmark, fleet, dispatch, freshness, timezone, mode, network state, replay/reset, and an evidence button. Mode must be visually persistent. Use a real mobile menu under 768 px.

### 16.6 Mission status band

Headline: **“V-204 cannot finish this delivery on its current charge.”**

Show one sentence of context, deadline, and the dominant guided action. After success, update in place to **“Mission restored · predicted arrival 7:09 PM.”** Reserve geometry so the band does not jump.

### 16.7 Charger comparison

Use a semantic table on desktop with columns:

- operator;
- total price;
- detour;
- queue;
- power;
- projected arrival;
- reserve;
- trust/quote state;
- decision.

Clicking a row selects it and synchronizes the ribbon and evidence panel. Ineligible rows remain inspectable. RapidPlug must show an initial appealing state and then an unmistakable changed-terms block with “No money moved.”

### 16.8 Credit panel

Do not use a credit score gauge. Show:

- request S$7.40;
- approved capacity S$8.00;
- current balance S$0.00;
- five verified evidence rows;
- merchant/purpose/expiry restrictions;
- simulated-policy label;
- **Request S$7.40 mission credit** action.

### 16.9 Action/progress panel

One primary action changes consistently through the flow: **Compare offers**, **Check final terms**, **Request mission credit**, **Purchase charge**, **Start charge**, **Open receipt**. Busy labels preserve button width. Avoid multiple competing primary buttons.

### 16.10 Evidence drawer

Use an app-owned accessible drawer or dialog. Include tabs or sections for:

- decision inputs and score;
- quote diff;
- mandate checks;
- credit evidence;
- payment/ledger;
- charger fulfilment;
- limitations.

Copy hash/account values with a labelled button and visible confirmation. Truncated values must be revealable without hover. On mobile use a full-height sheet within safe areas.

### 16.11 Mobile at 390 px

Reorder exactly:

1. compact header/menu;
2. mission risk/status;
3. essential metrics;
4. viability ribbon transformed into a vertical timeline;
5. current phase action;
6. charger offers as stacked priority cards;
7. credit evidence;
8. recent events;
9. evidence sheet.

No horizontal page clipping. Table content becomes cards rather than a squeezed grid. Preserve operator, price, arrival, decision, status, and next action. Sticky actions must not obscure focus or content.

### 16.12 Copy voice

- Plain, operational, and specific.
- Active voice and sentence case.
- Say “Blocked because the occupancy fee is above SwiftMed’s limit,” not “Policy violation detected.”
- Say “No money moved,” not “Transaction aborted pre-execution.”
- Say “Testnet payment validated,” only when independently true.
- Never say “AI credit score,” “risk-free,” “guaranteed,” or “financially verified.”

### 16.13 Motion

- One orchestrated ribbon transition is sufficient.
- 120–220 ms for control transitions.
- Server progress may update meters smoothly but must not fabricate values.
- Respect `prefers-reduced-motion`; remove travel/pulse, not information.
- No perpetual blinking, ambient particle field, or gratuitous scanlines.

---

## 17. Interaction, accessibility, and state contract

Target WCAG 2.2 AA.

- Native buttons and links; no clickable `div`s.
- Visible focus on every control.
- Minimum practical touch targets.
- Drawer focus management, Escape behavior, inert background when modal, and focus restoration.
- Status changes announced through appropriate live regions without reading every metering tick.
- Semantic table and accessible sortable headers if sorting exists.
- Do not hide vital information behind hover.
- All status uses label/icon plus color.
- App-owned confirmation for reset if it would discard an in-progress fixture run; no browser `confirm()`.
- Stable layout during loading and feedback.
- Global visible scrollbar styling consistent with design tokens.
- `document.title` reflects mission and mode.
- Support keyboard operation of the entire guided flow.
- At 200% zoom, controls and evidence remain reachable.

Required UI states:

- initial populated;
- loading/slow backend;
- backend unavailable;
- LLM unavailable with deterministic explanation fallback;
- offers discovered;
- no eligible offers;
- changed quote blocked;
- credit pending/approved/denied/review required;
- payment awaiting/submitted/unknown/failed/settled;
- reservation failed after settlement;
- charging progress;
- mission restored;
- receipt ready;
- offline/reconnected;
- reduced motion;
- fixture, recorded, and live modes.

---

## 18. Security, privacy, and abuse resistance

### Threats

- Prompt injection in merchant names or quote descriptions.
- Quote changed after model evaluation.
- Destination substitution.
- Amount inflation or floating-point errors.
- Stale telemetry or fabricated dispatch.
- Duplicate submit/replay.
- Browser tampering with approval state.
- Server logs leaking secrets.
- SSRF if future merchant adapters fetch arbitrary URLs.
- A fixture transaction displayed as real.

### Controls

- Treat all provider content as data, never instructions.
- Allowlist merchant adapters and outbound hosts.
- Canonicalize and hash quotes server-side.
- Integer minor units for SGD; XRPL library conversion for drops.
- Re-check mandate immediately before signing.
- Wallet seed only in server memory/environment; never send to LLM.
- Idempotency keys and unique invoice constraints.
- Bounded timeouts/retries; no retry on ambiguous non-idempotent submit until reconciliation.
- Redact secrets and private telemetry.
- Validate every request and response schema.
- Strict content security policy where feasible.
- No raw HTML from LLM/provider content.

---

## 19. Test strategy

### Unit tests

Cover:

- range/energy/arrival arithmetic and boundary conditions;
- offer hard constraints and scoring;
- quote canonicalization and diffs;
- mandate reason codes;
- cold-start capacity calculation;
- expiry and stale telemetry;
- idempotency and state transitions;
- receipt public-field redaction;
- LLM schema validation/fallback;
- integer amount conversion.

### Integration tests

Cover:

- full fixture API flow;
- RapidPlug changed quote cannot produce payment intent;
- wrong destination/amount/invoice rejected;
- duplicate purchase returns prior result;
- crash-window reconciliation;
- settlement without fulfilment;
- LLM timeout does not break the mission;
- SSE reconnect and terminal events;
- reset preserves recorded/live evidence.

### E2E tests

Automate the full guided fixture flow and at least these paths:

1. Happy path to 7:09 PM and receipt.
2. RapidPlug blocked with “No money moved.”
3. Credit denied by lowering mandate cap.
4. Backend/LLM failure with recovery.
5. Settlement succeeds but charger fails.
6. Replay mission and reset.
7. Keyboard-only completion.
8. Desktop and 390 px responsive screenshots.

### Accessibility

Run automated axe checks on initial, blocked, credit, payment, charging, receipt drawer, and mobile menu/sheet states. Manually verify focus order, focus restoration, live announcements, reduced motion, status without color, and 200% zoom/reflow.

### Visual QA

Capture at minimum:

- desktop initial;
- desktop offer comparison;
- desktop blocked quote;
- desktop credit approval;
- desktop mission restored;
- desktop receipt drawer;
- mobile initial;
- mobile blocked;
- mobile restored;
- reduced-motion state.

---

## 20. Milestone order for autonomous loops

### Milestone 0 — Inspect and plan

- Inspect repo/instructions.
- Confirm stack.
- Create `DESIGN.md`, `UX-CONTRACT.md`, architecture skeleton, and verification ledger.
- Record exact baseline commands.

### Milestone 1 — Domain and fixtures

- Define schemas/state machine.
- Seed mission, mandate, vehicle, chargers, and failure fixtures.
- Unit-test deterministic calculations.

### Milestone 2 — Backend vertical slice

- Build SQLite/event persistence.
- Implement run/reset/step APIs.
- Complete end-to-end fixture state transitions without UI.

### Milestone 3 — Safety and credit

- Implement quote diff, mandate guard, underwriting, idempotency, and negative tests.

### Milestone 4 — Working UI

- Build mission workspace and viability ribbon.
- Bind every control to backend state.
- Complete manual and guided flows.

### Milestone 5 — LLM adapter

- Add fixture and OpenAI-compatible providers.
- Test OpenAI and Groq configuration when credentials are available.
- Ensure deterministic fallback.

### Milestone 6 — Payment and fulfilment

- Add protected reservation flow.
- Complete fixture settlement and charge progression.
- Add live XRPL adapter if feasible and verify honestly.

### Milestone 7 — Failure/responsive/accessibility

- Implement every required state.
- Verify at desktop/mobile, keyboard, reduced motion, 200% zoom.

### Milestone 8 — Evidence and rehearsal

- Run full commands.
- Capture screenshots.
- Record testnet evidence if applicable.
- Rehearse the three-minute story and fix comprehension gaps.

Do not spend time on optional analytics or sponsor adapters before Milestone 6 passes.

---

## 21. Exact three-minute demo script

### 0:00–0:20 — Mission risk

“SwiftMed V-204 was provisioned this morning. It is carrying a temperature-sensitive package due at NUS Hospital by 7:15. At 8% battery, it cannot finish with the required reserve.”

Point to the red viability ribbon and S$0 balance.

### 0:20–0:50 — Agent compares outcomes

Run comparison. ChargeNow is cheaper but arrives at 7:24. VoltFast arrives at 7:09. RapidPlug initially looks strong.

### 0:50–1:10 — Safety block

Finalize RapidPlug’s quote. Show S$0.45/min occupancy fee and destination mismatch. State: “The final terms changed. FleetCredit blocked it before signing. No money moved.”

### 1:10–1:40 — Cold-start credit

Select VoltFast. Show S$0 balance and S$7.40 cost. Request credit. Walk through verified fleet, active dispatch, necessary energy, approved merchant, bounded amount. Show S$8 capacity valid for 20 minutes.

### 1:40–2:05 — Economic action

Purchase the exact 8 kWh authorization. In fixture mode say fixture. In live mode wait for validated Testnet evidence before saying settled.

### 2:05–2:35 — Physical outcome

Show reserved → connected → charging. Battery moves from 8% to 23%. Ribbon changes from impossible to arrival at 7:09 with reserve.

### 2:35–3:00 — Receipt and thesis

Open receipt. Connect mandate, offer choice, block, credit, payment, 8 kWh fulfilment, and mission outcome. End with: “FleetCredit does not preload every machine with money. It grants the smallest economic capacity justified by the mission.”

---

## 22. Judge questions the build must answer

### Why not Google Maps?

Maps finds chargers. FleetCredit chooses and safely executes an economic action under deadline, reserve, queue, price, trust, quote, balance, and authority constraints.

### Why does this need an LLM?

The LLM is useful for interpreting and explaining heterogeneous offers. The product remains safe because deterministic engines own eligibility, arithmetic, credit, and signing. The demo must still work without an LLM key.

### Why credit?

Pre-funding thousands of machines creates idle capital and broad authority. This demo grants conservative, purpose-bound capacity only when a verified mission creates a necessary expense.

### Is this real underwriting?

No. The MVP is a transparent contextual underwriting simulation and must be labelled that way unless a real provider is integrated.

### What does XRPL prove?

A validated transaction proves the specified Testnet payment reached the specified address with the recorded fields. It does not prove creditworthiness, charger identity, energy delivery, or mission success; those have separate evidence.

### What stops the model from stealing the wallet?

It never sees the seed or constructs arbitrary transactions. A deterministic guard rebuilds and validates exact fields immediately before a server-side signer.

### What if payment succeeds and the charger fails?

The state becomes a fulfilment exception. Settlement remains true, mission risk remains visible, and recovery is explicit.

---

## 23. Documentation and evidence deliverables

The finished folder SHOULD contain:

```text
GOAL.md
README.md
PRODUCT.md
ARCHITECTURE.md
DESIGN.md
UX-CONTRACT.md
SECURITY.md
VERIFICATION.md
.env.example
premium-ui.json
src/
server/
tests/
evidence/
verification/
```

`VERIFICATION.md` must record dates, commit/working-tree identity, commands, actual results, browser/viewports, screenshots, modes, known limitations, and live/recorded transaction evidence. It must not contain secrets.

The README must let a new judge run fixture mode in under five minutes.

---

## 24. Strict definition of done

FleetCredit is done only when all applicable statements are true:

1. A clean local checkout starts with documented commands.
2. A no-key fixture backend and frontend run end to end.
3. The initial screen explains person, mission, machine, risk, authority, balance, and expected outcome.
4. Charger comparison uses tested server-side calculations.
5. ChargeNow fails because of deadline, not arbitrary UI copy.
6. RapidPlug’s changed fee and destination are deterministically blocked.
7. The blocked state explicitly proves no signing/submission occurred.
8. VoltFast is selected as the cheapest eligible mission-preserving option.
9. Cold-start credit checks real fixture evidence and returns structured reason codes.
10. Credit is capped, merchant-bound, purpose-bound, quote-bound, vehicle/dispatch-bound, and expiring.
11. The model cannot approve credit or create arbitrary payment fields.
12. OpenAI and Groq are supported through one documented OpenAI-compatible adapter.
13. LLM failure falls back cleanly without breaking the demo.
14. Payment, settlement, reservation, energy delivery, and mission restoration are distinct states.
15. The protected reservation cannot be unlocked by wrong, missing, or replayed payment evidence.
16. Charging progress comes from backend events.
17. Battery reaches 23% and arrival recalculates to 7:09 PM from delivered energy.
18. Receipt connects all causal evidence and states limitations.
19. Fixture, recorded, and live evidence cannot be confused.
20. Every visible control works; no false affordances remain.
21. Desktop and 390 px mobile flows are complete with no clipping.
22. Keyboard, focus, reduced motion, color-independent status, and automated accessibility checks pass.
23. Unit, integration, E2E, typecheck, lint, build, and project verification commands pass.
24. Failure paths include credit denial, payment uncertainty/failure, and post-settlement charger failure.
25. At least one complete guided fixture run is reliably recordable in 60–90 seconds.
26. The full judge story is demonstrable in under three minutes.
27. Current evidence is recorded in `VERIFICATION.md`.

A beautiful dashboard without a server-owned working flow is not done. An LLM narrative without deterministic enforcement is not done. A credit card that always says approved is not done. A simulated payment labelled live is disqualifying. A settled payment without a protected service and fulfilment evidence is not done.

---

## 25. Current reference map

Re-check current technical behavior before implementation because SDKs, model availability, Testnet endpoints, and sponsor APIs change.

- Selected local visual source: `archive/website-template/observability-design-prompts.md`, Prompt 4 — Tactical Signal Grid
- Local product source: `tftf/prototypes/ideas.txt`, Idea 2 — FleetCredit
- Neighboring build-contract example: `tftf/prototypes/Faircut/GOAL.md`
- Groq OpenAI compatibility: <https://console.groq.com/docs/overview>
- Groq API reference: <https://console.groq.com/docs/api-reference>
- OpenAI API documentation: <https://developers.openai.com/api/docs/>
- OpenAI structured outputs: <https://developers.openai.com/api/docs/guides/structured-outputs>
- XRPL send XRP tutorial: <https://xrpl.org/docs/tutorials/payments/send-xrp>
- XRPL reliable transaction submission: <https://xrpl.org/docs/concepts/transactions/reliable-transaction-submission>
- XRPL public Testnet servers: <https://xrpl.org/docs/tutorials/public-servers>
- t54 Agentic Risk Standard: <https://docs.t54.ai/docs/research/agentic-risk-standard>
- t54 Trustline overview: <https://www.t54.ai/docs/trustline/overview>
- ClawCredit overview: <https://www.claw.credit/docs/overview>

When live documentation conflicts with this contract’s implementation examples, preserve the product invariants, update the adapter and tests, and document the versioned change. Do not silently mix incompatible API generations.
