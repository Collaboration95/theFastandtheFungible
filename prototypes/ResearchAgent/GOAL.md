# ResearchAgent — Autonomous Build Goal and Verification Contract

**Hackathon context:** SingHacks 2026, Ripple/XRPL track

**Product:** ResearchAgent

**Working pitch:** *Give an AI a research question and a budget. It decides which evidence is worth paying for.*

**Primary user:** Elena Tan, an investment-research analyst preparing a committee brief

**Canonical question:** *Is the AI data-centre investment boom sustainable through 2028?*

**Document role:** This is the authoritative implementation goal for a coding agent working in repeated autonomous loops. It is the product contract, retrieval specification, backend/LLM contract, UI brief, test plan, demo script, and definition of done.

**Selected design direction:** **Prompt 1 — Black Paper / Trace Desk**, from `archive/website-template/observability-design-prompts.md`, adapted into a clean financial-news research desk. Do not merge other supplied template directions into this prototype. Evoke the discipline and hierarchy of a high-quality financial newspaper without copying Financial Times branding, proprietary assets, article text, or exact layouts.

**Required outcome:** a polished, locally runnable, resettable full-stack prototype with a real backend, deterministic retrieval/ranking, simulated free and premium source markets, budget-aware purchase decisions, an evidence-linked dossier, OpenAI/Groq-compatible LLM support, and a no-credential fixture mode that always completes.

---

## 0. How to use this goal

Build, run, inspect, and verify ResearchAgent until every mandatory criterion has current evidence. Do not stop at a search mock-up, a streaming-text demo, a frontend-only timeline, decorative citations, or an animation disconnected from backend retrieval and budget state.

- **MUST** means mandatory.
- **MUST NOT** means prohibited.
- **SHOULD** means expected unless a repository constraint makes it unreasonable; document deviations.
- **MAY** means optional after every MUST passes.

The implementation agent MUST:

1. Inspect repository instructions, working tree, package manager, sibling conventions, and existing design/UX contracts before editing.
2. Read applicable `AGENTS.md` files and preserve unrelated user work.
3. Invoke `frontend-design` and `frontend-design-premium` before substantial UI work when available.
4. Create and maintain `DESIGN.md`, `UX-CONTRACT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `.env.example`, `README.md`, and `VERIFICATION.md` unless maintained equivalents exist.
5. Use one runtime design-token owner mapped to `DESIGN.md`.
6. Build a working explanatory vertical slice before live search, live ledger, or polish.
7. Implement a genuine persisted backend; the browser must not invent discovery, purchase, or dossier evidence.
8. Make fixture mode work without network, LLM key, seed, publisher account, or scraping.
9. Separate LLM planning/synthesis from deterministic budget, access, ranking, citation, and payment enforcement.
10. Verify the full flow in a real browser at desktop and 390 px, including failures and reduced motion.
11. Clearly label fixture, live-source, live-LLM, recorded-Testnet, and live-Testnet evidence.
12. Never imply synthetic premium text is real journalism, metadata includes full text, a fixture payment paid a real publisher, or Testnet XRP has fiat value.
13. Continue until §23 passes.

---

## 1. Mission and product thesis

Elena gives the agent a question, audience, source policy, and S$2 research budget. The agent searches a local corpus of free primary sources, open reporting, duplicate rewrites, and paid offers. It clusters candidates by evidentiary origin, forms a preliminary thesis, identifies an unresolved grid-capacity gap, and decides where money can most defensibly improve the dossier.

The agent buys a high-authority S$0.20 wire report for independent corroboration, skips a S$0.30 newsletter because it duplicates that report, and buys a S$0.80 premium investigation because its preview directly addresses the unresolved gap. The unlocked evidence materially changes the conclusion. It wants a S$1.40 specialist report but deterministically blocks purchase because only S$1 remains.

```text
Question + S$2 mandate
  → 12 candidates found
  → duplicates cluster into independent evidence families
  → preliminary thesis from open sources
  → gap: grid capacity and interconnection lead times
  → buy S$0.20 Northstar Wire
  → skip S$0.30 redundant Circuit Note
  → buy S$0.80 Meridian investigation
  → conclusion becomes more cautious and specific
  → block S$1.40 GridScope because S$1 remains
  → publish source-linked dossier and receipt
