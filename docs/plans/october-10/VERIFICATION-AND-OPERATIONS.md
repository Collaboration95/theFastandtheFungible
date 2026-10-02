# October 10 verification and operations implementation plan

Planning date: October 2, 2026, Singapore time. These are implementation
instructions, not executed checks. [INTERFACES.md](INTERFACES.md) is authoritative.
Required demo: live model, real local API/publisher HTTP, fixture settlement,
evidence-bound impact, and a credible zero-purchase stop. Offline research is
explicitly labelled. Keep React/Express/TypeScript and the existing dependencies.

## Starting evidence and gates

`package.json` currently supplies `check:fast` (lint, typecheck, Vitest),
`testing` (Vitest plus every Playwright spec), and `verify` (lint, typecheck,
`testing`, build). `test:e2e` runs only `tests/e2e.spec.ts`; it misses guided
setup, workspace, and accessibility specs. `playwright.config.ts` uses one
worker, fixed ports 5100/8788, `.playwright/runs.json`, and `npm run dev`.
`scripts/prepare-e2e-store.mjs` deletes that JSON store; `dev` first invokes
`scripts/stop-dev.mjs`, whose ownership check is a command-path substring.
There is currently no `.github/workflows` directory.

`tests/persistence.test.ts` already starts actual API children with temporary
stores and ports, checks restart/reset receipts, and rejects missing/stale
quotes. It does not establish reservation races or interruption-safe settlement.
`server/persistence.ts` atomically replaces whole JSON snapshots, without a
transactional ledger. `server/index.ts` grants spans inside purchase settlement;
`server/llm.ts` selects premium candidates and excludes a fixed source ID.
`server/dossier-validation.ts` checks span ownership, not semantic support.
Existing browser cases exercise open-only answers, approval cancel, reload,
and inaccessible text; `tests/a11y.spec.ts` scans only the initial screen.

The previously reported 22 unit/17 browser baseline in
[AGENT-DEVELOPMENT.md](../../AGENT-DEVELOPMENT.md) is historical inventory,
not current gate proof. This planning task runs no application tests. All new
paths/commands below are **proposed** until implemented. Required progression:
focused acceptance while coding → full fixture aggregate → fresh live
qualification → final-machine rehearsals. Fixture passes cannot qualify cloud
or Testnet.

## VER-01 — Thin research scenarios and independent oracles — P0

**Outcome / 80–20:** eight small golden cases prove useful buying, meaningful
impact, and stopping. Start alongside product work; no 30-case platform first.
**Anchors:** `server/llm.ts`, `server/catalog.ts`, `server/dossier-validation.ts`,
`tests/domain.test.ts`, `tests/dossier-validation.test.ts`, and the API-child
pattern in `tests/persistence.test.ts`. **Dependencies:** RES-01..03 supply
corpus/context/decision/impact contracts; COM-01..04 supply ledger, publisher,
purchase, and delivery contracts; UI-01..03 consume the same observations.
Freeze evaluator inputs early; integrate cases as each slice becomes available.

### Ordered subtasks

- [ ] VER-01.a Define proposed `tests/scenarios/cases.ts` inputs and separately protected
  `tests/scenarios/oracles.ts`: stable case ID, question, corpus variant,
  mandate, accessible starting evidence, scripted model/fault responses,
  approval action, expected decision/impact and forbidden claims.
- [ ] VER-01.b Curate the following cases with RES using the approximately 12-item
  data-centre corpus and three profiles in one publisher process. A variant
  alters only necessary facts, lineage, availability, or price.
- [ ] VER-01.c Implement proposed `scripts/research-scenarios.ts`, invoked by
  `npm run eval:fixture -- --case SC-01` or all cases. Use Node child processes,
  fetch, Zod, and Vitest assertions/helpers; do not add an evaluator library.
  Run actual API/publisher HTTP; control provider responses at its adapter.
- [ ] VER-01.d Evaluate server checkpoints, quote/receipt/grant joins, provider context,
  citations, and before/after answer artifacts. Add one evaluator-held variant
  with renamed IDs/titles and reordered sources to expose name-based policy.
- [ ] VER-01.e Prove evaluator sensitivity: feed a valid-looking unsupported claim,
  a foreign-owned span, and an incorrect purchase result to disposable result
  fixtures. Each must fail without modifying application code.

