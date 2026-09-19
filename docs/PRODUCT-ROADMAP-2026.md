# ResearchAgent product roadmap

**Planning date:** 19 September 2026<br>
**Critique showcase:** 1 October 2026<br>
**Secondary demo target:** 10 October 2026<br>
**Singapore FinTech Festival final:** 16 November 2026

## Product thesis

ResearchAgent helps finance analysts decide which relevant paywalled research
article is worth purchasing, buys it within an explicit budget and source
policy, and proves how the newly accessible evidence changed the analysis.

> ResearchAgent buys the right paywalled research—not more research.

This is not a general-purpose agent that buys products or services. Every
feature in this roadmap must strengthen at least one part of this loop:

1. discover relevant open and paywalled financial research;
2. identify an evidence gap in the analyst's question;
3. estimate whether a paywalled article is worth its price;
4. purchase or reject it under explicit wallet and mandate controls;
5. use only accessible evidence in the answer; and
6. show what changed, with citations and a purchase/evidence receipt.

XRPL is the settlement rail and audit proof. It is not the product by itself.

## Target user and core job

**Primary user:** an investment, strategy, or due-diligence analyst preparing
an evidence-backed decision memo.

**Core job:** when the best evidence may be behind a paywall, help the analyst
spend a small research budget on the source most likely to improve the
decision—not on redundant, weak, or unaffordable articles.

## Product boundaries

### In scope

- Financial-research questions and analyst workflows.
- Open and paywalled article discovery within approved sources.
- Explainable article-value assessment based on relevance, novelty,
  independence, authority, evidence-gap fit, price, and expected conclusion
  impact.
- Editable finance-research plans.
- Local wallet and spending-mandate setup.
- Human approval for article purchases in the October experiences.
- Premium-access state, license metadata, citations, reports, and receipts.
- Local deterministic demo mode plus clearly labelled optional Testnet mode.

### Explicitly out of scope before 31 October

- Hosting, domains, public deployment, production monitoring, or cloud
  infrastructure.
- OAuth, login screens, team accounts, subscriptions, or production billing.
- Mainnet funds.
- Generic shopping, APIs, compute, travel, or other non-research purchases.
- A full publisher marketplace, ratings/community systems, or decentralized
  dispute resolution.

Hosting may begin after 31 October only after the local product and payment
loop are stable. Authentication is not required for the November demo unless
a real integration makes it unavoidable.

## Formal product workflow and data chain

The UI and implementation should expose a professional workflow without
showing hidden chain-of-thought.

### Inputs

- Research question and decision context.
- Audience, horizon, and desired report type.
- Finance-research approach or editable plan.
- Approved source profiles and source exclusions.
- Wallet mode, available balance, total research budget, per-article ceiling,
  and approval policy.

### Workflow artifacts

1. **Research mandate** — objective, constraints, approved sources, budget.
2. **Research plan** — ordered questions, evidence requirements, and stop
   conditions selected from a finance methodology and editable by the user.
3. **Evidence map** — open evidence, premium previews, evidence families,
   conflicts, and unresolved gaps.
4. **Article value assessment** — why each premium candidate may or may not be
   worth buying.
5. **Purchase proposal** — selected article, alternatives, price, expected
   impact, policy checks, and quote.
6. **Purchase record** — approval, settlement state, access grant, article and
   license identifiers.
7. **Evidence-impact diff** — baseline conclusion, new evidence, changed
   claims, unchanged claims, and remaining uncertainty.
8. **Dossier and Evidence Receipt** — cited answer, provenance, spend, access,
   license, and limitations.

### Outputs

- A cited analyst-ready report.
- A visible before/after conclusion comparison.
- A purchased-article asset record.
- A reconstructable article decision and transaction history.
- A machine-readable Evidence Receipt that excludes protected article bodies.

## Official user journey

### 1. Product landing

Explain the product, analyst audience, article-purchase thesis, trust controls,
and canonical example. The primary action is **Launch local demo**.

### 2. Wallet and mandate setup

The user chooses Partner Demo Wallet or XRPL Testnet, sees balance and network,
sets a total budget and per-article ceiling, and chooses approved source
profiles. October uses manual purchase approval.

### 3. Research approach and editable plan

The user chooses one of three finance-specific approaches:

- **Balanced diligence** — collect support, challenges, and independent
  corroboration.
- **Thesis stress test** — prioritize contradictory evidence and key risks.
- **Budget-first scan** — establish an open-source baseline and buy only when
  a material gap remains.