```

### Product promise

> ResearchAgent turns a research budget into the strongest evidence dossier it can buy—and pays for premium evidence instead of pretending all information is free.

The scarce resources are attention and money. The stopping principle is: stop when expected marginal evidence value is below marginal cost, or the mandate forbids the purchase.

This is not paywall bypass, generic chat, a claim that price equals truth, an invented confidence gauge, or a reason to buy every prestigious source.

---

## 2. Self-explaining demo gate

Opening `/demo` or `/` MUST show a populated brief with one dominant **Run research** action. No login, setup wizard, API-key modal, or blank chat.

Within ten seconds the first viewport must show:

1. Elena is preparing an investment-committee brief.
2. The exact 2028 data-centre question.
3. S$2 total; trusted sources at or below S$1 may auto-buy; sources above S$1 are blocked under the canonical mandate.
4. The agent’s job is to find gaps and allocate budget, not maximize article count.
5. Free/open and individually priced premium evidence coexist.
6. The outcome is a one-page dossier whose claims trace to independent sources.

Include the headline **“What evidence is worth buying before the committee meets?”**, question, audience, mandate, budget ledger, persistent mode badge, primary action, and “Why this needs an agent” disclosure. Do not lead with blockchain.

### Guided phases

- **Brief**
- **Discover**
- **Read open evidence**
- **Find gaps**
- **Allocate budget**
- **Synthesize**
- **Dossier**

Provide **Next step**, **Back to evidence**, **Pause**, **Resume**, **Replay research**, and **Reset research**. These call the same backend transitions as manual controls. Cancellation must preserve completed purchases.

### Modes

- `FIXTURE RESEARCH`: mandatory, deterministic local corpus and fixture LLM, no credentials/network.
- `LIVE LLM`: OpenAI or Groq for bounded planning/explanation/synthesis.
- `LIVE SOURCES`: optional allowlisted public metadata APIs; graceful fallback.
- `RECORDED TESTNET`: immutable evidence from a prior validated transaction.
- `LIVE · XRPL TESTNET`: verified Testnet settlement before fixture full-text unlock.

---

## 3. User, brief, and mandate

Elena is a Singapore-based analyst who understands claims, filings, and contradiction but does not want model chain-of-thought or a chat wall. She must see what changed after each purchase.

```text
Audience: Investment Committee
Question: Is the AI data-centre investment boom sustainable through 2028?
Deliverable: evidence-backed one-page dossier
Budget: S$2.00
Auto-buy: trusted sources priced at or below S$1.00
Above S$1.00: block in canonical demo
Prefer: filings, government data, independent wire reporting,
        reputable financial journalism, specialist infrastructure research
Avoid: anonymous sources and unclear provenance
Stop: when another purchase is unlikely to change a major claim,
      resolve a key gap, or independently corroborate it
```

```ts
type ResearchMandate = {
  mandateId: string;
  version: number;
  researchRunId: string;
  totalBudgetSgdCents: 200;
  autoBuyMaxPerSourceSgdCents: 100;
  sourceAboveThreshold: 'BLOCK';
  allowedResourceKinds: ('ARTICLE' | 'REPORT' | 'DATASET_QUERY')[];
  prohibitedSourceFlags: ('ANONYMOUS' | 'MALWARE_RISK' | 'TERMS_UNKNOWN')[];
  preferredSourceClasses: string[];
  maxSourcesPerPublisher: number;
  expiresAt: string;
};
```

Use integer minor units. The model cannot amend this mandate.

---

## 4. Falsifiable product hypotheses

### H1 — Agent planning is necessary

Purchases change with question, gaps, overlap, trust, price, and remaining budget. A fixed slideshow fails.

### H2 — Paid evidence adds visible marginal value

Unlocking must add support, contradiction, or specificity absent from previews/open sources; the evidence graph and dossier diff must change.

### H3 — Source count is not independence

One original report plus five rewrites counts as one evidence root. Raw citation-count confidence fails.

### H4 — Budget authority is deterministic

The S$1.40 report remains blocked with S$1 left even if model output says BUY.

### H5 — Payment unlocks one exact resource

Before settlement only metadata/preview/terms are visible. Wrong invoice, amount, payee, resource, or replay fails.

### H6 — Claims are grounded

Every material claim links to exact accessible evidence spans. Removing a source weakens dependent claims on regeneration.

### H7 — Explain without chain-of-thought

Expose evidence features, score components, reason codes, and short rationale—never private reasoning tokens.

---

## 5. Scope

### Mandatory MVP

- Prefilled but editable research brief.
- Budget presets: S$0 Open Web, S$1 Analyst, S$2 Committee Brief; S$2 is canonical.
- Local corpus of at least 12 candidates.
- Free/paid, high/medium/low trust, original/derivative, supportive/contradictory examples.
- Premium body separated from public metadata/preview.
- Deterministic normalization, tag matching, BM25/TF-IDF retrieval, and evidence-family clustering.
- Optional semantic ranker with tested deterministic fallback.
- Evidence gaps and budget-aware purchase utility.
- Buy, skip, defer, and blocked outcomes.
- Protected local publisher resources.
- Fixture payment and optional Testnet adapter.
- Evidence graph and claim-level citations.
- Fixture synthesis plus OpenAI/Groq provider support.
- Persisted runs and SSE event stream.
- Desktop/mobile UI and automated verification.

### Desired after mandatory completion

- Crossref, Semantic Scholar, and SEC/EDGAR metadata adapters.
- Precomputed embeddings plus optional local MiniLM runtime.
- Live XRPL Testnet and recorded evidence.
- Print/PDF output.
- S$0 vs S$2 dossier comparison.

### Out of scope

- Scraping/bypassing real paywalls.
- Redistributing copyrighted articles.
- User subscription credentials.
- General crawling, production investment advice, trading, team admin, hosted vector DB, or mainnet spending.
- Fake FT/Reuters article bodies or claims that authority guarantees truth.

---

## 6. Fixture content and trust posture

The guaranteed corpus is locally owned fixture content. Premium bodies must be original synthetic text, clearly attributed to fictional publishers. Real public organizations or datasets may appear only when openly available and accurately represented.

Use these fictional publishers:

- **Northstar Wire** — S$0.20 independent wire report.
- **The Meridian Ledger** — S$0.80 premium investigation.
- **GridScope Asia** — S$1.40 specialist infrastructure report.
- **Circuit Note** — S$0.30 low-authority newsletter heavily overlapping Northstar.

Do not imply these are Financial Times, Reuters, or Bloomberg. Each document carries `fixture: true`, access tier, license/provenance, and source-family metadata. Premium bodies should be substantive enough for claim extraction but remain server-only.

---

## 7. Technology and run contract

For greenfield, prefer Node 20+, strict TypeScript, React/Vite, Fastify or Express, Zod, SQLite with migrations, Vitest, Playwright, axe, the OpenAI JavaScript SDK behind a provider adapter, optional Transformers.js in a backend worker, and optional server-only `xrpl`.

Do not add LangChain, a hosted vector DB, Elasticsearch, headless browser, or crawler for the mandatory demo.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` starts frontend/backend, prints URLs, migrates/seeds idempotently, and defaults to fixture mode. Provide `build`, `typecheck`, `lint`, `test`, `test:e2e`, `test:a11y`, `seed`, and `verify` scripts.

