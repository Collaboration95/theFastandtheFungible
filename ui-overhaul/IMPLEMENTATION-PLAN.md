# ResearchAgent UI overhaul implementation plan

This plan is the execution contract for the portable `ui-overhaul/` package. It is
written so a new computer, a new worker, or a new orchestrator can execute the
work without relying on the conversation that produced it.

The redesign serves a general deep-research user who wants better evidence,
useful access to paywalled articles, and exact control over money. The working
product should feel quiet and trustworthy: a neutral sans-serif interface, one
restrained accent, clear hierarchy, and enough space to understand the next
decision. The first-run home/demo may be more expressive, but the research desk
must remain calm and tool-like.

The guided baseline is:

`Question → Sources → Budget → Review → Research → Answer`

This is a user-facing guidance model, not a mandate to add six full-page
routes or to change server state transitions without a contract. A user may
save, go back, resume, skip an optional paid source, continue with open
evidence, or recover from an error without losing the safe state.

## Portable package contract

The package must be useful when copied with Git to a new computer. Every future
worker must use repository-relative paths, fixture mode by default, and documented commands. Clearly distinguish existing scripts from new scripts a slice introduces. No step may depend on hidden prompt
history, a local screenshot directory that is not copied into Git, a funded
wallet, a live provider, or a paywalled third-party body.

Companion documents: [README.md](README.md) is the entry point;
[DESIGN-BRIEF.md](DESIGN-BRIEF.md) is the design contract;
[TESTING.md](TESTING.md) is the verification runbook;
[ORCHESTRATOR-PROMPT.md](ORCHESTRATOR-PROMPT.md) coordinates execution;
[WORKER-PROMPT.md](WORKER-PROMPT.md) bounds assignments; and
[STATUS.md](STATUS.md) records accepted work and next actions. The orchestrator
assigns file ownership for each slice and serializes shared-document updates.
This package contains plans and original evidence; application implementation
has not started.

## Current repository facts and non-negotiable boundaries

The canonical redesign brief is `ui-overhaul/DESIGN-BRIEF.md` (the old docs path is a forwarding page). Its findings and
acceptance criteria are the product requirements. `docs/ISSUE-BACKLOG.md`,
`docs/contracts/DESIGN.md`, and `docs/contracts/UX-CONTRACT.md` provide the
existing issue and contract context. The runtime implementation is currently
concentrated in these shared files:

- `src/App.tsx` contains the landing flow, plan review, source rows, evidence
  drawer, purchase confirmation, activity rail, synthesis action, and dossier
  presentation in one monolith.
- `src/styles.css` owns global tokens and nearly all layout/component styling.
- `src/domain.ts` owns phase, source, runtime, budget, payment, and evidence
  types and fixture constants.
- `src/research-plan.ts` owns plan creation and validation data.
- `server/index.ts` owns scope, plan approval, retrieval phases, purchase
  guards, protected evidence, synthesis, settlement labels, and receipts.
- `tests/e2e.spec.ts` and `tests/a11y.spec.ts` cover the current browser path;
  `tests/*.test.ts` cover domain, plan, and persistence behavior.

The current test/tooling defect is explicit and must be repaired before any
browser or visual gate is trusted: `playwright.config.ts` uses
`http://localhost:5173`, while `npm run dev` starts the Vite client on `5100`
and the API on `8788`. UO-00 owns the pending configuration repair. No current
application modification is implied by documenting this defect.

The audited baseline is `fc17701`, whose recent “remove demo labels” change
removed or weakened honest corpus/payment-mode presentation. The first
correctness slice must restore labels such as synthetic/fixture corpus and
fixture payment simulation versus XRPL Testnet validation. A compact label is
acceptable only when its expanded detail remains available. The UI must never
make fixture settlement look like a real publisher payment.

The current client also contains an unnecessary synthesis gate in the activity
rail: `ActivityRail` disables “Assemble cited answer” when `hasPurchase` is
false. The server synthesis path and research plan permit open-only completion.
UO-02 removes that client prerequisite while preserving plan approval, phase and
readiness checks, citation validation, protected-content rules, and truthful
empty/unsupported evidence states.

The following boundaries apply to every package:

- The server remains authoritative for plan approval, source allowlists,
  budget ceilings, quote binding, explicit purchase approval, settlement,
  fulfilment, protected-content access, citation spans, and fixture/live mode.
- No default test may spend money, submit a live payment, require a funded
  wallet, call a real source provider, or depend on network availability.
  Playwright uses fixture environment variables; payment tests use deterministic
  fixture responses.
- No package may add arbitrary web crawling, paywall bypass, OAuth/login,
  subscriptions, mainnet, generic commerce, or a live adapter without the
  required authorization.
