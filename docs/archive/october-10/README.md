# October 10 implementation plan

> **Lean execution override (4 October).** By its own 4 October milestone,
> none of this plan had been implemented. Execution now follows
> [prompt.md](../../../prompt.md). The product is reframed as "Perplexity with
> a wallet":
>
> - a free cited answer;
> - a per-prompt budget that replaces per-purchase approval;
> - a Cloudflare Clef decision agent that chooses what to buy, while the LLM
>   stays on Groq;
> - a deep-research PDF.
>
> The plan now has a much smaller verification surface, five hard gates, a
> single review pass per PR, and parallel agent waves. Feature freeze is
> Thursday 8 October at 20:00 SGT. AWS AgentCore (VER-04) is removed. Where
> this index, the module plans, or the bodies of issues #59–#78 disagree with
> prompt.md, prompt.md wins. The RES/COM/UI/VER IDs and issue numbers remain
> the tracking identifiers.

Planning date: October 2, 2026, Singapore time. Status: planned work; no feature
or passing implementation check is implied. This package turns the
[team manifesto](../../DEMO-MANIFESTO.md) and [sprint roadmap](../../PRODUCT-ROADMAP-2026.md)
into bounded issues and executable acceptance contracts.

## Product target and scope

Build one complete flow: open-evidence answer → material gap → useful source
recommendation → exact approval → publisher HTTP delivery → cited answer impact.
Demonstrate that sufficient or redundant evidence leads to zero purchase.
Preserve budget, access and recovery guarantees through failures and retries.

Required scope: one data-centre domain, the small current corpus plus targeted
variants, one publisher process with three profiles, live model qualification,
simulated settlement, a small durable local ledger, existing UI with a readable
impact view, and a thin independent verification loop. A labelled deterministic
mode supports rehearsal and offline recovery.

The 80/20 rule applies to specification, integration, and verification cost.
Each issue below improves a research decision, exposes its value, or protects an
essential guarantee. No feature is justified solely by available agent capacity.

## Documents and ownership

| Document | Owns |
| --- | --- |
| [Shared interfaces](INTERFACES.md) | Resolved cross-module choices, trust boundaries, modes, identity and reset semantics |
| [Research and evidence](RESEARCH-AND-EVIDENCE.md) | RES-01..03: corpus, decisions, checkpoints, citations and impact |
| [Publishers and purchases](PUBLISHERS-AND-PURCHASES.md) | COM-01..04: storage, HTTP service, approval, settlement and recovery |
| [UI and demo](UI-AND-DEMO.md) | UI-01..03: state presentation, impact, citations and fresh runs |
| [Verification and operations](VERIFICATION-AND-OPERATIONS.md) | VER-01..04: scenarios, invariants, release and optional AgentCore |
| [Agent work guide](../../AGENT-DEVELOPMENT.md) | Worker briefs, independent acceptance and bounded repair |
| [Presentation readiness](../../PRESENTATION-READINESS.md) | Stage script, rehearsals, logistics and fallback artifacts |

Shared interfaces override inconsistent legacy behavior. Module plans own their
technical detail; this index owns completion dependencies and sequencing. Source
code remains the evidence of current behavior. Each issue body contains ordered
subtasks, concrete contracts, negative cases, acceptance, verification evidence,
and exclusions. New filenames, endpoints and commands are implementation targets.

## Issue register and completion dependencies

P0 is essential product or release work. P1 is required presentation work whose
polish can be reduced. P2 is optional and never blocks the required demo. Subtasks
can begin against frozen contracts before all completion dependencies are done.