| ID | Expected observable outcome | Integration coverage |
| --- | --- | --- |
| SC-01 Useful gap purchase | Open baseline records energisation uncertainty; propose independent grid evidence, wait for exact approval, deliver once, qualify conclusion with cited spans, then stop | RES-01..03; COM-01..04; UI-01..03 |
| SC-02 Open sufficient | Open spans resolve the question; finish with zero intents, spend, or approval dialog | RES-01..03; COM-01/03; UI-01/02 |
| SC-03 Duplicate only | Retitled syndication remains one family; no purchase or inflated corroboration; disclose remaining gap | RES-01/02; COM-02/03; UI-01/02 |
| SC-04 Price/budget counterfactual | Fresh isolated run raises useful-source price above ceiling/cap; reject purchase, answer narrowly; original approval/history stays intact | RES-02/03; COM-01/03; UI-02/03 |
| SC-05 Source unavailable | Remove useful resource before quote; continue with readable evidence or abstain, record unavailable gap; no fabricated source or spend | RES-01/02; COM-02; UI-01/02 |
| SC-06 Contradiction | Approved new version challenges baseline; explicitly contradict/qualify material claim with owned spans, without forced positive impact | RES-01..03; COM-02..04; UI-01/02 |
| SC-07 Unchanged impact | Preview credibly suggests value but verified body adds no material finding; preserve conclusion, report unchanged impact and cost, stop further buying | RES-02/03; COM-03/04; UI-01/02 |
| SC-08 Unsupported / no readable evidence | Off-domain question is rejected; in-domain locked-only variant abstains; neither produces canonical answer or auto-purchase | RES-01/02; COM-02/03; UI-01/03 |

**Technical decisions / failure cases:** oracles describe required facts,
forbidden overclaims, admissible evidence families and span/version ownership;
do not require exact prose. For each material claim, the independent reviewer
records supporting span and entailment/qualification/contradiction judgement.
An ID-valid but unsupported claim fails. Judge open baseline separately from
post-delivery output; a textual rewrite alone is not impact. SC-07 allows a
reasonable prospective decision to have no realised benefit. Evaluation labels
and locked bodies remain evaluator-side, never in model requests or run APIs.
The scripted approval driver represents a test analyst; plan approval alone
never authorizes spending.

**Acceptance / verification / evidence:** all eight deterministic cases and
the held variant pass independently; SC-02/03/08 cannot create an intent.
Malformed output, missing citations, article instructions to buy/leak, and
timeout cannot bypass server validation. Persist a proposed per-case
`result.json` with tree/commit and lockfile/corpus/prompt/evaluator hashes,
seed, modes, expected/actual outcome, exit status, duration, model usage,
and artifact links. Retain checkpoints, redacted context, baseline/final
claims and receipt; failure adds logs and mismatches. Statuses are PASS,
FAIL, ENVIRONMENT_BLOCKED, NOT_RUN. Never treat unavailable processes as PASS.

**Scope / done:** in: runner, curated rubrics, scorecard, negative controls.
Out: generic crawler, coding-agent controller, benchmark leaderboard, automatic
LLM judge dependency. Done when selected-case and full-case invocations return
correct exit statuses and an independent reviewer signs the recorded outcomes.

## VER-02 — Purchase, access, concurrency, restart and lean CI — P0

**Outcome / 80–20:** deterministic hard gates protect the money/access thesis
through real boundaries; a small fast loop exposes regressions before browser
rehearsal. **Anchors:** purchase/source/receipt/stream handlers in
`server/index.ts`, JSON persistence, existing persistence/citation tests,
`vitest.config.ts`, `playwright.config.ts`, `vite.config.ts`, `tsconfig.json`.
**Dependencies:** COM-01..04 invariants and RES checkpoint seam; UI-01 recovery and UI-02 evidence views.

### Ordered subtasks

- [ ] VER-02.a Add parameterized quote mutations for publisher, resource/version,
  integer amount, currency/unit, terms, expiry, settlement mode, run and intent
  binding. Missing/cancelled approval, stale revision, cross-run approval and
  reused idempotency key with changed payload must reject before settlement.
- [ ] VER-02.b Use controlled barriers, not sleeps, to overlap same-intent submissions
  and two different intents competing for one remaining cap. Assert one
  logical settlement, identical retry identity, and settled plus reserved
  spend within mandate. Record actual settlement-attempt count independently.
- [ ] VER-02.c Gate faults at persisted intent/reservation, submission-before-response,
  persisted settlement, and delivery-before-grant. Kill/restart the actual API
  using the same ledger; exercise publisher restart with stable fixture
  settlement status. Unknown outcome reconciles before any resubmission;
  failed delivery retains receipt and retries without additional charge.
- [ ] VER-02.d Test wrong digest/version, another run's grant, direct protected GET,
  preview/search/error/SSE payloads, model context and browser network for
  inaccessible canary text. Verify public endpoints expose permitted previews;
  only verified delivery grants its exact version. Add byte checks to the
  built served assets; Vite's development deny list is insufficient evidence.