- A budget cap is an authority limit, not a wallet balance and not a charge.
  `1 XRP ≈ S$10.00` is a fixture approximation, not live FX.
- A recommendation is not approval. Every purchase remains bound to the exact
  source, quote, amount, expiry, network/mode, resource/version, and explicit
  user approval.
- A successful settlement is not proof of content fulfilment. The UI must keep
  payment and access as separate states.
- Fixture sources define the allowed evidence universe. They are not claims
  that the fixture text is true, and “trusted sources” must not imply guaranteed
  accuracy.
- Existing `src/App.tsx` and `src/styles.css` are shared monoliths. Until the
  extraction slice is complete, all edits touching either file are serialized.
  Do not dispatch parallel workers with overlapping ownership of those files.

## Baseline and redesigned evidence

These are separate gates.

### Baseline gate

UO-00 records the repository state before redesign work. The testing worker
records actual output in `TESTING.md`; no result is presumed to pass.

```text
npm ci
npm run check:fast
npm run verify
npm run test:e2e
npm run test:a11y
```

The e2e and accessibility commands are not valid release evidence until the
`5173`/`5100` Playwright defect is repaired. If a command fails because of
environment, port, browser, or service startup, preserve the exact failure and
diagnose it. Do not weaken the product or tests to make the command green.

### Redesigned visual and interaction gate

After the relevant UI slices, run deterministic tests and perform manual review
at `360`, `390`, `768`, `1024`, and `1440` CSS pixels, plus 200% text zoom,
320 CSS pixel reflow, reduced motion, keyboard-only navigation, screen-reader
names/statuses, and modal focus restoration. Capture representative evidence
for Question, Sources/Budget, Review, unpaid open-evidence answer, paid-source
review, blocked/expired/recovery states, and final Answer. The parent copies
the evidence into the portable package and links it from `README.md`; the
testing worker records the matrix in `TESTING.md`.

Visual acceptance is not satisfied by passing unit tests. Unit tests and API
tests prove contracts; Playwright proves the reachable browser path; manual
review proves layout, reflow, focus, and comprehension details that the
automated suite cannot fully establish.

## Universal worker assignment and review contract

Every UO package below is a separate narrow assignment. The worker prompt must
include the package ID, this plan, the relevant brief/contract sections, exact
owned files, exact out-of-scope files, security/payment boundaries, required
tests, and a suggested scoped Conventional Commit. The orchestrator owns commits unless explicitly delegated. The worker must not create GitHub
issues, edit unrelated files, commit another package, or claim a human/live
gate occurred.

Every worker returns a report containing:

1. package ID and tested base/commit SHA (state uncommitted when applicable);
2. changed files and a one-sentence purpose for each;
3. acceptance criteria mapped to implementation and evidence;
4. commands run, complete results, and environment limitations;
5. screenshots or artifact paths when the package has a visual gate;
6. preserved security, payment, protected-content, fixture/live, and
   accessibility invariants;
7. unresolved risks, exact blockers, and the smallest decision needed; and
8. a statement that no out-of-scope files or behavior were changed.

The orchestrator reviews the complete diff, the report, and the generated
evidence before integration. A reviewer who did not implement the slice (the orchestrator may serve this role)
must return `PASS`, `REVISE`, or `BLOCKED` against each acceptance criterion.
The orchestrator then runs the package gate and confirms that the dependency
graph still holds. A reviewer pass is evidence, not permission to skip an
integration check.

Use DeepSeek Flash for simple inventories, copy, link checks, small isolated
changes and evidence bookkeeping; use GPT-5.6 Luna for UI state, accessibility,
contract changes and review. Default to moderate reasoning and increase it only
for complex state/payment questions. Do not use xhigh for every slice or require
one model for all work. If these models/tools are unavailable, the orchestrator
continues sequentially and records that fallback.

Throughout this plan, “stop/escalation” means stop the unsafe dependent action,
try safe local diagnosis, and continue independent work. It does not require
asking the user about routine reversible choices or known fixture limitations.
Prototype review gates are orchestrator/reviewer gates, not mandatory human
approval pauses. A missing human pilot must be reported honestly but does not
prevent finishing engineering verification.

## Work packages

### UO-00 — portable preflight and baseline repair

**Goal.** Establish a trustworthy baseline and make the browser test runner
address the application that `npm run dev` actually starts.

**Dependencies.** None.

**Owns.** `playwright.config.ts`, `scripts/stop-dev.mjs`, narrowly related launch configuration, and the baseline evidence/report inputs for
`ui-overhaul/TESTING.md`. The parent owns `ui-overhaul/README.md`; UO-00 does
not edit it.

