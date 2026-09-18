# ResearchAgent product roadmap

Deadlinne 1 : 1st October 
Final Deadline : 1x November 2026

## Product decision

Keep **ResearchAgent** as the working product name and describe the product
category as an **Evidence Procurement Guard**:

> An AI research agent that may buy useful evidence within a delegated spending
> mandate, and must prove what the purchase changed in its conclusion.

The research workflow is the first concrete use case. XRPL is the settlement
rail and audit proof, not the product by itself.

The product should not be presented as a general AI assistant, publisher
marketplace, production payment platform, or generic wallet at either
milestone.

## Product directions considered

| Direction | Strength | Main problem | Decision |
| --- | --- | --- | --- |
| Evidence Procurement Guard | Closest to the working product; clear before/after value | Payment may appear decorative unless access and evidence impact are explicit | **Choose now** |
| Agent Spend Guard for digital services | Strong general agentic-commerce story | Too broad for October; needs a real merchant and fulfilment model | Use as the November positioning layer |
| Research Procurement OS for financial institutions | Strong enterprise controls and commercial story | Requires accounts, roles, approvals, licensing, and durable persistence | Later productization |
| Singapore Infrastructure Intelligence | Locally relevant and concrete | Requires current, legally usable data and can obscure the payment thesis | Use as a vertical, not a separate product |

## The official product flow

The visual theme should remain. The change is to the product hierarchy,
navigation, language, and interaction flow.

### 1. Product landing page

The public first page answers four questions without requiring a demo:

1. **What is this?** Research that can justify why it spent money.
2. **Who is it for?** An analyst preparing an investment-committee decision.
3. **How does it work?** Set a mandate, find an evidence gap, approve or
   pre-authorize a purchase, inspect the changed conclusion and receipt.
4. **Why trust it?** Approved providers, hard spending limits, protected
   evidence, claim-level citations, and an auditable receipt.

Recommended sections:

- Hero with a single `Launch demo` action.
- Three-step explanation: **Mandate → Evidence decision → Verified result**.
- One canonical before/after example.
- Trust and controls section.
- Honest demo notice: synthetic content and fixture settlement unless Testnet
  mode is explicitly active.
- Short product status and limitations section.

Avoid feature grids, fake customer logos, broad marketplace claims, and visual
re-theming during the October sprint.

### 2. New mandate page

Replace the ambiguous "new thread" framing with a clear research mandate:

- Decision question.
- Audience and decision context.
- Time horizon and output type.
- Approved source profiles.
- Total research budget and per-source ceiling.
- Purchase authority: manual approval for the October showcase. Add bounded
  auto-buy as a later policy option, not as the default.
- Runtime mode: Partner Demo Sandbox, or XRPL Testnet when explicitly enabled.

The default critique path should be pre-filled and runnable without
credentials.

### 3. Research workspace

Do not make the user interpret one very long page. Give the run a compact,
visible structure:

- **Mandate:** objective, source boundary, budget, authority, and runtime mode.
- **Evidence:** progress timeline, evidence families, open/premium status, and
  the unresolved gap.
- **Decision:** recommendation, reason, price, policy checks, and explicit
  approve/skip/block actions.
- **Result:** before/after conclusion with exact evidence links.
- **Receipt:** authorization, quote, settlement, access, cited spans, and
  limitations.

These can be sections within the existing application for October, provided
they behave like a guided sequence. They do not need to become a complex
routing system before the critique.

### 4. Purchase checkpoint

This is the most important interaction to fix. The current product buys the
planned source automatically even though the UX contract implies approval.
For October, require manual approval and display it in the mandate:

- **Manual approval:** `Approve purchase`, `Skip`, or `Block`.

For November, pre-authorized purchase may be added as a second policy. It must
state the threshold and show that the purchase passed every rule before
execution.

The card must show the source, evidence gap, novelty/family independence,
price, remaining budget, per-source ceiling, quote/resource identifiers,
runtime mode, and access state.

### 5. Result and Evidence Receipt

The climax is not the transaction hash. It is the changed decision:

- Open-source baseline.
- New evidence acquired.
- Claim that changed or became more certain.
- Remaining uncertainty.
- Exact claim-to-evidence links.

End with a first-class Evidence Receipt. It should be viewable, printable, and
exportable as JSON without exporting protected article bodies.