```dotenv
APP_MODE=fixture
PORT=8788
PUBLIC_APP_URL=http://localhost:5173
DATABASE_URL=file:./data/research-agent.db

LLM_PROVIDER=fixture
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
LLM_TIMEOUT_MS=30000

SEMANTIC_RANKER=precomputed
TRANSFORMER_MODEL=Xenova/all-MiniLM-L6-v2
TRANSFORMER_CACHE_DIR=./.cache/transformers

LIVE_SOURCE_ADAPTERS=none
CROSSREF_MAILTO=
SEMANTIC_SCHOLAR_API_KEY=
SEC_USER_AGENT=

XRPL_MODE=fixture
XRPL_NETWORK=testnet
XRPL_RPC_URL=wss://s.altnet.rippletest.net:51233
XRPL_PAYER_SEED=
```

Normalize `OPENAI_API_KEY`, `GROQ_API_KEY` plus Groq base URL, and generic `LLM_*` variables server-side. No secret may use a `VITE_` prefix or reach the client.

---

## 8. Architecture and boundaries

```text
React Research Desk
  │ REST + SSE
  ▼
ResearchAgent API
  ├─ BriefService / QueryPlanner
  ├─ SourceRegistry / DiscoveryAdapters
  ├─ RetrievalEngine (tags + BM25 + semantic)
  ├─ IndependenceClusterer / EvidenceGraph
  ├─ GapAnalyzer / PurchasePlanner / BudgetGuard
  ├─ PublisherGateway (protected local resources)
  ├─ LedgerAdapter (fixture | recorded | xrpl-testnet)
  ├─ ClaimExtractor / CitationVerifier / DossierSynthesizer
  ├─ LlmProvider (fixture | openai-compatible)
  └─ EventStore / SQLite
```

- `QueryPlanner` emits normalized terms, entities, horizon, subquestions, and tags with a deterministic fallback.
- `RetrievalEngine` uses only data accessible at the current tier; hidden premium text cannot affect pre-purchase rank.
- `IndependenceClusterer` combines explicit fixture lineage and labelled similarity inference.
- `GapAnalyzer` tracks unresolved questions, not a single confidence number.
- `PurchasePlanner` estimates marginal value from metadata/preview and proposes buy/skip/defer.
- `BudgetGuard` owns integer budget, threshold, quote, payee, resource, expiry, and replay checks.
- `PublisherGateway` protects premium bodies and grants exact-resource access after verified settlement.
- `DossierSynthesizer` receives a bounded evidence packet; `CitationVerifier` rejects unsupported source/span IDs.

---

## 9. Domain records

Use shared runtime schemas for:

- `ResearchBrief`: question, audience, deliverable, horizon, locale/timezone, mandate, mode.
- `SourceOffer`: ID, fictional/real publisher, title, date, kind, access tier, price cents, preview, tags, entities, authority, originality, family, citations, payee, destination, hash, quote expiry, fixture marker.
- `RetrievalScore`: lexical, semantic, tag/entity, recency, authority, gap, independence, redundancy, price-independent total, ranker version, access fields used.
- `EvidenceFamily`: root, members, lineage confidence, independent count, asserted vs inferred relationship.
- `EvidenceGap`: question, importance, state, related claims, missing evidence, resolution conditions.
- `PurchaseDecision`: action, value components, price, budget before/after, reason codes, mandate/preview hashes, model provenance, guard result.
- `AccessGrant`: resource, invoice, settlement, grant time, content hash, expiry, evidence mode.
- `Claim`: text, supports/challenges/context/uncertain, materiality, evidence spans, independent-family count, contradictions, validation.
- `Dossier`: conclusion, paid-evidence change, claims, uncertainties, methodology, budget/source ledgers, limitations.

Premium text MUST live in a server-only store excluded from the frontend bundle.

---

## 10. State machine and invariants

```text
DRAFT → PLANNING → DISCOVERING → RANKING → READING_OPEN
  → PRELIMINARY_THESIS → GAP_ANALYSIS → PURCHASE_PLANNING
  ↔ PURCHASED / SKIPPED / DEFERRED / BLOCKED
  → CLAIM_EXTRACTION → SYNTHESIZING → VERIFYING_CITATIONS
  → DOSSIER_READY
```