**Assignment contract.** Repair the Playwright host/port mismatch and the cleanup script's missing 5100 entry; retain project-owned PID checks and graceful shutdown. Document or fix missing platform tools without claiming an occupied port is clear. Change only closely related test-runner/launch configuration required to make the existing test
commands target the Vite client on `5100` while the API remains available on
`8788`. Do not change `src/App.tsx`, `src/styles.css`, server behavior, or test
assertions to conceal failures.

**Acceptance.** `npm run dev` and Playwright resolve to the same client URL;
the API proxy still reaches the server; no test silently targets an unrelated
process; fixture mode is explicit; and the baseline results are recorded with
the current known failures separated from tooling failures.

**Test evidence.** Run `npm ci`, `npm run check:fast`, `npm run verify`,
`npm run test:e2e`, and `npm run test:a11y`. If the current assertions expose
product defects, record them for UO-01/UO-02 instead of rewriting them here.

**Stop/escalation.** Stop on an unexplained port collision, an existing process
that cannot be safely identified, a required application change, or a browser
installation problem that cannot be distinguished from product failure.

**Suggested model.** `deepseek/deepseek-flash` for the bounded repair; Luna/orchestrator review.

**Done gate.** Reviewer confirms only bounded runner/cleanup configuration changed;
the orchestrator can reproduce the commands from a clean checkout; and the
baseline report names every remaining failure.

### UO-01 — scope truthfulness and honest runtime labels

**Goal.** Prevent an arbitrary question from being presented with unrelated
data-centre evidence, and restore honest fixture/corpus/payment-mode language
removed by the current `HEAD`.

**Dependencies.** UO-00 baseline/preflight.

**Owns.** The serialized correctness slice in `src/App.tsx` and
`server/index.ts`, plus narrowly focused additions to `tests/domain.test.ts`,
`tests/e2e.spec.ts`, or a new focused test file if needed. It may inspect
`src/domain.ts` but must not broaden the domain contract without review.

**Assignment contract.** Add a truthful supported-scope decision before the
client renders fixture evidence as an answer. A supported canonical fixture
question must continue to work. An unsupported question must show the scope,
preserve/edit the question, and provide a safe next action without fabricating
an answer. Restore visible labels for synthetic/fixture corpus and fixture
payment simulation versus XRPL Testnet validation. Keep source profiles as
authorization boundaries and do not add a real adapter.

**Acceptance.**

- Unsupported prompts produce an explicit unsupported-scope state and never
  render data-centre claims as if they answered the prompt.
- Supported fixture prompts retain the existing deterministic path.
- Corpus mode, settlement mode, network, and payment state remain separate and
  truthful in the header, source/evidence detail, purchase/receipt state, and
  answer limitations where relevant.
- Fixture settlement says it is simulation and did not pay a real publisher;
  XRPL Testnet is labelled as Testnet only when runtime evidence supports it.
- No premium body becomes public before verified purchase, and citations still
  reference accessible spans.

**Test evidence.** Add a supported/unsupported browser or API regression,
assert absence of unrelated fixture claims in the unsupported path, assert the
honest labels, and run the relevant unit/e2e/a11y checks in fixture mode.

**Stop/escalation.** Stop if truthfulness requires selecting a real provider,
legal/partner authorization, a new retrieval contract, or a product decision
about unsupported domains. Escalate the smallest decision; do not invent
coverage.

**Suggested model.** `gpt-5.6-luna`, `high`; review by a worker who did not
touch the scope logic.

**Done gate.** Unsupported and supported paths are independently reviewable;
the `HEAD` label regression is covered; and the orchestrator verifies the
server remains authoritative.

### UO-02 — open-evidence answer gate

**Goal.** Remove the unnecessary client-side requirement for a `BUY` before
answer synthesis when approved open evidence is sufficient.

**Dependencies.** UO-01.

**Owns.** The serialized synthesis/action portion of `src/App.tsx`, with only
the focused tests needed in `tests/e2e.spec.ts` and relevant server/domain tests.
`server/index.ts` may be changed only if a narrow server readiness mismatch is
proved; the existing server synthesis and citation guards are the baseline.

**Assignment contract.** Replace the `hasPurchase` client gate with a
readiness/evidence decision. An approved run with usable open evidence must
offer “Answer from available evidence”. A proposed premium source remains
optional and separately reviewable. Empty, unsupported, invalid, or
uncitable evidence must remain blocked or limited with a truthful recovery
state.

**Acceptance.**

- Open-only evidence can reach a cited answer without a purchase.
- No `BUY` is created as a side effect of synthesis and no purchase modal is
  opened implicitly.