| ID | Issue title | Priority | Must be integrated before completion |
| --- | --- | --- | --- |
| RES-01 | Version the corpus and separate public, protected and evaluator data | P0 | Shared interfaces frozen |
| COM-01 | Persist run checkpoints and a transactional local purchase ledger | P0 | Shared interfaces and RES-01 identity schema |
| COM-02 | Serve three publisher profiles through one real HTTP boundary | P0 | RES-01, COM-01 |
| RES-02 | Execute bounded evidence-driven research decisions on the server | P0 | RES-01, COM-01, COM-02; purchase integration completes with COM-04 |
| COM-03 | Enforce exact approval, budget reservations and idempotent settlement | P0 | COM-01, COM-02; RES-02 proposal schema, not full RES-02 completion |
| COM-04 | Reconcile interrupted purchases and verify delivery before access | P0 | COM-01..03; RES-01 content envelope |
| RES-03 | Preserve the baseline and produce cited, honest evidence impact | P0 | RES-01, RES-02, COM-04 |
| UI-01 | Present authoritative progress, approval and purchase recovery | P0 | RES-02, COM-03, COM-04 |
| UI-02 | Show before/after impact and navigate exact evidence passages | P0 | RES-03, UI-01 |
| UI-03 | Add prefilled demo entry, fresh runs and independent mode labels | P1 | UI-01, UI-02; RES/COM run lifecycle |
| VER-01 | Run eight research scenarios with independent oracles | P0 | Scaffold starts immediately; full gate integrates RES/COM |
| VER-02 | Verify purchase/access invariants and run lean fixture CI | P0 | COM-01..04, RES-02, UI-01/02, VER-01 |
| VER-03 | Qualify the live route and rehearse a recoverable release | P0 | Required RES/COM/UI work, VER-01, VER-02 |
| VER-04 | Qualify or defer an AgentCore Runtime/observability experiment | P2 | Qualified local core under VER-03; half-day limit |

There is no RES-02/COM-03 completion cycle: freeze the proposal/checkpoint schema
first. COM-03 tests it with typed fixtures, then RES-02 integrates the real
purchase and delivery result. RES-03 similarly supplies its baseline schema
early, before the full impact implementation. VER-01 scaffolding and rubrics
start before the product; completion of every scenario waits for the real path.

## Ordered implementation slices

### 1. Freeze contracts and establish a small evaluator — October 2–3

Complete RES-01's identity/public schema and the shared proposal, checkpoint and
answer artifact types. Start COM-01 storage and VER-01 scenario inputs/oracles.
UI can render typed examples concurrently. The integrator owns shared exports,
`src/domain.ts`, `server/index.ts`, package/config changes and test configuration.

Exit: an agreed public/private boundary and runnable selected-case scaffold that
fails correctly on an intentionally invalid result. The whole evaluator does
not have to be finished before feature work begins.

### 2. Deliver one complete product flow — target October 4

Integrate the smallest coherent paths from COM-02..04, RES-02/03 and UI-01/02:
read open evidence, save baseline, propose one useful source, approve its quote,
settle in the simulator, verify delivery, show one changed claim and its passage.
Keep exact approval, durable intent, cap enforcement and verified access in this
first slice. One path working does not close every issue or qualify the release.

Exit: an actual API/publisher run and its evidence record. Use deterministic
provider output for repeatability, then inspect one live-model run. Freeze a
usable fallback build here while later cases are added.

### 3. Strengthen decisions and recovery — October 5–6

Complete the no-purchase, duplicate, price, contradiction and unchanged cases.
Exercise concurrent attempts, stale approvals, process interruption and failed
delivery. Finish authoritative UI recovery and fresh-run labels. Extend the thin
runner and CI alongside the relevant state transition, never by disabling old
useful checks. Qualify direct live inference before optional remote hosting.

Exit: required deterministic cases pass, actual live output meets the support
rubric, and a failed delivery can recover without a second charge. If late, cut
all optional work first; protect the core evidence and purchase guarantees.

### 4. Freeze and rehearse — October 7–9

October 7 completes required integration and projector readability. October 8
cuts the release candidate; optional variation/AWS is admitted only with recorded
qualification. October 9 freezes the rehearsed build after three clean timed
runs and one recovery run. No new independent feature enters after October 7.
Late fixes rerun affected checks plus the timed story.