Support partial-source failure, LLM fallback, payment unknown/rejected, paid-resource unavailable, citation failure, and cancelled states.

Invariants:

1. Budget never becomes negative; all amounts use integer cents.
2. Invoice/resource settles once.
3. Above-threshold source is blocked in canonical mode.
4. Hidden premium text never affects pre-purchase decisions.
5. Purchased does not imply trusted, independent, or supportive.
6. Derivative sources do not add independent corroboration.
7. Every citation resolves to an accessible stored span.
8. Invented model source IDs are rejected.
9. Settlement and content delivery are distinct.
10. Reset removes fixture runs only, not recorded/live evidence.
11. Cancellation does not refund or erase completed purchases.

---

## 11. Canonical corpus decisions

Seed at least 12 sources. These are mandatory:

- Company capex statement: open, primary for company plans, high relevance, not independent validation.
- Public energy/interconnection dataset: open, primary data, contextual/challenging, lagged/incomplete.
- Industry blog: open, medium authority, derivative of company statement.
- Northstar Wire: S$0.20, high authority/relevance, independent supplier comments, BUY.
- Circuit Note: S$0.30, lower authority, ≥80% overlap/lineage with Northstar, SKIP redundant.
- Meridian Ledger: S$0.80, high authority/relevance, grid-operator/developer interviews, BUY; changes conclusion.
- GridScope Asia: S$1.40, high specialist value, BLOCK because S$1 remains.

Canonical ledger:

```text
Start                         S$2.00
Northstar Wire               -S$0.20  purchased
Circuit Note                  S$0.00  skipped · redundant
The Meridian Ledger         -S$0.80  purchased
Remaining                     S$1.00
GridScope Asia                S$1.40  blocked · exceeds remaining
Total spent                   S$1.00
```

---

## 12. Retrieval and ranking

### Query plan

Normalize Unicode/case/tokens while preserving source display text. Extract entities, year, technology, geography, and thesis terms. Canonical subquestions:

1. What demand and capex commitments support buildout?
2. What power and interconnection constraints limit delivery?
3. Which semiconductor, cooling, construction, and financing constraints matter?
4. What challenges the assumption that announced capex becomes operating capacity by 2028?
5. Which sources are independent?

### Lexical and tag ranking

Implement BM25 or tested TF-IDF/BM25. Persist fixture document statistics and keep raw plus normalized scores. Use weighted tag/entity overlap; entity matches outweigh generic tags. Gap-specific tags gain relevance only after that gap is active.

### Minimal semantic ranker

Preferred optional implementation: Transformers.js feature extraction with a compact sentence transformer such as `Xenova/all-MiniLM-L6-v2`, mean pooling, normalized embeddings, cosine similarity, backend/worker execution, caching, bounded concurrency.

For offline reliability, commit precomputed embeddings for fixture documents and canonical query/subquestions with model/version and generation script. If a model is unavailable for an arbitrary query, fall back to lexical+tags and expose `semanticStatus: 'unavailable'`. Never label another score semantic.

### Combined score

```text
retrievalScore =
  0.34 × semanticSimilarity
  + 0.24 × bm25Normalized
  + 0.14 × tagEntityMatch
  + 0.10 × gapMatch
  + 0.08 × authorityPrior
  + 0.05 × recency
  + 0.05 × independencePotential
  - redundancyPenalty
```

Renormalize weights if semantic is unavailable. Authority is a prior, not truth. Price never affects relevance; it affects purchase utility.

Fixture `evidenceFamilyId` and `citesSourceIds` are ground truth. Similarity relationships are labelled inferred. Distinguish **12 sources found** from **6 independent evidence families**.

---

## 13. Evidence gaps and purchase utility

Show major claims supported, independently corroborated claims, contradictory claims represented, unresolved gaps, premium sources purchased, and budget spent—not an arbitrary “89% AI confidence.”

Canonical open-web gap:

> Independent reporting on grid-connection lead times and whether announced data-centre capacity can become operational by 2028.

Northstar partly addresses it; Meridian materially addresses and complicates it; GridScope remains desirable but blocked.

Use a versioned, inspectable starting formula:

```text
expectedEvidenceValue =
  0.24 × gapMatch
  + 0.18 × semanticRelevance
  + 0.16 × authorityPrior
  + 0.16 × expectedNovelty
  + 0.12 × independencePotential
  + 0.10 × contradictionPotential
  + 0.04 × recency
  - 0.20 × redundancyRisk
  - 0.10 × provenanceRisk

utilityPerCent = expectedEvidenceValue / max(priceSgdCents, 1)
```

Document that this is a demo heuristic, not objective truth. Before BUY, deterministic code checks resource kind, prohibited flags, unchanged/unexpired quote, remaining budget, auto-buy threshold, payee binding, and replay.

---

## 14. LLM provider and grounding contract

Implement a server-side `LlmProvider.generateStructured` supporting `expand_query`, `summarize_open_evidence`, `identify_gaps`, `explain_purchase`, `extract_claims`, and `synthesize_dossier`.