- Plan approval, phase/readiness, citation span validation, protected-content
  access, and server authority remain intact.
- The UI distinguishes “premium proposed”, “no premium selected”, “blocked”,
  “open evidence sufficient”, and “no usable evidence”.
- Fixture tests make no live payment or provider call.

**Test evidence.** Add a deterministic open-only e2e path and negative checks
for empty/unsupported evidence. Preserve the existing paid-path regression and
premium-body protection test. Run unit, e2e, and a11y checks.

**Stop/escalation.** Stop if the server cannot distinguish open evidence from
protected evidence without changing a security contract, or if a retry could
cause payment or duplicate fulfilment.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** The client gate is gone, an unpaid cited answer is proven, and
the paid path still requires exact manual approval.

### UO-03 — state map and contract reconciliation

**Goal.** Define the complete state machine and ownership before rebuilding the
visual interface.

**Dependencies.** UO-01 and UO-02 correctness semantics.

**Owns.** A self-contained `ui-overhaul/STATE-MAP.md` and any narrowly scoped
contract notes required to reconcile `docs/contracts/DESIGN.md` and
`docs/contracts/UX-CONTRACT.md`. It does not own production UI code. If the
contract documents are updated, preserve server-owned security and evidence
rules and record the exact changed clauses in the worker report.

**Assignment contract.** Produce a state/transition map covering home/demo,
draft, Question, Sources, Budget, Review, plan approval, research phases,
open-only answer, premium proposal, exact purchase review, blocked/expired/
pending/unknown payment, fulfilment failure, pause/resume, reload/stale run,
unsupported scope, synthesis fallback, and final cited answer. For each state
specify owner, user decision, default/secondary/advanced placement, loading,
error, blocked, recovery, responsive, keyboard, and announcement behavior.

**Acceptance.** Every brief acceptance criterion maps to a state or transition;
purchase approval is separate from plan approval; the cap is distinct from
wallet balance and actual price; payment is distinct from access; and no state
requires a dead History/Library destination.

**Test evidence.** State transition table, invariant checklist, contract diff
if any, and orchestrator review notes. This is a design contract, so do not
claim visual or participant validation yet.

**Stop/escalation.** Stop on contradictory server contracts, a required new
product decision, or a state that can only be represented by weakening an
existing guard.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** Parent/orchestrator approves the state map before prototype or
production UI work begins.

### UO-04 — clickable prototype and high-fidelity screen contract

**Goal.** Validate the information architecture and recovery paths before
editing the shared UI monolith.

**Dependencies.** UO-03.

**Owns.** A portable, editable prototype under `ui-overhaul/prototype/` and
links/usage notes in the worker report. It may use local HTML/SVG or an
editable design artifact already tracked in the repository, but it must run
without a cloud account or hidden asset.

**Assignment contract.** Make the complete path clickable: first-run home/demo entry, returning-user resume, supported and
unsupported question, source selection, budget review, readable plan with
advanced disclosure, open-only answer, premium recommendation, exact purchase
approval, cancel/expiry/block, pause/resume, reload/recovery, and citation
inspection. Use neutral sans-serif working surfaces with one accent and label
fixture/simulation states honestly. Include desktop and narrow layouts.

**Acceptance.** Reviewers can identify the next action, cap versus charge,
recommendation versus approval, open versus protected evidence, and the
available recovery action without consulting this conversation. The prototype
does not imply unsupported live providers or payment.

**Test evidence.** After reviewing the low-fidelity flow, add representative high-fidelity Question, Review, Research, purchase approval and Answer screens at desktop/mobile sizes plus a token sheet. These may be the same local prototype refined after its structural gate. Include a click-through checklist tied to `STATE-MAP.md`, prototype
URL/file path, representative captures, the accepted high-fidelity screen set, and a resolved token/component inventory. No claim of user research is allowed.

**Stop/escalation.** Stop if the prototype needs a new backend capability to
demonstrate a state, or if the design requires a third simultaneous desktop
column, nested mandatory dialogs, or hidden purchase consent.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** The orchestrator and reviewer accept the state coverage, information hierarchy, five named high-fidelity screen types at desktop/mobile sizes, and token sheet before UO-05. Record that acceptance; do not defer high fidelity to the production rebuild.

### UO-05 — semantic tokens and component extraction

**Goal.** Establish the quiet visual system and create safe seams before
parallel UI implementation.

**Dependencies.** UO-04.

**Owns.** Serialized changes to `src/styles.css`, `src/App.tsx`, and new
`src/ui/` files if extraction is justified. Small type-only changes may touch
`src/domain.ts`. No feature slice may edit these same files in parallel.