## Canonical showcase story

**Question:** Can the announced AI data-centre buildout become operating
capacity by 2028, or are grid constraints being underestimated?

**Mandate:** Investment Committee audience, S$2 fixture budget, S$1 per-source
ceiling, approved synthetic source profiles, one-page cited brief.

The product must visibly make three different decisions:

1. **Buy** the Grid Operators Report for S$0.80 because it closes the grid
   evidence gap.
2. **Skip** Circuit Note because it duplicates an existing evidence family.
3. **Block** GridScope Asia because S$1.40 exceeds the per-source ceiling.

The final conclusion should become more cautious: announced spending can
continue while operating capacity lags in grid-constrained markets.

Target presentation length: four to six minutes.

## Milestone 1 — critique-ready product by 1 October

The October goal is a polished, coherent, truthful product demonstration. It
is not a production backend or a general marketplace.

### Must have

- Product landing page and clear `Launch demo` entry.
- New Mandate setup instead of an unexplained chat/thread screen.
- Visible mandate card with budget, ceiling, approved sources, purchase
  authority, and runtime mode.
- Compact, observable research phases rather than hidden sequential work.
- Explicit purchase authority and a clear decision checkpoint.
- Bought, skipped-duplicate, and blocked-by-policy states in the main flow.
- Before/after conclusion as the central result.
- Evidence Receipt view plus print and JSON export.
- In-app reset that restores the canonical run in under one minute.
- Deterministic, credential-free Partner Demo Sandbox mode.
- Clear synthetic-content and simulated-settlement labels.
- One canonical 12-source dataset across runtime, copy, tests, docs, diagrams,
  and screenshots.
- Friendly failure states for unavailable LLM and Testnet services.
- Responsive, keyboard-accessible, presentation-ready UI.

### Should have

- Compact explanation of why a source was recommended: gap match, novelty,
  authority, and family independence.
- Lightweight previous-report navigation if it does not distract from the
  canonical flow.
- One optional pre-verified XRPL Testnet transaction as technical proof.
- Presenter mode or guided focus that reduces scrolling.
- A stable printable dossier and receipt for reviewers.

### Schedule

| Dates | Outcome |
| --- | --- |
| 17–18 Sep | Freeze product promise, canonical dataset, terminology, mandate rules, and critique script |
| 19–22 Sep | Build landing, New Mandate flow, application hierarchy, and mode/sandbox language |
| 23–25 Sep | Build decision checkpoint, before/after result, and Evidence Receipt |
| 26–27 Sep | Add deterministic reset, failure states, responsive behavior, and accessibility polish |
| 28 Sep | Align docs, diagrams, screenshots, counts, and fixture labels |
| 29 Sep | Full regression, clean-machine run, and presentation artifact capture |
| 30 Sep | Feature freeze and repeated four-to-six-minute rehearsals |
| 1 Oct | Critique showcase |

### October acceptance criteria

- A first-time reviewer can complete the canonical run without credentials or
  presenter explanation.
- A clean reset produces the same decision path repeatedly.
- The UI never implies that synthetic publishers, content, or fixture payments
  are real.
- One useful source is bought, one duplicate is skipped, and one over-ceiling
  source is blocked.
- Every conclusion claim opens an exact accessible evidence span.
- The before/after change is understandable without reading an activity log.
- The receipt shows what was authorized, spent, unlocked, and cited.
- No current screenshot or document contradicts the 12-source scenario.

## Milestone 2 — SFF-ready fintech proof by 16 November

The November goal is to preserve the October story while replacing the most
important simulated boundary with a genuine machine-payment and fulfilment
loop.

### Must have

- One real protected research-service endpoint with an HTTP 402 challenge and
  retry flow.
- Quote binding to resource, invoice, amount, payee, asset/network, expiry,
  and approval policy.
- Replay protection and idempotent payment handling.
- One validated XRPL Testnet transaction with an explorer link.
- Settlement and fulfilment shown as separate states.
- Returned evidence artifact verified by identifier and content hash.
- Receipt covering policy decision, quote, payment, delivery, evidence access,
  and conclusion impact.
- One adversarial path that is blocked before signing: changed amount, wrong
  payee, expired quote, replayed invoice, or artifact mismatch.