Support OpenAI, Groq through `https://api.groq.com/openai/v1`, a generic OpenAI-compatible endpoint, and deterministic fixture provider. Prefer the common Chat Completions subset unless current integration tests prove Responses compatibility on both selected providers. Do not depend on hosted provider search/tools.

- Use JSON Schema structured output when supported.
- Validate all output with Zod.
- Otherwise use JSON mode, validate, and allow at most one repair.
- Store schema version, provider, model, and latency.
- On timeout/invalid output, use deterministic templates.
- Never parse prose to approve payment.

Synthesis receives only accessible source IDs/spans, metadata/families, claims/gaps/contradictions, and purchase ledger. Output citations as source ID plus span ID. Reject missing/inaccessible spans. Unsupported claims are omitted from the executive conclusion or shown as unresolved.

The model may plan, summarize accessible evidence, propose gaps, estimate qualitative novelty, explain decisions, extract claims, and draft grounded prose. It must not read hidden premium text, change budget, approve payment, invent sources/quotes/prices, count derivatives as independent, receive secrets, present fixtures as real, or give trading instructions.

---

## 15. Publisher and payment contracts

The local publisher gateway exposes metadata, preview, price cents, payee/destination, resource ID, quote hash/expiry, and fixture marker. A protected content endpoint returns payment-required without leaking answer-bearing premium facts.

After exact settlement it issues a run/resource-bound access grant, returns full fixture text plus hash/license, records delivery, and rejects other invoices/runs/replays. Add a changed-price/payee negative fixture that forces re-evaluation.

Fixture payment is mandatory and clearly labelled. Optional live XRPL Testnet must use a server-only signer, exact bindings, integer conversion, expiry/`LastLedgerSequence`, immediate pre-sign guard, submit-and-wait, and independent verification of `validated: true`, `tesSUCCESS`, destination, delivered amount, and invoice. Unknown finality remains unknown. The UI must state Testnet XRP has no S$ equivalence.

---

## 16. API contract

Suggested versioned routes:

```text
GET    /api/health
GET    /api/v1/config/public
GET    /api/v1/scenarios/data-centre-2028
POST   /api/v1/research-runs
GET    /api/v1/research-runs/:runId
POST   /api/v1/research-runs/:runId/reset
POST   /api/v1/research-runs/:runId/step
POST   /api/v1/research-runs/:runId/cancel
GET    /api/v1/research-runs/:runId/events
GET    /api/v1/research-runs/:runId/stream
POST   /api/v1/research-runs/:runId/plan
POST   /api/v1/research-runs/:runId/discover
POST   /api/v1/research-runs/:runId/rank
POST   /api/v1/research-runs/:runId/gaps
GET    /api/v1/research-runs/:runId/sources
GET    /api/v1/research-runs/:runId/sources/:sourceId
POST   /api/v1/research-runs/:runId/purchase-decisions
POST   /api/v1/research-runs/:runId/purchases
GET    /api/v1/research-runs/:runId/purchases/:purchaseId
POST   /api/v1/research-runs/:runId/synthesize
GET    /api/v1/research-runs/:runId/dossier
GET    /api/v1/research-runs/:runId/receipt
```

Every mutation uses `Idempotency-Key`, validates aggregate version, returns typed errors, and has stable fixture/live shapes. Search and ranking cancel or ignore stale responses. SSE includes IDs, heartbeat, reconnect via `Last-Event-ID`, and terminal events.

---

## 17. Dossier and citation contract

The final product is a dossier, not a chat transcript. It must include:

1. **Headline conclusion** — concise and calibrated.
2. **What changed after paid research** — explicit before/after thesis diff.
3. **Supports the thesis** — material claims with independent-family counts.
4. **Challenges the thesis** — contradictions visible, not buried.
5. **Key uncertainty** — unresolved gap.
6. **Evidence coverage** — calculated claims supported/corroborated, not an opaque score.
7. **Source ledger** — access tier, amount, authority/originality, family, and access time.
8. **Method and limitations** — short, honest, and printable.

Canonical progression:

**Open web:** “Announced demand and capital commitments support continued expansion, but the evidence is concentrated in company statements and does not resolve power-delivery constraints.”

**After Northstar:** “Independent supplier reporting corroborates near-term demand while adding equipment-delivery bottlenecks.”

**After Meridian:** “The boom can continue, but operating capacity through 2028 is likely to lag announced spending in grid-constrained markets; interconnection and power availability are more material risks than the open-source baseline suggested.”

Label all of this fixture research, not investment advice.

Inline citations open exact spans in the evidence drawer. Derivatives collapse under one family. Premium citations show purchase/access state. Blocked previews cannot be cited as read. Print preserves citations, source list, and limitations.

---

## 18. UI direction — Financial Research Trace Desk

### 18.1 Experience thesis

The product should feel like **a calm financial newsroom for an evidence market**: clean, authoritative, text-led, precise, and original. It should carry the reading discipline of respected financial journalism without cloning any publication.

Follow Prompt 1 only:

- warm ivory paper on deep charcoal shell;
- hairline rules and low-radius rectangles;
- restrained serif display;
- legible sans body/control type;
- mono labels for prices, scores, timestamps, IDs;
- mostly charcoal/ivory;
- labelled green/amber/red semantics;
- minimal shadow;
- no glass, generic blue SaaS, oversized gradients, floating-pill overload, or decorative charts.