**Assignment contract.** Extract or consolidate shared primitives for
`StepHeader`, `QuestionComposer`, `SourceProfileList`, `BudgetSummary`,
`ProgressPanel`, `SourceRow`, `ActivityFeed`, `Disclosure`, `EvidenceDrawer`,
and `ApprovalModal`. Add semantic tokens for background, surface, text, muted
text, border, accent, success, warning, danger, focus ring, radius, spacing,
and type scale. Use a neutral sans-serif for interface and answer text; keep an
expressive face limited to home/demo if retained. Honor reduced motion.

**Acceptance.** Extraction preserves current behavior and server calls; token
usage replaces page-specific overrides; one accent carries primary action while
semantic colors have text equivalents; focus is visible; and the page has no
new horizontal overflow. Existing fixture labels and UO-01/UO-02 behavior
remain intact.

**Test evidence.** `npm run typecheck`, `npm test`, `npm run build`, focused
Playwright/a11y checks, and before/after screenshots of unchanged paths. This
is the seam gate, not the final visual gate.

**Stop/escalation.** Stop on a shared-state conflict, an extraction that
changes API/security semantics, or a need to rewrite the server to support a
visual component.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** The orchestrator confirms component ownership is explicit and
future workers can edit disjoint files or serialized component areas.

### UO-06 — guided setup, draft, and plan review

**Goal.** Implement the distinct home/demo entry, returning-user entry, and Question → Sources → Budget → Review as a calm, resumable setup sequence.

**Dependencies.** UO-05 and UO-03.

**Owns.** Extracted setup components under `src/ui/` and their integration in
`src/App.tsx`; setup styles/tokens in `src/styles.css`; focused browser tests.
Do not change purchase settlement or source adapters.

**Assignment contract.** Add a first-run home/demo entry with one prompt/launch action and grounded fixture examples. A dedicated marketing route or richer expressive treatment is optional; a calm entry within the app is acceptable. Record that choice in UO-04. Returning users resume a draft/run without repeating the explainer; keep the product shell quiet and avoid dead navigation. Make one primary decision per surface. Keep the
question editable, source profiles explicit with a selected count, and budget
labelled “Maximum research spend”. Explain the fixture conversion, cap versus
balance versus price, and that setting a cap is not a charge or purchase
consent. Show a readable review summary by default and put advanced fields
behind progressive disclosure. Preserve Back, Save draft, and safe resume.

**Acceptance.** First-run entry and returning-user resume work as accepted in UO-04, with one clear launch action and no obligatory marketing detour. The sequence is coherent and resumable; no chained mandatory
dialogs; source selection has an accessible minimum-selection error; plan
approval is distinct from purchase approval; arbitrary unsupported prompts use
UO-01; and an arbitrary horizon is not silently imposed on a non-demo prompt.

**Test evidence.** Keyboard completion of setup, draft/back preservation,
source selection, budget value and approximate SGD display, plan approval gate,
200% zoom, 320 reflow, and responsive screenshots at all required widths.

**Stop/escalation.** Implement a small versioned local draft schema as needed, documenting migration and not storing protected bodies or credentials. Escalate only if draft persistence requires changing server authority,
if an edit could silently widen an approved mandate, or if the current server
does not expose a safe state for the proposed control.

**Suggested model.** `gpt-5.6-luna`, `high`; serialize all `App.tsx` edits.

**Done gate.** Parent reviews the complete setup path and confirms no purchase
or live charge occurs during default tests.

### UO-07 — centered research workspace and evidence organization

**Goal.** Replace the dense three-region workbench with one centered answer/
progress area and secondary Sources/Activity inspection.

**Dependencies.** UO-05 and UO-06; UO-02 must remain green.

**Owns.** Workspace components under `src/ui/`, integration in `src/App.tsx`,
workspace styles in `src/styles.css`, and focused browser/a11y tests.

**Assignment contract.** Keep the question, phase, pause/resume, and compact
brief/budget summary in the header. Use Sources and Activity as secondary tabs
or equivalent disclosure. Make source rows stable and non-overlapping: title,
access state, relevance, family, price, and one action area. Keep a persistent
`Cap X XRP · Spent Y XRP · Remaining Z XRP` strip with the approximation beside
it. Remove dead History/Library navigation until their contracts exist; label
unavailable capabilities honestly.

**Acceptance.** There is no default three-column desktop layout; the document
owns the main scroll; source actions remain available at every required width;
blocked, skipped, open, premium preview, and unlocked states are distinct; and
open-only answer remains reachable without a BUY.