- [ ] VER-02.e Extend sequential Playwright for repeated confirm, expiry, delivery
  recovery, reload/SSE reconnect and stale-tab actions. Scan approval, recovery,
  final answer and citation drawer with existing axe; check focus and labels.
- [ ] VER-02.f Add proposed `verify:invariants`, `verify:acceptance` (invariants plus
  SC-01/02/08), and `verify:release` (`verify`, invariants, all fixture cases).
  Extend aggregate inclusion to avoid silently skipping process tests.
  Include new TypeScript scripts in typechecking explicitly; current
  `tsconfig.json` omits `scripts`.
- [ ] VER-02.g Add one proposed GitHub Actions fixture job using lockfile `npm ci`,
  pinned Node/browser versions, Chromium installation, and `verify:release`;
  retain reports/failure traces on failure. No live credentials or AWS job.

**Technical decisions / failures:** reuse Vitest/Playwright and Node facilities;
no fast-check dependency for this deadline. Fault controls are test-only,
unavailable in normal launcher mode, and excluded from model context. Inspect
ledger records and fixture-adapter journal independently of API projections.
Cancellation before submission must prevent settlement; cancellation after
submission retains outcome reconciliation and cannot release uncertain spend.
Corrupt storage must fail closed. Reset creates a fresh run while old receipts
remain addressable. Late model responses cannot overwrite a stopped/newer run.

**Acceptance / verification / evidence:** every required invariant passes, including negative
controls for double charge and premature access. Focused commands report case
IDs, interleaving, API/publisher logs, pre/post ledger evidence and exit codes.
Configure Playwright failure traces/screenshots and machine-readable reporting;
exclude credentials and protected bodies from shared artifacts. The integrated
gate records actual discovered counts, never the historic baseline. Exercise
an intentional assertion failure to prove CI returns nonzero and retains its
artifact. ENVIRONMENT_BLOCKED requires rerun, not waived acceptance.

**Scope / done:** in: bounded schedules, crash boundaries, access checks and one
lean fixture CI job. Out: generalized chaos/load testing, new property/model
frameworks and parallel browsers. Keep browsers sequential until isolation
has measurable value; temporary API tests can isolate independently. Done when
the combined tree passes the full gate and concurrency/restart evidence is
reviewed; worker claims alone cannot satisfy it.

## VER-03 — Live qualification, safe launch and release rehearsal — P0

**Outcome / 80–20:** qualify the actual presentation machine and a bounded live
provider without turning nondeterministic output into a fake fixture pass.
**Anchors:** Groq configuration/timeouts and automatic fallback in
`server/llm.ts`/`server/index.ts`; `scripts/stop-dev.mjs`, `prepare-e2e-store.mjs`,
package scripts and [PRESENTATION-READINESS.md](../../PRESENTATION-READINESS.md).
**Dependencies:** VER-01/02, RES-02/03 live decisions/usage bounds, COM processes,
UI-01..03 mode labels and fresh-run/recovery controls.

### Ordered subtasks

- [ ] VER-03.a Implement proposed `demo:start`, `demo:stop`, `demo:doctor` using owned
  child handles plus PID/start identity and a dedicated demo ledger/artifact
  directory. Bind/check all client/API/publisher ports, health, corpus hash,
  schema and requested modes. Refuse occupied foreign ports; never invoke the
  current broad `dev:stop` as rehearsal cleanup. Wait for child exit on teardown.
- [ ] VER-03.b Make doctor verify locked HTTP, three-profile discovery, fresh-run
  zero spend/access, server-only credentials and model readiness. Bad schema,
  missing corpus/key or unavailable publisher returns nonzero with next action.
  Creating a fresh run preserves prior receipts; reset never deletes shared
  history. Launch explicit offline mode without provider calls when chosen.
- [ ] VER-03.c Implement proposed `eval:live`: three fresh repetitions each of
  SC-01/02/06, nine runs maximum, no cached responses. Predeclare model/prompt,
  token/dollar allowance and 20-minute batch deadline; cap at 36 model calls
  and stop on the first exceeded allowance. Count retries inside the cap.
- [ ] VER-03.d Implement proposed `demo:rehearse` for the five-minute thesis journey,
  zero-purchase example, and a recovery fault; collect timings, receipt,
  baseline/impact screenshots, and a short labelled offline recording.
- [ ] VER-03.e Cut candidate October 8; run three clean final-machine rehearsals and
  one fault recovery by October 9. Freeze hashes/modes and rerun affected gate
  plus timed story after any late fix. Run doctor before departure and again
  after connecting the presentation display October 10.