ResearchAgent produces a short plan showing questions, required evidence,
budget intent, and stop conditions. The user may edit and approve it before
research begins.

### 4. Research workspace

Show the current thesis, unresolved gaps, evidence families, research progress,
and source access state. Rich article cards expose provenance, preview,
publication date, topic, price, license, authority signals, and family
independence without revealing locked content.

### 5. Premium article comparison

Compare the recommended article with at least one redundant and one
policy-blocked alternative. Explain evidence-gap fit, novelty, authority,
independence, price, and expected decision impact. Avoid unexplained composite
scores or false numeric precision.

### 6. Purchase checkpoint

The user sees the quote, exact amount, remaining budget, wallet/network,
article/resource identifier, license summary, and all mandate checks. The user
can **Approve purchase**, **Skip**, or **Reject**.

### 7. Evidence unlock and impact

After settlement, the exact purchased excerpt becomes accessible. Show the
baseline conclusion next to the revised conclusion, link each changed claim to
an accessible evidence span, and distinguish new evidence from model prose.

### 8. Report, receipt, and library

The user receives a cited dossier, printable/JSON Evidence Receipt, and a local
record of purchased articles showing access and license state. By 10 October,
reports and purchased articles can be revisited from local history.

## Canonical showcase story

**Question:** Can the announced AI data-centre buildout become operating
capacity by 2028, or are grid constraints being underestimated?

**Mandate:** Investment Committee audience, S$2 Partner Demo Wallet budget,
S$1 per-article ceiling, approved synthetic finance sources, manual approval,
and a one-page cited brief.

The product must visibly:

1. establish an open-evidence baseline;
2. identify grid delivery as the material evidence gap;
3. recommend the S$0.80 Grid Operators Report;
4. skip Circuit Note because it duplicates an existing evidence family;
5. block the S$1.40 GridScope Asia article because it exceeds the ceiling;
6. request approval before purchasing;
7. unlock only the purchased evidence; and
8. show that the conclusion became more cautious because of that evidence.

Target presentation length: five to seven minutes.

## Milestone 1 — critique showcase by 1 October

The October 1 goal is a complete, feature-rich local product demonstration.
The existing visual theme remains; information architecture and interaction
depth improve.

### Feature set

| Capability | User story | Observable outcome |
| --- | --- | --- |
| Excalidraw UX wireframes | As a product team, we want the official views and transitions agreed before parallel implementation | Editable wireframes cover landing, wallet/mandate, plan editor, workspace, article comparison, purchase, impact, receipt, and library/history shells |
| Official product shell | As a first-time analyst, I want to understand the product and enter one obvious flow | Landing and persistent application navigation clearly frame paywalled research acquisition |
| Local wallet setup | As an analyst, I want to know what wallet, balance, network, and budget the agent may use | Partner Demo Wallet is credential-free; Testnet is clearly separate; no login is required |
| Research mandate | As an analyst, I want to constrain sources and spending before research starts | Question, audience, horizon, allowlist, budget, ceiling, wallet, and manual approval policy are visible and server-enforced |
| Finance research approaches | As an analyst, I want a professional starting method suited to my task | Balanced diligence, thesis stress test, and budget-first scan generate distinct plan emphasis |
| Editable research plan | As an analyst, I want to review and modify the questions and evidence requirements before the agent acts | Plan steps and stop conditions can be edited and approved; the final plan is preserved in the run record |
| Visible agent workflow | As a reviewer, I want to understand inputs, stages, artifacts, and controls without seeing private chain-of-thought | A stage timeline shows planning, discovery, gap analysis, article evaluation, purchase, unlock, and synthesis |
| Evidence-family workspace | As an analyst, I want to distinguish independent evidence from repeated reporting | Sources are grouped by evidence family and open, preview, locked, and unlocked states are unambiguous |
| Rich premium article cards | As an analyst, I want enough metadata to judge an article before purchase | Cards show provenance, preview, date, topic, price, license, authority signals, and evidence-family relationship |
| Explainable article valuation | As an analyst, I want to know why an article is worth buying | Candidate view explains relevance, novelty, authority, independence, gap fit, price, and expected impact |
| Candidate comparison | As an analyst, I want to compare the recommended article with alternatives | Recommended, redundant, and over-ceiling candidates are shown side by side with distinct reasons |
| Manual purchase checkpoint | As an analyst, I want final control over spending | No purchase occurs before Approve; Skip and Reject preserve the budget and access remains locked |
| Purchase lifecycle | As a reviewer, I want to see quote, settlement, and access as separate states | UI visibly advances through proposed, approved, settled/simulated, and unlocked states |
| Evidence-impact diff | As an analyst, I want to know whether the paid article actually mattered | Baseline and revised claims are compared, with exact evidence-span links and remaining uncertainty |
| Analyst dossier | As an analyst, I want a concise deliverable rather than an activity feed | A structured one-page report separates thesis, support, challenges, uncertainties, and methodology |
| Evidence Receipt | As a reviewer, I want to reconstruct what was bought and used | Printable and JSON receipt includes mandate, article, quote, decision, settlement mode, access, license, spans, and claim links without premium bodies |
| Deterministic local reset and failures | As a presenter, I want the demonstration to work repeatedly | Reset restores the canonical state; LLM/Testnet failures have deliberate UI states and fixture fallback |
| Accessibility and demo regression | As a presenter, I want confidence that the primary flow is usable and stable | Keyboard, responsive, accessibility, unit, build, and end-to-end checks cover the canonical flow |