### 18.2 Visual tokens

Seed and browser-test this system:

```text
Newsprint            #F2E9DD  main canvas
Paper                #FBF8F2  reading surfaces
Ink                  #24211E  body text
Charcoal             #171716  shell/header
Muted ink            #6F6860  secondary text
Rule                 #C9BFB2  dividers
Editorial salmon     #D9A28F  restrained selection/accent
Evidence green       #2F6B4F  supporting/verified
Caution ochre        #9A6B20  unresolved/deferred
Block red            #9B3E35  blocked/challenging/danger
```

Editorial salmon supports the template; it is not a copy of any publication’s brand system.

- Headlines/conclusions: **Newsreader** or inspected editorial serif equivalent.
- Body/UI: **Source Sans 3** or equivalent.
- Evidence/price/time/IDs: **IBM Plex Mono**.
- Serif is for headlines and dossier prose; controls remain sans/mono.
- Self-host/package fonts when feasible and prevent font-swap layout shift.
- Radius 0–4 px, hairline structure, shadows only for overlays.
- Use editorial sections, not a card around every paragraph.

### 18.3 Signature: Evidence Trace Desk

Adapt the template’s trace desk into a horizontal lineage ribbon linking question → subquestions → evidence families → purchases → claims.

It must show free evidence entering first, duplicates merging, an unresolved grid gap, Northstar adding an independent branch, Circuit terminating at `SKIPPED · REDUNDANT`, Meridian connecting to the changed conclusion, GridScope terminating at `BLOCKED · BUDGET`, and final claims fed by exact families.

Use inline SVG/CSS with direct labels. Clicking a node filters/highlights the source list and opens evidence. Meaning cannot depend on animation or color.

### 18.4 Desktop composition

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ RESEARCHAGENT / COMMITTEE BRIEF  FIXTURE RESEARCH  S$1.00 / S$2.00         │
├────────────┬────────────────────────────────────────────┬────────────────────┤
│ Phase rail │ Question + current thesis                  │ Research mandate   │
│            ├────────────────────────────────────────────┤ Budget ledger      │
│            │ Evidence Trace Desk                        │ Gap summary        │
│            ├──────────────────────────┬─────────────────┤                    │
│            │ Candidate source desk    │ Source preview  │                    │
│            ├──────────────────────────┴─────────────────┤                    │
│            │ Dossier / before-after conclusion          │                    │
├────────────┴────────────────────────────────────────────┴────────────────────┤
│ Event ledger / sources / independent families / current action               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The page may scroll like a reading surface. Evidence drawers own internal scroll. Do not impose table viewport sizing on the dossier.

### 18.5 Components

**Header:** product, dossier title, mode, provider/source state, raw/family counts, budget, pause/cancel, reset, receipt.

**Research brief:** labelled auto-growing textarea, accessible budget selector, audience preset, concise policy. Canonical brief is ready to run. Advanced mandate belongs in a disclosure/drawer.

**Candidate source desk:** semantic desktop table/list with publisher, access/price, relevance, authority, originality/family, gap match, novelty, decision, and reason. Use high/medium/low labels; numeric components live in detail. Skipped/blocked remain inspectable.

**Preview panel:** before purchase, only metadata, preview, expected value, price, and limitations. After purchase, show clearly labelled synthetic text and highlighted evidence spans.

**Budget ledger:** a textual causal ledger, not a donut chart. Show every debit/skip/block and remaining authority.

**Dossier:** newspaper-like reading column with serif headline, sans annotation, hairline sections, evidence callouts, and source-linked markers. Include a prominent “What changed after paid evidence” diff.

**Evidence drawer:** exact metadata, access state, spans, lineage, retrieval/utility components, payment, content hash/license, limitations. Citation opens and focuses the target span; close restores focus.

### 18.6 Mobile at 390 px

Reorder: compact header → question/status → budget → active gap → vertical evidence lineage → current decision → editorial source cards → dossier → evidence sheet.

No horizontal page clipping. Preserve price, access, decision, family, reason, and citations. Dossier is single-column. Sticky actions cannot cover content/focus.

### 18.7 Copy and motion

Use sober, editorial, specific copy. Say “Skipped because it repeats Northstar Wire” and “Blocked: S$1.40 exceeds the remaining S$1.00.” Never say truth score, guaranteed confidence, or premium means accurate; never mention bypassing paywalls.

Use one evidence-ribbon transition when a purchase adds a branch. Streaming can reveal prose, but citations are valid only after complete structured verification. Control transitions 120–220 ms. Reduced motion removes travel/pulse. Never simulate work with arbitrary sleeps; progress maps to backend stages.

---

## 19. Accessibility, streaming, and resilience

Target WCAG 2.2 AA.

- Native buttons, links, headings, tables, fields, and citation controls.
- Visible focus and complete hover/active/disabled/busy states.
- `noValidate`, associated error text, first-invalid focus.
- Textarea `resize: none` with adequate auto-grow.
- Explicit clear control and IME-safe input.
- Cancel/stale-safe remote requests.
- SSE with IDs, heartbeat, reconnect, and terminal states.
- **Stop research** while active; no auto-scroll trap when the reader scrolls up.
- Announce phase, purchase, block, failure, and completion—not every token.
- App-owned dialog/sheet; no browser `alert`/`confirm`/`prompt`.
- Text/icon plus color for all states.
- Visible global scrollbar and stable geometry.
- Long content wraps/truncates with non-hover access.
- Honest `document.title` and printable dossier.