- One authorized public-data adapter or partner-provided research service.
- Repeatable deployment plus the deterministic no-network fallback.
- Evaluation harness covering ranking, duplicate detection, budget decisions,
  access control, receipt integrity, and citation validity.

### Should have

- Singapore-relevant infrastructure or grid data as an authorized vertical.
- Human approval for new or insufficiently trusted merchants.
- A second merchant/service only if the primary loop is already reliable.
- A small impact scorecard: spend prevented, evidence purchased, delivery
  success, citation validity, and time saved.
- Two to three researcher usability sessions and one partner/pilot
  proposition with a measurable 30-day success criterion.
- Baseline license state displayed on every acquired asset: permitted use,
  retention, and redistribution status.
- Simple report-to-evidence traceability view; not a full knowledge graph.

### Schedule

| Dates | Outcome |
| --- | --- |
| 2–9 Oct | Incorporate critique, freeze evaluation cases, and resolve source-of-truth/data issues |
| 10–23 Oct | Implement the real protected endpoint, challenge validation, Testnet settlement, replay protection, and fulfilment verification |
| 24 Oct–2 Nov | Integrate one authorized data/service source, receipt proof, adversarial path, and deployment |
| 3–8 Nov | Run evaluation, reliability work, accessibility checks, and researcher sessions |
| 9–11 Nov | Apply only validated product improvements and finalize the partner/pilot story |
| 12–13 Nov | Full live and fallback rehearsals; capture verified backup artifacts |
| 14–15 Nov | Feature freeze and presentation polish |
| 16 Nov | SFF final |

### November acceptance criteria

- A protected service returns a real payment challenge.
- The agent validates every material field against the user mandate.
- One XRP payment settles successfully on XRPL Testnet.
- A verifiable evidence artifact is delivered after settlement.
- Settlement and fulfilment can independently succeed or fail in the UI.
- At least one tampered, expired, replayed, or over-budget request is blocked.
- The dossier cites only delivered and accessible evidence.
- The complete story works live and in deterministic fallback mode.

## Idea disposition

### Include now or by November

- Professional, steady UI and better product organization.
- Rich source metadata, provenance, price, and license status.
- Agent purchase recommendation based on budget, scope, novelty, and expected
  evidence value.
- User approval or explicit pre-authorization.
- Better report organization and report-to-evidence traceability.
- Evidence Receipt and claim-to-span citations.
- Evaluation, reliability, reset, runtime modes, and honest failure states.

### Keep visible as future direction, but do not build for these milestones

- Asset library and reusable purchased research.
- Multiple license/copyright tiers and version-aware entitlements.
- Flexible charging models and publisher pricing tools.
- Publisher, author, and asset ratings/comments.
- General content index or cross-platform discovery protocol.
- Decentralized community or dispute arbiter.
- Full publisher marketplace or facilitator network.
- Multi-user accounts, subscriptions, and production billing.
- Mainnet funds, generic crawling, multiple verticals, and broad AP2/MCP/A2A
  claims.

These ideas are reasonable extensions, but they depend on identity,
moderation, licensing agreements, durable entitlements, production payments,
or a multi-sided market. Building them now would weaken the core proof.

## Immediate work order

Start in this order:

1. Implement manual purchase approval for October and remove the current
   implicit auto-buy behavior.
2. Make the 12-source scenario the sole source of truth and remove stale
   20-source/real-publisher artifacts.
3. Write the final landing-page promise, canonical mandate, and four-to-six
   minute critique script.
4. Restructure the current UI around Mandate, Evidence, Decision, Result, and
   Receipt while preserving the existing theme.
5. Implement the decision checkpoint and before/after conclusion.
6. Implement the Evidence Receipt and deterministic reset.
7. Polish and rehearse only after the whole official flow works end to end.

## Known risks to resolve early

- The current automatic purchase conflicts with the approval language.
- The runtime dataset, fallback catalog, docs, and screenshots are not fully
  aligned.
- The existing x402 object is quote-shaped metadata, not yet a wire-compatible
  HTTP 402 protocol flow.
- Testnet and live-LLM modes add avoidable showcase failure modes.
- A transaction proves settlement, not delivery; fulfilment needs its own
  verification.
- A fixed SGD/XRP display is valid only as an explicitly labelled fixture
  conversion.
- Local JSON run persistence is demo infrastructure, not multi-user product
  storage.