### Sprint plan

| Sprint | Dates | Outcome |
| --- | --- | --- |
| Sprint 1 — product and contracts | 19–21 Sep | Wireframes, product shell, wallet/mandate contract, research-plan contract, canonical data alignment |
| Sprint 2 — analyst workflow | 22–25 Sep | Plan selector/editor, visible workflow, evidence families, article metadata, article valuation and comparison |
| Sprint 3 — purchase and proof | 26–28 Sep | Manual approval, purchase lifecycle, evidence unlock, impact diff, dossier, and receipt |
| Sprint 4 — hardening | 29–30 Sep | Reset, failure states, accessibility, regression coverage, screenshot/docs alignment, and rehearsal |
| Showcase | 1 Oct | Five-to-seven-minute local critique flow |

### Exit criteria

- A first-time reviewer can complete the full flow locally without credentials.
- No article is purchased before explicit user approval.
- The user can inspect and edit the research plan before execution.
- The user can explain why one article was bought, one was redundant, and one
  violated the mandate.
- Locked premium text is never read, cited, or exported.
- The purchased article causes a visible, cited change in the conclusion.
- The same clean reset produces the same canonical result repeatedly.
- Every view clearly labels synthetic content and fixture settlement.

## Milestone 2 — expanded local product by 10 October

This milestone deepens repeat use and financial-research professionalism. It
remains local; hosting and authentication are still out of scope.

### Feature set

| Capability | User story | Observable outcome |
| --- | --- | --- |
| Local report history | As an analyst, I want to reopen prior research without rerunning it | Saved runs list question, date, approach, spend, purchased articles, and result status |
| Purchased article library | As an analyst, I want to see what research access I acquired and where it was used | Library shows article, publisher, access/license state, version/hash, purchase, expiry/retention, and linked reports |
| Plan templates as finance skills | As an analyst, I want reusable professional methods | Versioned local templates define evidence requirements for thesis validation, risk review, and market/infrastructure diligence |
| Plan comparison | As an analyst, I want to compare two research approaches before spending | User can preview how balanced and stress-test plans change evidence needs and budget intent |
| Multi-purchase budget allocation | As an analyst, I want the agent to recommend a small portfolio of articles when one source is insufficient | An editable purchase plan ranks up to three non-duplicate articles within the total budget |
| Conflict and uncertainty view | As an analyst, I want disagreements and weak support surfaced | Report and workspace distinguish corroboration, contradiction, single-source claims, and unresolved gaps |
| Article-to-report traceability | As a reviewer, I want to see every report claim that depends on a purchased article | Simple table/graph links reports, claims, article versions, and evidence spans |
| Local wallet ledger | As an analyst, I want to understand research spend across runs | Ledger shows quotes, approvals, spend, rejected/blocked attempts, balances, and receipt links |
| Evaluation scorecard | As the product team, we want evidence that the agent is making sensible purchase decisions | Golden scenarios report ranking, duplicate avoidance, policy enforcement, access control, citation, and conclusion-impact checks |
| Presenter mode | As a presenter, I want a focused walkthrough without losing full product depth | Guided mode highlights the canonical sequence while normal mode preserves exploration |

### Sprint plan

| Sprint | Dates | Outcome |
| --- | --- | --- |
| Sprint 5 — reusable research | 2–5 Oct | History, purchased-article library, finance-skill templates, and traceability |
| Sprint 6 — deeper decisions | 6–9 Oct | Plan comparison, multi-purchase allocation, conflicts/uncertainty, wallet ledger, scorecard, and presenter mode |
| Demo | 10 Oct | Expanded local product demonstration |