Required states: ready; validation error; discovering/ranking/reading/synthesizing; slow/failed LLM with fallback; partial live source failure; semantic unavailable; no results; no premium sources; buy/skip/defer/block; changed quote/payee; payment pending/unknown/failed/settled; paid resource unavailable; citation failure; cancelled/resumable; dossier ready; offline/reconnected; every evidence mode; reduced motion; mobile menu/sheet.

---

## 20. Optional live public-source adapters

Optional adapters enrich metadata but never gate the canonical demo.

- **Crossref:** metadata only; use polite identification/`mailto`, cache, select minimal fields, back off, and never infer full-text rights from metadata.
- **Semantic Scholar:** official Academic Graph API, documented fields/key/rate limits; citation count is not an authority score.
- **SEC/EDGAR:** official APIs, descriptive User-Agent, cache/rate-limit; filings are primary issuer evidence, not independent analysis.

Allowlist hosts and fixed URL templates—no arbitrary server-side fetch. Apply timeout, bounded retry/jitter, circuit breaker, and cache fallback. Label metadata-only/full-text. Missing authority/originality remains `UNKNOWN`. Live results do not alter the stable fixture run unless the user explicitly selects live sources.

---

## 21. Security and abuse resistance

Threats: prompt injection in sources, SSRF, malicious URLs, premium-body leakage, fabricated citations, changed price/payee, overspend/replay, secret leakage, raw LLM HTML/XSS, fixture misrepresentation, and copyright misuse.

Controls:

- Treat source text as untrusted quoted data, never instructions.
- Allowlisted egress/adapters; no arbitrary URL fetch.
- Premium bodies and payment secrets server-only.
- Zod at all boundaries; integer budget arithmetic.
- Quote hashes and immediate pre-sign validation.
- Unique invoice/resource/idempotency constraints.
- Citation allowlist against accessible evidence.
- Escape text; no unsanitized model HTML.
- CSP/secure headers where feasible.
- Redact secrets, sensitive prompts, and premium bodies from logs.
- Preserve provenance/license and evidence-mode labels.

---

## 22. Test and milestone contract

### Tests

Unit-test normalization, canonical subquestions, BM25 ordering, tag/entity overlap, cosine/fallback renormalization, clustering, redundancy, gaps, utility, budget boundaries, quote/payee diff, state transitions, citation spans, family counts, fixture determinism, and content separation.

Retrieval golden tests must prove grid sources map to the grid subquestion, Northstar outranks Circuit after redundancy/authority, Meridian has high gap match, family count is lower than raw count, rank is stable for a version, and semantic fallback remains coherent.

Integration-test full fixture API, pre-purchase protection, exact-resource unlock, wrong amount/destination/invoice/replay, hidden-body isolation, GridScope block even when planner says BUY, Circuit skip from real overlap/lineage, LLM invalid/timeout fallback, source partial failure, rejected invented citation, settlement without delivery, cancel/resume/SSE reconnect, and reset preservation.

E2E-test the S$2 full flow, S$0 no-purchase dossier, all canonical buy/skip/block outcomes, citation focus/restore, LLM/semantic fallback, delivery failure, pause/cancel/resume, keyboard-only, desktop, and 390 px.

Run axe on ready, source list, decision, blocked, dossier, drawer, mobile sheet, and errors. Manually verify focus, announcements, reduced motion, 200% zoom, print, long content, and color-independent meaning.

Capture desktop ready/baseline/gap/buy/skip/conclusion-change/block/dossier/drawer and mobile ready/purchase/dossier plus reduced-motion screenshots.

### Milestones

0. Inspect and create design/UX/architecture/security/verification contracts.
1. Write original fixture corpus, schemas, migrations, and server-only premium store.
2. Implement deterministic query, BM25/tags, clustering, gaps, and golden tests.
3. Implement utility, guard, publisher gateway, access grants, and negative tests.
4. Complete full fixture API run and persistence without UI.
5. Build the Research Trace Desk and bind every control.
6. Add fixture/OpenAI/Groq providers and deterministic fallbacks.
7. Add precomputed embeddings, optional MiniLM runtime, and offline fallback.
8. Complete fixture payment; add Testnet only after it is honest and verified.
9. Finish state matrix, responsive/a11y/print/security/visual QA.
10. Run verification, comprehension review, and timed rehearsal.

Do not begin optional APIs/PDF/sponsor depth before the fixture dossier is causally complete.

---

## 23. Demo, definition of done, and references

### Three-minute demo

- **0:00–0:20:** Elena’s question, committee audience, and S$2 mandate.
- **0:20–0:50:** 12 sources, six families, open-web thesis, grid-capacity gap.
- **0:50–1:15:** buy Northstar S$0.20; skip redundant Circuit S$0.30.
- **1:15–1:45:** buy Meridian S$0.80; show evidence branch and changed conclusion.
- **1:45–2:05:** block GridScope S$1.40 because S$1 remains.
- **2:05–2:40:** open dossier, contradiction, uncertainty, and one exact citation span.
- **2:40–3:00:** show S$1 spent/S$1 remaining and receipt; end: “It buys the evidence most likely to improve the answer—and pays the people who produced it.”

