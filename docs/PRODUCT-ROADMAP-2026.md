# ResearchAgent development plan for October 10

Updated 2 October 2026. This plan targets the AI Tinkerers Singapore
demonstration on Saturday, 10 October 2026. It supersedes the October 1
milestone and old post-October deployment sequencing. Those dates do not
constrain this work. Planned capabilities are not implementation claims.

The [team manifesto](DEMO-MANIFESTO.md) states the product direction. The
[implementation plan](plans/october-10/README.md) owns issue boundaries,
acceptance criteria, dependencies, and exclusions. Its shared interfaces and
module contracts are authoritative for October 10 implementation. This roadmap
owns priorities, sequencing, and research behind optional choices.

Build an evidence-acquisition system whose decisions can be tested: research
from open material, identify what is missing, decide whether another source
is worth its price, acquire it through a real publisher API boundary, and
show exactly how it affected the answer. Add a thin verification loop alongside
the first complete product flow; grow coverage as each boundary is implemented.

The showcase should prove three things:

1. A missing fact in purchased evidence changes a supported conclusion.
2. Repeated reporting or a higher price causes the agent to decline a purchase.
3. Interrupted settlement or failed delivery recovers without a second charge.

Target a live model with local simulated publishers. Preserve a complete
deterministic mode for rehearsals and network-off operation. AWS is an
independently qualified execution option. UI refinement follows the working
backend and evidence loop.

## Event constraints