### Exit criteria

- Previous reports and purchases can be revisited locally.
- Purchased-article access and license state are visible and traceable to the
  reports that used them.
- The user can compare research approaches and edit a multi-article purchase
  plan without exceeding the mandate.
- Golden scenarios catch regressions in article choice, access, and citations.

## Milestone 3 — SFF final by 16 November

The November goal is the same paywalled-article product with a genuine
machine-payment, delivery, and publisher-content boundary.

### Core features

- One real protected research-article endpoint using an HTTP 402 challenge
  and retry flow.
- Quote binding to article/resource, invoice, amount, payee, asset/network,
  expiry, license, and approval policy.
- Local wallet setup plus validated XRPL Testnet settlement and explorer link.
- Replay protection, idempotency, and tamper checks.
- Settlement and article fulfilment represented as separate states.
- Delivered article/excerpt verified by resource identifier, version, and
  content hash before access is granted.
- One authorized public-data adapter and one partner/simulated premium article
  service in the same research flow.
- License-aware purchased-article library with retention and redistribution
  limits.
- Publisher-side listing demonstrator for article metadata, preview, price,
  license, resource version, and protected delivery. This remains a bounded
  demonstrator, not a full marketplace.
- At least one adversarial path blocked before signing: changed amount, wrong
  payee, expired quote, replayed invoice, or mismatched delivered artifact.
- Evaluation harness and two to three finance-researcher usability sessions.
- Public deployment work may begin after 31 October, with deterministic local
  fallback retained for the final.

### Suggested sequence

| Dates | Outcome |
| --- | --- |
| 11–18 Oct | Consolidate feedback, harden data contracts, and specify the protected article protocol |
| 19–30 Oct | Implement HTTP 402, quote validation, Testnet wallet/payment, idempotency, and delivery verification locally |
| 31 Oct–6 Nov | Add authorized source/service integration, license-aware library, publisher listing demonstrator, and optional hosting |
| 7–11 Nov | Adversarial tests, evaluation, usability sessions, and product refinement |
| 12–15 Nov | Live/fallback rehearsals, backup artifacts, documentation, and feature freeze |
| 16 Nov | Singapore FinTech Festival final |

### Exit criteria

- A protected article service returns a real payment challenge.
- ResearchAgent validates the challenge against the analyst's mandate and
  requires the configured approval.
- One XRP payment settles successfully on XRPL Testnet.
- A verifiable article artifact is delivered only after valid settlement.
- Settlement and fulfilment can independently succeed or fail in the UI.
- At least one tampered, expired, replayed, or over-budget request is blocked.
- The dossier cites only delivered and accessible evidence.
- The complete article-purchase story works live and in deterministic local
  fallback mode.

## Feature disposition after the final review

### Build in this roadmap

- Local wallet setup and ledger.
- Finance-specific research approaches and editable plans.
- Professional workflow artifacts and explicit data chain.
- Rich article metadata and explainable worth-to-buy assessment.
- Multi-article budget planning within a research mandate.
- Purchased-article library, license state, report organization, and
  article-to-claim traceability.
- Evidence Receipts, impact comparisons, evaluation, and failure handling.
- A bounded publisher listing/protected-delivery demonstrator by November.

### Defer

- OAuth, login, teams, subscriptions, and production billing.
- Hosting until after 31 October.
- Ratings/comments, social reputation, and community moderation.
- General content marketplace or cross-platform discovery protocols.
- Decentralized arbitration.
- Flexible publisher pricing engines beyond explicit per-article quotes.
- DRM claims beyond enforceable access, license, and non-export controls.
- Generic purchases or non-financial research verticals.

## Definition of ready for an implementation issue

- The user story identifies the analyst or reviewer value.
- Scope and out-of-scope boundaries are explicit.
- Dependencies and data contracts are known.
- Acceptance criteria are observable in the local application or tests.
- Verification includes the relevant automated command and/or manual flow.
- No unresolved product decision is hidden inside implementation work.

## Definition of done

- Acceptance criteria pass in the local fixture flow.
- Premium content and wallet secrets remain server-only.
- Fixture, Testnet, locked, unlocked, settlement, and fulfilment states are
  labelled truthfully.
- Unit/type/build checks pass, with Playwright coverage for user-facing flows.
- Accessibility and keyboard behavior are checked for changed views.
- Documentation and screenshots match the current product.