**Test evidence.** Source row stress cases with long titles/prices/actions,
tab/keyboard navigation, narrow stacking, no horizontal overflow, reduced
motion, activity status announcements, and screenshots at every required
width.

**Stop/escalation.** Stop if visual parity requires adding dead History/Library
routes, hiding a source action, weakening the open-only gate, or changing a
server-owned source state.

**Suggested model.** `gpt-5.6-luna`, `high`; no parallel `App.tsx` worker.

**Done gate.** Orchestrator verifies the centered workspace against S01–S09
defects and keeps S10–S11 as inspiration only, never as current product
evidence.

### UO-08 — exact purchase approval and recovery states

**Goal.** Make paid-source control precise, calm, and recoverable without
turning optional paid evidence into a prerequisite for answering.

**Dependencies.** UO-07 and UO-02.

**Owns.** `ApprovalModal`/purchase state components, their `src/App.tsx`
integration, relevant `src/styles.css`, and focused payment/access tests. The
server may be changed only for a demonstrated contract bug, not to bypass an
existing guard.

**Assignment contract.** Show exact source, reason, amount in XRP and SGD
approximation, cap/spent/remaining after purchase, quote expiry, network/mode,
protected-content terms, and a final “Approve purchase of X XRP” action. Cancel
must be side-effect free. Cover quote expiry, pending/unknown outcome,
settlement/access mismatch, blocked over-cap/over-ceiling, skip, and recovery.
Never blindly retry an unknown payment outcome.

**Acceptance.** Exact quote binding and explicit approval survive the redesign;
fixture mode says simulation and does not pay a real publisher; configured XRPL Testnet mode is distinguished from a transaction that has actually validated; protected content remains locked before purchase;
post-purchase access is separate from settlement; idempotency is preserved;
and open-only answer remains available.

**Test evidence.** Fixture tests for cancel, expired quote, over-cap block,
approved unlock, duplicate submit, unknown/pending outcome, access failure, and
receipt labels. Default tests do not contact XRPL or incur charges.

**Stop/escalation.** Stop for a funded wallet, live network proof, payee/legal
authorization, provider selection, or any retry ambiguity that could
double-settle. Those are external gates, not UI assumptions.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** Independent review confirms no purchase can occur merely by entering a review screen, accepting a recommendation, or retrying a request. Keyboard activation of the explicit, fully reviewed purchase-confirm button remains supported accessibly.

### UO-09 — Answer, citations, uncertainty, and truthful recovery copy

**Goal.** Make the final answer understandable, inspectable, and honest about
evidence quality and limits.

**Dependencies.** UO-02, UO-07, and UO-08.

**Owns.** Answer/citation components under `src/ui/`, integration in
`src/App.tsx`, any narrow type support in `src/domain.ts`, and focused tests.
`server/index.ts` remains the citation/validation authority.

**Assignment contract.** Present a concise answer, uncertainty/limitations,
claim-level citations, and evidence access labels. Keep quote hashes and raw
technical identifiers behind inspection. Distinguish open, premium/unlocked,
fixture, fallback, and unavailable evidence. Show what changed after paid
evidence only when the accessible evidence supports it. Never publish an
invalid citation or a fabricated completed answer.

**Acceptance.** Every displayed citation opens an accessible span; unsupported
or empty evidence is a limitation state; synthesis fallback is labelled;
fixture corpus/payment mode is honest; and an approved open-evidence run can
produce a cited answer without a purchase.

**Test evidence.** Print/export preserves readable answer, citations and limitations without application chrome. Run citation-resolution tests, protected-body absence checks,
open-only answer, paid-answer impact, synthesis validation failure/fallback,
and answer reload/recovery checks.

**Stop/escalation.** Stop if an answer claim needs a source outside the
allowlist, a protected body before fulfilment, unsupported confidence scoring,
or an unapproved provider.

**Suggested model.** `gpt-5.6-luna`, `high`.

**Done gate.** Orchestrator reviews answer truthfulness with the scope and
payment labels, not only typography or screenshot polish.

### UO-10 — accessibility, responsive hardening, demo evidence, and pilot handoff

**Goal.** Finish the redesigned acceptance surface and package reproducible
evidence for review without claiming human validation that has not happened.

**Dependencies.** UO-06 through UO-09 and UO-00.

**Owns.** Narrow fixes in the extracted UI components and `src/styles.css`,
`tests/e2e.spec.ts`, `tests/a11y.spec.ts`, and any dedicated visual checks.
The testing worker owns `ui-overhaul/TESTING.md`; the parent owns
`ui-overhaul/README.md` and copied screenshots.