### Judge-ready answers

- **Paywall bypass?** No; publishers offer priced resources, and the demo uses original fixtures unlocked by exact payment.
- **Why agent?** The plan changes with gaps, novelty, independence, contradiction, cost, and remaining options.
- **Does expensive mean true?** No; price is separate from authority, originality, and claim evidence.
- **Why XRPL?** It can be a common machine settlement rail; it does not determine truth or delivery.
- **What does the LLM do?** Bounded planning, summarization, explanation, extraction, and prose; deterministic code owns access, budget, payment, identity, and citations.
- **Hallucinated citation?** The server rejects any source/span outside accessible evidence.
- **Why fictional publishers?** Reliable demo, no scraping or copyright ambiguity, realistic adapter/market behavior.

### Strict definition of done

ResearchAgent is done only when:

1. A clean checkout starts with documented commands.
2. Frontend plus real backend run locally; no-key fixture completes.
3. Initial viewport explains user, question, mandate, agent job, and outcome.
4. At least 12 fixtures have access, trust, originality, and provenance.
5. Premium body is absent from public assets and unavailable before purchase.
6. Query/tag/BM25 retrieval is implemented and tested.
7. Semantic rank is functional/precomputed or honestly unavailable with fallback.
8. Raw source and independent-family counts differ correctly.
9. An evidence gap drives purchase utility.
10. Northstar is bought for independent marginal value.
11. Circuit is skipped from tested redundancy.
12. Meridian adds evidence and materially changes the conclusion.
13. GridScope is blocked because S$1.40 exceeds S$1 remaining.
14. Budget cannot go negative or be bypassed by the model.
15. Wrong/stale quote, payee, amount, invoice, and replay are rejected.
16. Settlement and delivery are separate.
17. Every material claim resolves to exact accessible spans.
18. Derivatives do not inflate corroboration.
19. OpenAI and Groq share one documented compatible adapter.
20. Invalid/timeout LLM output falls back cleanly.
21. Evidence modes cannot be confused.
22. Every visible control works.
23. Desktop and 390 px are complete/unclipped.
24. Keyboard, focus, reduced motion, announcements, 200% zoom, axe, and print pass.
25. Unit, golden, integration, E2E, lint, typecheck, build, and verify pass.
26. Errors cover LLM, semantic, source, block, payment uncertainty, and delivery failure.
27. Guided fixture run records reliably in 60–90 seconds; full demo under three minutes.
28. `VERIFICATION.md` records current evidence and limitations.

A beautiful newspaper shell without a backend is not done. Streaming prose with decorative citations is not done. A fixed purchase slideshow is not done. Leaked premium content is not done. Citation count treated as truth is not done. Fixture publishers/payments represented as real are disqualifying.

### Expected deliverables

```text
GOAL.md  README.md  PRODUCT.md  ARCHITECTURE.md  DESIGN.md
UX-CONTRACT.md  SECURITY.md  VERIFICATION.md  .env.example
premium-ui.json  src/  server/  fixtures/  scripts/  tests/
evidence/  verification/
```

README must get a judge into fixture mode within five minutes and explain fixture/OpenAI/Groq switching. `VERIFICATION.md` records date, working-tree identity, commands/results, modes, corpus/ranker versions, screenshots, accessibility, Testnet evidence, and limitations—never secrets or proprietary bodies.

### Current reference map

- Local visual source: `archive/website-template/observability-design-prompts.md`, Prompt 1
- Product source: `tftf/prototypes/ideas.txt`, Idea 3
- Contract example: `tftf/prototypes/Faircut/GOAL.md`
- Groq compatibility/API: <https://console.groq.com/docs/overview> and <https://console.groq.com/docs/api-reference>
- OpenAI API/structured output: <https://developers.openai.com/api/docs/> and <https://developers.openai.com/api/docs/guides/structured-outputs>
- Transformers.js: <https://huggingface.co/docs/transformers.js/> and <https://huggingface.co/docs/transformers.js/api/pipelines>
- Crossref REST/access: <https://www.crossref.org/documentation/retrieve-metadata/rest-api/> and <https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/>
- Semantic Scholar API: <https://api.semanticscholar.org/api-docs>
- SEC EDGAR APIs: <https://www.sec.gov/search-filings/edgar-application-programming-interfaces>
- XRPL payments/reliability/Testnet: <https://xrpl.org/docs/tutorials/payments/send-xrp>, <https://xrpl.org/docs/concepts/transactions/reliable-transaction-submission>, <https://xrpl.org/docs/tutorials/public-servers>
- t54 ARS/Trustline and ClawCredit: <https://docs.t54.ai/docs/research/agentic-risk-standard>, <https://www.t54.ai/docs/trustline/overview>, <https://www.claw.credit/docs/overview>

Re-check live technical behavior before implementation. Preserve product/security invariants when APIs evolve; update adapters, tests, and documentation together. Never infer access rights from metadata availability.