**Contracts / acceptance:** record provider/model, fresh outputs, validated
decisions, owned citations, semantic rubric results, tokens/cost and elapsed
time separately. All nine runs must respect purchase/access invariants, all
material claims must be supported, and selected scenarios must behave
appropriately. Target answer within 60 seconds excluding analyst approval
time; report actual cold/warm timings. Small samples qualify a demo route,
not statistical reliability. A configured live timeout/invalid result cannot
silently become live success: mark qualification failed/blocked, preserve safe
state, and visibly label a separately selected fixture rehearsal. Pending
purchase intents never change settlement adapter during recovery.

**Verification / evidence:** deliberate foreign port, provider outage, expired
quote and paid-delivery failure rehearsals prove safe next actions; restore the
presentation within 60 seconds. Check projector viewport, 390px, 200% zoom,
keyboard purchase/citation controls and reduced motion. Release bundle records
tree identity, commands/exits, current counts, scenario scorecard, live results,
doctor output, three timings and fault trace; open exports offline once.

**Scope / done:** in: direct provider/local publisher/fixture route and labelled
offline pack. Out: production payments and mandatory Testnet. Testnet may enter
only with exact network/payee/amount/invoice binding, separate integer units,
validated transaction proof, unknown-outcome reconciliation, delivery checks,
restart evidence and fresh rehearsal; existing XRPL code alone does not qualify.
Done when release evidence supports every advertised mode and recovery step.

## VER-04 — Optional AgentCore Runtime/observability experiment — P2

**Outcome / 80–20:** test whether remote execution adds useful trace visibility
without risking the local demo. **Anchors:** provider packet in `server/llm.ts`,
ESM `package.json`, local ledger ownership, and already-researched
[roadmap AWS section](../../PRODUCT-ROADMAP-2026.md#aws-agentcore-decision).
**Dependencies:** VER-01/02 and the live-qualification portion of VER-03,
not its final October 9 release rehearsals. An available cloud environment is
required for later implementation under its applicable account controls. This plan
performs no AWS account/API/CLI/deployment action.

- [ ] VER-04.a Reserve at most half a working day after the core passes. Check current
  official [Runtime HTTP contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html)
  and [Node deployment/observability guidance](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html)
  during implementation; verify chosen region/account/runtime availability
  separately. Treat roadmap availability claims as research, not qualification.
- [ ] VER-04.b Extract only a bounded research invocation: accessible spans/public
  metadata, question, limits, revision and correlation IDs in; typed decision
  or draft out. Local Express validates it. Persistent app ledger, approvals,
  receipts and publisher access stay local; cloud never receives locked bodies,
  evaluator labels, wallet authority or a localhost tool dependency.
- [ ] VER-04.c Qualify packaging, provider egress, authenticated server invocation,
  timeout, cold/warm latency and actual correlated trace arrival. Address the
  researched ESM instrumentation concern in a separate worker bundle/manual
  instrumentation route; do not convert the application to another module format.
- [ ] VER-04.d Replay the eight fixture cases against local/remote invocation with
  identical controlled model output, then run SC-01/02/06 fresh remotely within
  the live budget. Force remote outage and reject stale/invalid results locally.

**Acceptance / verification / evidence / scope / done:** archive payload-schema parity, scenario exits,
fresh semantic checks, trace IDs, redaction inspection and recovery timings.
Promotion requires core-equivalent behavior, useful trace and the same demo
deadline; hello-world or an invocation ID is insufficient. If credentials,
packaging, telemetry or integration dominate the half-day, stop, record
NOT_QUALIFIED and use the qualified local route. Done is a documented promote
or defer decision. Out: AgentCore Payments, Memory, Gateway, hosted ledger,
generic controller and cloud reliability claims.

## Worker execution and parent integration

Give each autonomous worker one issue outcome, source anchors, dependencies,
bounded write set, preserved invariants, frozen acceptance IDs, exclusions,
time/usage budget and artifact requirements. Worker runs focused acceptance;
independent evaluator owns protected rubrics/holdout inputs. Allow at most
three repair attempts with expected/actual failures, then escalate the specific
blocker. Never delete checks or relax rubrics to pass. One integrator serializes
contracts, package/config/launcher changes and runs the aggregate on the combined
tree. No new coding platform, scheduled automation or parallel browser prerequisite.

INTERFACES and the owning RES/COM plans resolve payload/state names,
profile mapping, content encoding, reset and explicit fallback behavior. Fault
barriers use COM transition boundaries; ledger/context inspection remains a
test-only seam. Fast-check, Promptfoo, 30 starter cases, parallel isolation and
a generic controller are deferred under the current agent work guide. Existing XRP/SGD browser
assertions and purchase-inline grants must change with COM's separate-unit and
delivery contracts, not be preserved as acceptance truth. This file defines
behavioral tests; owning modules define payloads under INTERFACES.md.