**Assignment contract.** Verify 360/390/768/1024/1440 widths, 200% zoom, 320
reflow, reduced motion, keyboard-only completion, screen-reader labels,
focus-visible behavior, modal focus trap/Escape/restore, target sizes,
contrast, error identification, and live-region announcements. Prepare a
five-person qualitative pilot protocol as a proposal only; do not claim that
sessions occurred.

**Acceptance.** No body horizontal overflow or clipped critical action exists;
all source actions and purchase consent remain visible; dialog behavior is
safe; status announcements are meaningful rather than noisy; and screenshot
evidence covers supported, unsupported, open-only, paid-review, blocked, and
answer states. The package clearly separates automated results, manual visual
checks, and future participant findings.

**Test evidence.** `npm run verify`, `npm run test:e2e`, `npm run test:a11y`,
manual matrix, screenshot paths, reduced-motion check, and keyboard/focus
notes, all recorded in `TESTING.md` and linked from the parent README.

**Stop/escalation.** Stop on a critical purchase/scope/accessibility/data-loss
defect, a browser environment failure that prevents evidence, or a request to
claim #55 participant results without participants.

**Suggested model.** `gpt-5.6-luna`, `high`, with an independent accessibility
reviewer.

**Done gate.** All critical acceptance failures are fixed or explicitly
recorded as release blockers with an owner and smallest next action. Aesthetic
preference alone is not a blocker.

## Issue mapping and dependency policy

This plan maps the requested existing issues into implementation touchpoints;
it does not create, edit, close, or reinterpret GitHub issues.

| Issue | Existing concern in local docs/context | UO touchpoints | Policy |
| --- | --- | --- | --- |
| #58 | Umbrella UI-overhaul execution item represented by this portable plan | UO-00 through UO-10 | Decompose into narrow local packages; no new GitHub issue is required. |
| #18 | Truthful local research foundation and scope/evidence truthfulness | UO-01, UO-02, UO-09 | Correctness baseline first; preserve server evidence and fixture boundaries. |
| #19 | Official analyst/product experience and presentation direction | UO-03 through UO-10 | The calm guided flow supersedes conflicting presentation rules while keeping domain contracts. |
| #33 | Earlier presentation restrictions referenced by the redesign brief | UO-03, UO-05, UO-06, UO-07 | Resolve only presentation conflict; do not weaken security/payment/citation rules. |
| #35 | Research plan and plan review | UO-03, UO-06 | Readable summary first, advanced editing behind disclosure, approval remains server-gated. |
| #36 | Manual purchase approval | UO-08 and UO-10 | Exact quote approval stays explicit; no auto-buy or hidden consent. |
| #37 | Dossier/evidence impact presentation | UO-07, UO-09 | Answer and impact remain grounded in accessible spans and uncertainty. |
| #38 | Reopenable local report history | UO-07 | Do not add dead navigation; implement only when the history contract exists. |
| #39 | Purchased article library and access/licence presentation | UO-07, UO-09 | Do not make library a visual blocker; preserve protected-body/licence rules. |
| #42 | Editable, non-duplicate multi-purchase plan | UO-08, later extension | UI supports one exact approval per quote; full multi-purchase behavior is a dependency only when implemented. |
| #43 | Claim-level conflict and uncertainty statuses | UO-07, UO-09 | Use labelled uncertainty and competing evidence; avoid unsupported confidence percentages. |
| #50 | Wallet/Testnet payment and external proof | UO-01 labels, UO-08 boundaries | Fixture conformance is local; funded wallet, live settlement, and explorer proof remain external gates. |
| #52 | Real source adapter selection/authorization | UO-01 scope, UO-03 state map | No real adapter is needed for this redesign; use approved deterministic fixtures. |
| #55 | Human validation sessions | UO-10 pilot protocol | Automated checks do not replace participant sessions or claim their findings. |

The live adapter, auth, wallet, library, and provider roadmap must not become a
single blocker for the redesign. The redesign can be implemented and reviewed
against deterministic fixture states while #50, #52, #55, #38, and #39 retain
their own external or future contracts. Only a direct invariant failure blocks
the current slice.

## Critical path and dependency DAG

```text
UO-00  preflight + baseline
  |
  +--> UO-01  unsupported scope + honest corpus/payment labels
  |       |
  |       +--> UO-02  open-evidence answer gate
  |                 |
  +-----------------+--> UO-03  state map + contract reconciliation
                              |
                              +--> UO-04  clickable prototype
                                          |
                                          +--> UO-05  tokens + component extraction
                                                      |
                                                      +--> UO-06  setup/draft/review
                                                      |       |
                                                      |       +--> UO-07 workspace
                                                      |                    |
                                                      |                    +--> UO-08 purchase/recovery
                                                      |                    |       |
                                                      |                    |       +--> UO-09 answer/citations
                                                      |                    |                    |
                                                      |                    +--------------------+--> UO-10 hardening/evidence
                                                      |
                                                      +--> (no parallel App.tsx/styles.css edits)
```