The [Singapore chapter listing](https://singapore.aitinkerers.org/?tab=home)
identifies the October 10, 2026 event with Joe Heitzeberg. Research found
conflicting indexed times, 09:30–12:30 and 12:00–18:00 SGT. Venue, final time,
presenter slot, and submission deadline remain unconfirmed. The
[specific event page](https://singapore.aitinkerers.org/p/ai-tinkerers-singapore-saturday-demo-meetup-with-joe-heitzeberg-oct-10)
returned HTTP 403 to the research fetch.

Plan for five minutes of running software plus questions. The organizers'
[demo operations guide](https://aitinkerers.org/p/how-to-run-demos)
recommends a five-minute maximum, technical content, and running code.
The supplied [great-demo guide](https://aitinkerers.org/p/what-makes-a-great-demo-at-ai-tinkerers)
is the narrative reference; initial direct retrieval was unavailable.
The official [global events page](https://aitinkerers.org/all_cities) provided
the readable organizer summary of that format; the standalone operations
article was also inaccessible in a later fetch. The
[readiness plan](PRESENTATION-READINESS.md) owns the script and release gate.

## Current implementation and gaps

Assessment baseline: commit dd52f944db594f77b4ead24e842ef4b7188ab27b.
Retain React, Express, and TypeScript. The project already has guided setup,
plan approval, twelve synthetic sources, protected previews, purchase review,
open-only synthesis, source/span binding, local persistence, and browser tests.
Groq synthesis and XRPL Testnet are optional integrations.

| Area | Code evidence | Next work |
| --- | --- | --- |
| Research execution | src/App.tsx advances five predefined steps; server/index.ts has a fixed gap and named-source outcomes | Bounded server transitions with checkpoints; evidence-derived gaps and stop decisions |
| Retrieval | src/domain.ts combines fixture relevance, gapMatch, and lexical overlap; tfidfScore does not implement TF-IDF | Accurate naming, replaceable retrieval, measured ranking |
| Purchase choice | server/llm.ts excludes circuit-note by ID and asks for one affordable premium source; purchased candidates are not explicitly excluded | READ, PROPOSE_PURCHASE, STOP, ABSTAIN; lineage/access-based eligibility |
| Payment durability | server/index.ts checks budget/idempotency before awaiting live settlement, then records spend/key afterward | Reservation, durable intent, concurrency tests, reconciliation |
| Fulfilment | Purchase success immediately copies catalog spans into access state | Separate HTTP delivery and version/hash verification |
| Protocol | Premium detail returns HTTP 200 JSON; XRPL submits a direct Payment without invoice binding | A tested HTTP 402 challenge/retry adapter |
| History | quoteFor reconstructs receipt fields from current catalog/environment; persistence replaces whole JSON snapshots | Immutable quote records and transactional storage |
| Citation quality | Membership is checked; validateDossier enables missing-span fallback even for model output | Require explicit model bindings; evaluate semantic support separately |
| Runtime limits | tokenLimit is stored; provider requests use separate fixed limits | Enforce cumulative tokens, tools, elapsed time, and spend |
| Verification | Tests exist; no tracked CI workflow was found | Independent CI, scenario scoring, and failure artifacts |

These are source-code observations and risk hypotheses, not claims that every
failure has been reproduced. Existing tests do not establish the new
transaction, delivery, or semantic guarantees.

## Feature priorities

Apply the 80/20 rule to user value, demonstration value, and integration plus
verification cost. Prioritize visible research benefit and essential invariants.
Agent capacity does not remove dependency, specification, or review cost.

| Priority | Capability | Proof |
| --- | --- | --- |
| Required | Thin scenario runner and independent checks | Named cases, useful failures, and an agent repair without weakening acceptance |
| Required | One publisher service with three profiles | Real preview, quote, HTTP 402, receipt, and delivery across the app/service boundary |
| Required | Durable purchase/delivery ledger | Restart after interruption; one logical charge and verified access |
| Required | Bounded adaptive research loop | Price, evidence, or source changes produce appropriate different actions |
| Required | Before/after evidence impact | Each material change resolves to the newly acquired span |
| Required | Open-only and abstention outcomes | Stop without spending when evidence suffices or no useful source is affordable |
| Required | Persisted current run and immutable receipt | Reload and inspect what was approved, received, and cited |
| Required | Clear demo entry/reset and mode labels | Repeat the one-purchase story without inherited access or misleading fallback |
| Conditional | AgentCore Runtime/observability | Same evaluations pass locally/remotely; useful trace and bounded latency |
| Conditional | XRPL Testnet HTTP 402 | Invoice binding, validated settlement, delivery, restart-safe reconciliation |
| First stretch | Budget/price counterfactual in a fresh run | Actual policy changes without mutating approved history |
| Later | AgentCore Payments, second domain, polished library/export, teams, marketplace, general crawling | Outside October 10 core scope |

First add three variants within the data-centre domain: useful premium
evidence, open evidence already sufficient, and conflicting/insufficient
evidence. This tests reasoning without tripling integrations. Another domain
is outside this demo scope; variation within one domain tests hardcoded assumptions.

## Simulated publisher environment

Run one local publisher service with three logical profiles. It owns publisher
catalogs, immutable quotes, delivery records, and premium bodies. ResearchAgent
fetches through adapters and cannot import
premium files directly. Bind local services to loopback; isolate ports,
storage, and fault seeds per test run.

| Publisher role | Material | Experiment |
| --- | --- | --- |
| Public reference desk | Frozen primary reports, data extracts, company disclosures | Zero-spend baseline |
| Independent reporting desk | Original synthetic reporting and an explicitly syndicated derivative | Independent evidence versus repetition |
| Grid research desk | Specialist report, costly alternative, weak alternative | Useful acquisition under a price constraint |

Retain the twelve existing records and add only the variants needed to test
useful evidence, sufficient open evidence, duplication, contradiction, and
price constraints. Corpus volume is not a release goal.

The authored synthetic corpus is sufficient for the core demonstration. Frozen
public primary material can improve the open baseline once the complete flow
works; an ingestion pipeline is not a prerequisite. Store original URL, publisher,
publication/capture dates, source hash, extraction version, geography, units,
and span offsets. Distinguish real excerpts from invented facts; never
attribute invented reporting to the Financial Times. Explain the simulation
once at the start and keep a compact mode label visible.

For any public-source addition, use a small explicit manifest and frozen
snapshot; no general crawler is required:

1. Fetch an explicit URL manifest with bounded size, timeout, and retries.
2. Save raw bytes and extracted text under a content hash.
3. Remove active/navigation content; retain tables, dates, and attribution.
4. Validate spans against the artifact and review ambiguous extraction.
5. Cluster both duplicate documents and shared underlying evidence events.
6. Freeze a corpus version; stage-time research uses this snapshot.

Article text is untrusted data, not tool instructions. Redirects remain
inside the approved adapter boundary. Local addresses are allowed only for
explicit simulated-publisher adapters, never arbitrary model-generated URLs.

### Initial public corpus manifest

These primary pages were fetched during research. The linked data downloads
have not yet been ingested or verified; preparation is an implementation task.

| Source | Contribution | Scope constraint |
| --- | --- | --- |
| [IEA Energy and AI](https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai), 2025 | Global data-centre electricity-demand estimates and scenarios | TWh annual energy is not local available power or a Singapore forecast |
| [Berkeley Lab Queued Up 2025](https://emp.lbl.gov/publications/queued-2025-edition-characteristics), December 2025 | US generation/storage transmission queue records through end-2024 | Proposed GW is not operating capacity or a data-centre demand queue |
| [EMA resilient energy systems](https://www.ema.gov.sg/resources/corporate-publications/annual-sustainability-report-2024-2025/building-resilient-energy-markets-and-systems), FY2024/25, page updated April 2026 | Singapore generation, consumption, peak-demand, and planning context | National totals do not isolate data centres |
| [EMA half-hourly demand](https://www.ema.gov.sg/resources/statistics/half-hourly-system-demand-data), page updated September 2026 | Historical whole-system MW observations | Data table did not populate in the fetch; validate actual download before ingestion |
| [EMA monthly peak demand](https://www.ema.gov.sg/resources/statistics/monthly-peak-system-demand), page updated August 2026 | Monthly system peak MW | Peak power is not annual energy; downloads remain unverified |

Preserve geography, metric, units, time period, and forecast/project status
on every extracted fact. Never turn US generator queues into direct evidence
of Singapore data-centre delays. That limitation itself makes a good
uncertainty and inappropriate-inference evaluation case.

### Publisher contract

Freeze Zod schemas and wire examples before parallel work: search, preview,
quote, protected fetch, receipt lookup, and delivery retry. Provide a small
publisher HTML page so the audience can inspect the same preview and lock.

An unauthenticated protected fetch returns HTTP 402 without premium text.
Payment proof is retried against the exact resource. Successful delivery
returns versioned content and a receipt; receipt lookup never charges.

External protocol integration is conditional. The core uses a documented
simulator contract and makes no untested interoperability claim. The
[x402 v2 migration guide](https://docs.x402.org/guides/migration-v1-to-v2)
and [t54 XRPL scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
document PAYMENT-REQUIRED, PAYMENT-SIGNATURE, and PAYMENT-RESPONSE.
Pin an implementation version and capture a contract trace. t54 specifies
invoice binding in the signed transaction, bounded ledger expiry, exact
network/payee/amount validation, and xrpl:1 for Testnet.

Keep a clearly labelled simulated settlement adapter for offline tests.
Sharing an application lifecycle is not proof of interoperable x402
settlement. The [payment identifier extension](https://docs.x402.org/extensions/payment-identifier)
supports stable retry IDs; a durable application ledger is still necessary.

## Backend target

Keep Express as the application boundary and React as the interface. Extract
modules as needed: contracts, adapters, retrieval, research transitions, model, purchase,
settlement, delivery, citation validation, persistence, and telemetry.

~~~mermaid
flowchart LR
  UI[React workspace] --> API[Express commands]
  API --> WORKER[Bounded research transitions]
  WORKER --> MODEL[Direct provider or AgentCore Runtime]
  WORKER --> READ[Publisher adapters]
  READ --> PUB[One publisher service / three profiles]
  WORKER --> PROPOSE[Purchase proposal]
  PROPOSE --> APPROVE[Exact user approval]
  APPROVE --> LEDGER[Transactional policy and ledger]
  LEDGER --> PAY[Qualified settlement adapter]
  PAY --> DELIVER[Verify delivered version and bytes]
  DELIVER --> EVIDENCE[Accessible evidence and claims]
  EVIDENCE --> IMPACT[Answer change and receipt]
  IMPACT --> UI
  API --> DB[SQLite]
  WORKER --> DB
  LEDGER --> DB
~~~

### Durable transactions

Use SQLite for the single-machine demonstration. Its transaction model and
single-writer behavior fit short reservation/commit operations. Do not hold
a transaction open across a network call. This is not a shared serverless
database. [SQLite transactions](https://www.sqlite.org/lang_transaction.html)

Persist run checkpoints, mandates, immutable purchase/approval records, outcomes,
access grants, and answer revisions. Use a small schema; these concepts need
not each become a separate subsystem or table. Enforce uniqueness for purchase
and settlement identities. Preserve legacy JSON files; import only validated
fixture history and identify records that cannot prove new guarantees.

The invariant is settled spend + active reservations <= approved cap.
Reserve in a transaction before settlement; persist intent and transaction
identity before external submission; record the result separately.

~~~text
PROPOSED -> AWAITING_APPROVAL -> RESERVED -> SUBMITTED
SUBMITTED -> SETTLED -> DELIVERY_PENDING -> FULFILLED
SUBMITTED -> UNKNOWN -> reconciliation -> SETTLED or proven FAILED
SETTLED -> DELIVERY_FAILED -> delivery retry -> FULFILLED
~~~

Unknown outcomes retain reservations until reconciled. Delivery retry reuses
the entitlement. Cancellation stops new work but preserves submitted
transactions. A reused idempotency key with a different payload conflicts.

Freeze the complete quote: principal/run, resource/version/content hash,
invoice, network/asset/payee/amount, expiry, terms, and approval binding.
Use full hashes over canonical data and store the approved snapshot.
Verify delivered bytes before deriving accessible spans. Hash equality proves
artifact identity, not factual truth.

Simulated SGD cents and Testnet XRP drops are separate accounting modes.
The fixture conversion constant must not become a Testnet exchange rate.
Inference/cloud cost has a separate operational budget.

### Adaptive research

Move research transitions out of the browser. Serialize steps per run, persist
checkpoints and revision checks, and let reload/reconnect retrieve authoritative
state. Explicit continuation after restart is sufficient. No general queue,
worker fleet, durable workflow framework, or full event replay is required.

The model chooses bounded typed decisions: continue with accessible evidence,
propose one eligible purchase, finish, or abstain. The application validates
decisions and executes allowed operations. One research agent is sufficient.

Start with lexical retrieval and provenance-aware clustering. Evaluate a
bounded model reranker; add embeddings only for measured retrieval failures.
Purchase signals include gap fit, independence, likely information gain,
delivery reliability, and price. They are not probabilities of truth.

A proposal names an unresolved claim and the evidence its preview suggests.
The model cannot inspect hidden bodies before deciding to buy; only the
evaluator sees the full corpus. Exclude already accessible, derivative, and
ineligible candidates. Stop for sufficiency, exhausted useful options,
declined approval, or time/tool/token limits.

Persist an open-answer revision before purchase. Afterwards, classify claims
as added, weakened, contradicted, unchanged, or unresolved; bind changes to
new spans. Paid evidence may add nothing. Missing model citations require
repair/abstention, not attachment of an arbitrary first span. Validate the
conclusion and displayed answer as well as the claim list.

### Independent runtime dimensions

| Dimension | Planned choices |
| --- | --- |
| Evidence | Small synthetic fixture served through publisher HTTP; optional frozen public snapshots |
| Model | Deterministic fixture, direct provider, AgentCore-hosted worker |
| Settlement | Simulation; XRPL Testnet only after separate qualification |
| Hosting | Local app, optionally a remote worker |

Invalid combinations fail explicitly. A cloud outage may select a labelled
local research fallback; it cannot change the rail of a pending payment or
substitute unrelated fixture evidence. Persist provider, model, prompt,
corpus, and policy versions on results.

## AWS AgentCore decision

This section retains the initial research as reference material. VER-04 in the
[operations plan](plans/october-10/VERIFICATION-AND-OPERATIONS.md) is the only
October 10 AWS work item: a half-day Runtime/observability experiment after the
core flow works. No Payments, Gateway, Memory, or framework migration is required.
Verify relevant service details in the selected account when implementing;
published availability and illustrative rates are not deployment evidence.

AgentCore supplies hosting, tools, identity, evaluation, and payments;
Bedrock model inference is a separate choice. Trial a deployable research
worker with useful telemetry rather than adopting the entire service family.

The [AWS regional matrix](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-regions.html)
lists Singapore support for Runtime microVMs/Instances, Gateway, Identity,
Memory, Observability, Policy, Evaluations, payments, harness, and optimization.
This does not establish account access, quotas, a runtime platform version,
or access to a particular model.

| Component | Proposed use |
| --- | --- |
| Runtime | Same bounded TypeScript research worker, remotely invocable |
| Observability | Correlated model/tool/latency/failure traces |
| Gateway | Only when managed remote tool targets justify it |
| Policy | Possible additional Gateway boundary; retain transactional application checks |
| Identity | Credential/delegation needs if introduced; not a replacement for app authorization |
| Memory | Defer; database owns evidence, runs, receipts |
| Evaluations | Optional sampled semantic grading, alongside mandatory deterministic tests |
| Payments | Separate supported-network experiment; XRPL support is not established |
| Browser/Code Interpreter | Defer until a concrete task needs them |
| Managed harness/optimization | Evaluate against an observed gap while preserving application contracts |

### Minimal cloud topology

Keep Express and simulated publishers local. Express sends bounded accessible
evidence to Runtime, validates the returned action/result, and may relay the
next tool result in another invocation. Runtime never needs to reach the
presenter's localhost. The local app owns approval, ledger, and delivery.
Remote session identity grants no application spending authority.

Promote this branch only after the same evaluation pack passes locally and
remotely, traces are useful, latency fits the demo, and forced remote failure
recovers. A successful cloud hello-world is insufficient.

### Runtime implementation and qualification

For the proposed microVM path, bundle TypeScript to JavaScript. AWS documents
Node direct-code ZIP deployment and the HTTP contract: GET /ping and
POST /invocations; container deployment listens on 0.0.0.0:8080 and uses
ARM64. Native dependencies need compatible binaries.
[Node deployment](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html),
[HTTP contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html)

The documented limits include 15-minute synchronous requests, eight-hour
asynchronous jobs, and 60-minute streaming connections. MicroVM sessions
default to a configurable 15-minute idle timeout and have an eight-hour
maximum lifetime; session state is not durable application storage.
The application should enforce much shorter demo deadlines.
[Runtime limits](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-limits.html),
[session lifecycle](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-how-it-works.html)

Runtime can host code that uses models inside or outside Bedrock; retaining
Groq is possible subject to credentials and egress, and provider charges are
separate. [AgentCore overview](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)

AgentCore Policy checks actions routed through Gateway. It does not
automatically protect direct Runtime invocations or local Express tools.
The application ledger remains the spending authority.
[Policy concepts](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-core-concepts.html)

There is a concrete packaging concern: this repository is ESM. AWS's Node
auto-instrumentation instructions require CommonJS-compatible output and
warn that ESM output can silently omit instrumentation. Build a separate
worker artifact with the documented format, or explicitly verify a supported
manual instrumentation route; do not convert the entire app just for tracing.
Configure the required CloudWatch facilities and confirm spans actually
arrive. [Node observability instructions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html),
[observability setup](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability-configure.html)

Qualification checks: package/start successfully; invoke with server-side
authenticated credentials; validate outputs and cancellation; propagate
run/operation/trace IDs; keep secrets and inaccessible content out of traces;
pass local/remote scenario parity and a forced outage. The browser receives
no AWS credentials. Verify cold/warm latency, native dependency compatibility,
and provider egress in the actual account before promoting this mode.

### Payments and differentiation

AWS documents x402/MPP orchestration, expiring payment sessions with budget
limits, and Coinbase CDP/Stripe Privy integrations. Research and premium data
are explicit use cases. [AWS Payments overview](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html)

This is a relevant future rail and reinforces the product distinction:
evidence selection and demonstrated answer improvement. Spending limits do
not establish source usefulness, independence, or claim support.

Any later Payments experiment must prove wallet/network compatibility, test funding, exact
approval, retries, and delivery before promotion. Keep XRPL and AgentCore
Payments behind one application settlement interface. AgentCore Payments is
outside October 10 scope. No wallet migration is necessary to use Runtime.

### Cost model for the cloud experiment

Published USD reference rates below are from
[AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/).
Singapore-specific prices and account terms were not established.

| Meter | Published reference |
| --- | --- |
| Runtime microVM v1 | $0.0895/vCPU-hour and $0.00945/GB-hour |
| Runtime microVM v2 consumption | $0.1276/vCPU-hour and $0.0169/GB-hour |
| Gateway ordinary invocations | $0.005/1,000 |
| Policy authorization | $0.000025/request |
| Built-in evaluation | $0.0024/1,000 input tokens; $0.012/1,000 output tokens |
| Custom evaluation | $1.50/1,000 evaluations plus model usage |
| Observability | CloudWatch charges |
| Payments | Underlying wallet-provider operations; no additional AWS API charge |

Illustrative workload, not a quote: 1,000 one-minute v1 runs, each with
10 seconds of active 1-vCPU work and 1 GB resident for 60 seconds, cost about
$0.249 CPU + $0.158 memory = $0.407. Ten thousand Gateway invocations add
$0.05. One thousand built-in evaluations with 2,000 input/200 output tokens
each add $7.20. These assumptions exclude idle residency, model inference,
storage, logs, transfer, wallet operations, and purchased content.

Measure actual session duration and memory. Ten extra resident minutes per
run at 1 GB add about $1.58 per 1,000 v1 runs. Do not advertise the active-run
estimate as the entire project cost. Set a separate cloud/model experiment
budget before provisioning and evaluate a sampled set rather than every
trace. Coding-agent usage is a third budget, separate from app inference
and article spend.

## Execution sequence

All dates are Singapore time. Dates reserve integration and rehearsal time;
parallel agents cannot remove dependencies. Detailed work packages live in
[the implementation index](plans/october-10/README.md); the
[agent work guide](AGENT-DEVELOPMENT.md) owns delegation and repair rules.

| Date | Main outcome | Parallel work | Exit gate |
| --- | --- | --- | --- |
| Oct 2 | Contracts, baseline, first gold cases | Scoped task briefs and corpus metadata | Unambiguous interfaces and a small acceptance loop |
| Oct 3 | One publisher service and small durable ledger | Provider decisions and UI projections | Locked-content, quote, concurrency and retry cases run |
| Oct 4 | One complete open-to-paid slice | Evidence impact and citations | HTTP delivery changes an evidence-bound answer |
| Oct 5 | Adaptive choices and recovery | Negative cases and reload behavior | Price/lineage/content variants and restart cases pass |
| Oct 6 | Qualify primary live-model mode | Optional bounded AWS experiment | Core reliable; admit optional modes only on evidence |
| Oct 7 | Refine five-minute UI and technical reveal | Accessibility, projection, latency | Core scope complete; no new independent workstream |
| Oct 8 | Release candidate | Rehearsals and fallback capture | Critical invariants and scenario thresholds pass |
| Oct 9 | Final-machine rehearsal and freeze | Offline pack; logistics | Three clean rehearsals and timed recovery |
| Oct 10 | Preflight and presentation | Capture technical feedback | Run the qualified mode |

If the core slice is late, remove optional rail/cloud work before removing
provenance, transaction integrity, or evidence impact. Extra capacity should
expand scenario coverage and remove hardcoding.

## Completion criteria

Planning delivers the manifesto, roadmap, issue-ready module specifications,
shared interfaces, agent work guide, and rehearsal plan. Implementation is a
subsequent workstream; proposed
commands and schemas are labelled accordingly.

The October 10 build is ready when an independent verifier can run the
scenario, acquire evidence over HTTP, inspect the immutable receipt and
answer diff, interrupt it, and recover without hidden state or another
logical payment. The audience can distinguish real computation/networking
from simulated publishers and settlement.

Remaining decisions do not block local implementation: final event slot,
model quality/latency results, available AWS account permissions, and whether
an existing Testnet adapter qualifies without delaying the core demo.