Dates are targets, not evidence of completion. A feature unfinished at freeze
cannot be represented as implemented; the qualified local route remains primary.

## Feature-to-proof coverage

| Planned feature | Implementation owner | Required proof |
| --- | --- | --- |
| Useful answer before spending | RES-01..03 | SC-02 open-sufficient stop, SC-08 abstention, zero intents/spend |
| Deliberate selection | RES-02 | SC-01/03/04/05 plus renamed/reordered holdout |
| Working publisher boundary | COM-02 | Real 402, no protected bytes before trusted delivery credential |
| Controlled recoverable purchase | COM-01/03/04 | Exact approval, cap race, unknown-outcome reconciliation, no double debit |
| Visible evidence impact | RES-03, UI-02 | SC-01/06/07, immutable baseline, exact version/span navigation |
| Repeatable demo | UI-03, VER-03 | Distinct clean run IDs, independent labels, three rehearsals and recovery |
| Reduced coding supervision | VER-01/02, agent guide | Independent failures, useful repair feedback, protected acceptance |
| Optional budget variation | UI-03.e, RES-02 | SC-04 in a fresh run with prior approval/history unchanged |
| Optional cloud runtime | VER-04 | Parity, trace visibility, latency and outage recovery within timebox |

## Existing GitHub issue reconciliation

Existing open titles were read with authenticated `gh` on October 2. These are
reuse candidates based on title and earlier scope, not verified replacements
for the full new contracts. Read each current body before updating or splitting;
preserve completed evidence and remove obsolete event dependencies. No GitHub
issues are created or modified by this planning publication.

| Planned work | Existing candidates | Scope correction |
| --- | --- | --- |
| RES-01/02 | #20, #21, #26, #42, #52 | Single domain and one proposal; public adapter and editable multi-buy plan are deferred |
| RES-03 / UI-02 | #10, #37, #43, #44 | Actual baseline/impact and exact citations; no full library requirement |
| COM-01 | #38, #45 | Durable current-run/purchase state; no history browser |
| COM-02 | #47, #48, #53 | One service/three profiles; simulator protocol without unproven interoperability |
| COM-03/04 | #36, #49, #51, #16 | Fixture-first transaction/delivery guarantees; Testnet #50 remains conditional |
| UI-01/03 | #58, #13, #6, #5 | Existing layout, exact actions, reset and labels; no redesign |
| VER-01/02 | #46, #54, #24 | Small early runner plus critical deterministic boundaries |
| VER-03 | #56 | October 10 release replaces older SFF/event assumptions |
| VER-04 | New bounded experiment if admitted | Existing post-October hosting issues do not become prerequisites |

When converting to GitHub issues, retain RES/COM/UI/VER IDs in the bodies as
stable planning identifiers. Each module can be an epic; its numbered items are
the issue contracts. Keep subordinate checkboxes inside the issue unless a
separate owner or dependency justifies a subissue. Copy acceptance and exclusions
with the task, link this plan, map dependencies, and require evidence before
closure. Use authenticated `gh` exclusively for GitHub access.

## Explicit exclusions and cut order

Outside this sprint: real publisher commercial integration, production money,
general scraping/search, a second domain, embeddings/vector databases, research
agent teams, broad UI redesign, a purchased-article library, polished export
workflows, account/team permissions, a generic coding controller, scheduled agent
automation, mandatory parallel browser infrastructure, and AgentCore Payments,
Memory or Gateway adoption. Public snapshot enrichment and live Testnet are not
required to demonstrate the local publisher contract.

Cut optional cloud, live settlement, counterfactual UI, and cosmetic polish in
that order when they threaten integration. Retain clear simulation labels,
manual approval, caps, protected access, retry integrity, supported claims and
the evidence payoff. A feature passes only with its specified behavior and
verification evidence on the integrated code tree.