UO-01 and UO-02 are the correctness baseline and must precede design polish.
UO-03 and UO-04 must be accepted before the actual UI rebuild. UO-05 creates
the seams needed for safe parallelism; until then, all shared monolith edits
are serialized. UO-06, UO-07, UO-08, and UO-09 may only be parallelized after
the extracted ownership is disjoint and the orchestrator explicitly confirms
it; default execution remains serial because their state semantics overlap.

## Narrow PR and commit slice plan

Each package gets one focused commit and one review packet. Use the repository's
Conventional Commit format and keep the subject imperative, lower-case, and
scoped:

| Package | Suggested commit | Review focus |
| --- | --- | --- |
| UO-00 | `chore(test): align playwright with vite client` | Runner points to `5100`; baseline failures remain visible. |
| UO-01 | `fix(scope): reject unsupported fixture questions honestly` | No mismatched evidence; corpus/payment labels restored. |
| UO-02 | `fix(answer): allow synthesis from usable open evidence` | No BUY prerequisite; citations and server guards preserved. |
| UO-03 | `docs(ui): map redesign states and contracts` | State coverage and invariant ownership. |
| UO-04 | `docs(ui): add clickable research flow prototype` | Complete happy/error/recovery click path. |
| UO-05 | `refactor(ui): extract semantic tokens and shared primitives` | Behavior-preserving seams and token ownership. |
| UO-06 | `feat(setup): guide question sources budget and review` | Draft safety, readable review, budget language. |
| UO-07 | `feat(workspace): center answer and organize evidence tabs` | No three-column default; source-row clarity. |
| UO-08 | `feat(purchase): add exact approval and recovery states` | Quote binding, cancel, expiry, idempotency, fixture safety. |
| UO-09 | `feat(answer): show cited evidence and uncertainty clearly` | Open/premium/fallback labels and citation inspection. |
| UO-10 | `test(ui): harden responsive accessibility and demo evidence` | Automated/manual matrix; no fabricated pilot results. |

Do not combine UO-01/UO-02 with the visual rebuild. Do not combine prototype
artifacts with production UI code. Do not combine payment recovery with live
wallet work. A rollback must be possible at every row in the table.

## Orchestrator integration and stop rules

For each returned worker packet, the parent/orchestrator:

1. checks the complete diff against the owned-file list and current dirty tree;
2. verifies the worker did not alter GitHub, secrets, live provider settings,
   or unrelated application behavior;
3. runs the focused package checks, then `npm run check:fast` after integration;
4. requests a fresh independent review with the package's acceptance criteria;
5. integrates only after review and tests agree; and
6. records the gate in `STATUS.md` and the detailed result under `evidence/<work-id>/`; updates runbook instructions only when behavior changes.

Escalate rather than guessing when the work needs a new product decision,
source/payment authorization, funded Testnet wallet, participant, provider,
unexplained flaky test, potential double payment, protected-body exposure,
citation mismatch, data loss, or a weakening of accessibility/security guards.
Continue unrelated safe packages when one of those external gates is blocked.

## Rollback and anti-scope-creep rules

Every UO slice must have one reversible commit and a focused acceptance report.
If a slice fails review, revert or repair only that slice in its worktree; do
not reset a shared branch or discard unrelated user changes. If a visual slice
reveals a contract problem, return to the state map and create the smallest
contract correction instead of broadening the UI package.

The following are explicit scope-creep signals and require escalation:

- adding a real source, provider, wallet, authentication, hosting, or library
  because a mockup appears to need it;
- adding a dashboard card, navigation destination, or metric solely because an
  API exists;
- making paid evidence mandatory for answer synthesis;
- exposing quote IDs or raw adapter details by default, secrets anywhere, or protected bodies before verified access;
- turning the fixture exchange rate into live money pricing;
- replacing a truthful limitation with a fabricated success state;
- expanding an approved mandate without a versioned/reapproved contract;
- rewriting the entire `App.tsx`/`styles.css` monolith before the prototype and
  extraction gates; or
- claiming that automated checks are user research, live settlement, legal
  authorization, or a deployment rehearsal.

The final release recommendation is based on evidence, not aesthetic
completion. A critical scope, purchase, access, citation, keyboard, focus,
reflow, or data-loss defect is a release blocker until fixed or explicitly
accepted by the responsible product decision-maker. A missing future adapter,
library, funded wallet, or participant session is a deferred external gate and
must remain labelled as such.
