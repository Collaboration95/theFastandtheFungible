# ResearchAgent UI overhaul state map (UO-03)

Status: design contract for the implementation slices; this document does not
claim that the redesigned UI is implemented or that any manual pilot occurred.

This map turns the accepted design brief into named, reviewable states. It is
the semantic contract between setup screens, the research workspace, and the
server-owned run/payment/evidence lifecycle. A state may be a route, panel,
tab, inline status, or modal; it is not required to be a full page. The
preferred user path is:

```text
Home/demo or returning draft
  -> Question -> Sources -> Budget -> Review
  -> plan approval -> Research
  -> open-only answer, or optional premium proposal
  -> exact purchase review -> purchase/fulfilment recovery
  -> final cited answer
```

The arrows describe guidance, not a permission shortcut. The server remains the
authority for supported scope, draft/run revision, plan approval, quote binding,
budget ceilings, settlement, protected-content access, and citation validity.

## State vocabulary and ownership

### State IDs

| ID | State | Durable or ephemeral | Canonical owner |
| --- | --- | --- | --- |
| H0 | First-run home/demo | Local until launch | `HomeShell` + `QuestionComposer` |
| H1 | Returning draft / recent run | Draft/run persisted | `DraftStore` or run hydration + `HomeShell` |
| Q1 | Question | Draft field | `QuestionComposer` + scope authority |
| S1 | Sources | Draft field / source selection | `SourceProfileList` + scope/source authority |
| B1 | Budget | Draft field, then server mandate | `BudgetEditor` + server budget authority |
| V1 | Review | Server-generated plan snapshot | `PlanSummary` + plan authority |
| V2 | Plan approval | Server mutation boundary | `PlanSummary` + run authority |
| R1 | Research | Persisted run | `ProgressPanel` + run authority |
| A1 | Open-only answer | Synthesis request/result | `AnswerPanel` + synthesis/citation authority |
| P1 | Premium proposal | Server candidate metadata | `SourceRow` + purchase-plan authority |
| P2 | Exact purchase review | Ephemeral modal bound to quote | `ApprovalModal` + purchase authority |
| P3 | Purchase outcome | Persisted purchase state | `ActivityFeed` + purchase/settlement authority |
| F1 | Fulfilment failure | Persisted recovery state | `SourceRow`/`ActivityFeed` + access authority |
| T1 | Pause/resume | Persisted run control state | `ProgressPanel` + run authority |
| L1 | Reload/stale run | Hydration/reconciliation | run/draft authority + `RecoveryBanner` |
| U1 | Unsupported scope | Scope decision | scope authority + `ScopeNotice` |
| E1 | Synthesis fallback | Validated fallback answer state | synthesis/citation authority + `AnswerPanel` |
| A2 | Final cited answer | Persisted validated result | `AnswerPanel` + citation authority |

`Client` in this document means presentation and intent only. It may preserve a
draft and disable duplicate submission, but it cannot grant scope, purchase,
access, or citation validity. `Server` means the current authoritative API and
its persisted state, including deterministic fixture behavior.

### Placement legend

- **Default**: visible in the current decision surface and usable without
  opening another disclosure.
- **Secondary**: available in a tab, drawer, activity stream, or compact
  disclosure after the primary decision is clear.
- **Advanced**: hidden behind progressive disclosure or an explicit inspection
  action; never required to understand the default decision.

The default surface has one primary action. Back, Save draft, and recovery
actions remain adjacent to the state that owns them. A Skip action is shown only
when the corresponding decision is optional and the server accepts the skip.

## Transition contract

| From | Trigger / decision | To | Server gate and preserved data |
| --- | --- | --- | --- |
| H0 | Enter supported question or choose/edit example | Q1 | No run is created; question stays editable; synthetic fixture scope remains labelled. |
| H0 | Submit unsupported question | U1 | Scope authority rejects unsupported scope; no unrelated evidence or run is shown. |
| H1 | Resume saved draft | Q1, S1, B1, or V1 | Restore the last safe draft step and revision; do not repeat the landing explainer. |
| H1 | Resume recent run | R1, T1, P3, F1, or A2 | Hydrate server state; never recreate purchases or discard receipts. |
| Q1 | Continue with valid question | S1 | Draft is preserved; no spending or protected access occurs. |
| Q1 | Back / Save draft | H0 or H1 | Persist question and last safe step; no destructive reset. |
| S1 | Select at least one allowed profile | B1 | Persist profile IDs/families; show selected count and allowed-to-read meaning. |
| S1 | Continue with no profile | S1 | Inline minimum-selection error; no navigation; accessible reason on control. |
| S1 | Back / Save draft | Q1 or H1 | Preserve question and source selection. |
| B1 | Set cap and continue | V1 | No charge and no purchase consent; server validates mandate when run/plan is created. |
| B1 | Back / Save draft | S1 or H1 | Preserve cap, source choices, and revision. |
| V1 | Open advanced settings | V1 | Reveal only; no authority change until edited value is validated and reapproved. |
| V1 | Back / Save draft and exit | B1 or H1 | Preserve generated plan/draft snapshot; no retrieval. |
| V1 | Approve plan & start research | V2 | Server plan approval required; this is not purchase approval. |
| V2 | Plan approval accepted | R1 | Persist approved plan/version; retrieval and access gates remain active. |
| V2 | Plan rejected/stale | V1 or L1 | Refresh authoritative plan; never run from a stale or unapproved mandate. |
| R1 | Open evidence is usable | A1 | Synthesis may proceed without BUY; phase/readiness/citation guards still apply. |
| R1 | Premium candidate may help | P1 | Recommendation only; protected body remains unavailable; open answer stays available if evidence is usable. |
| R1 | User selects Review purchase | P2 | Server quote is fetched/bound; no charge merely by opening review. |
| R1 | User selects Skip | R1/P3 | Server records optional skip and reason where required; no purchase. |
| R1 | Budget/policy blocks candidate | P3 or R1 | Server-owned blocked reason; Continue without it remains available; no bypass purchase CTA. |
| R1 | Pause | T1 | Server preserves safe run state; progress is not invented. |
| R1 | Reload/network interruption | L1 | Reconcile server run/revision before enabling mutations. |
| P1 | Continue without paid source | A1 or R1 | Answer from accessible evidence; recommendation remains distinct from approval. |
| P1 | Review purchase | P2 | Exact source and current quote become modal context. |
| P2 | Cancel / Escape when safe | P1 | Side-effect free; restore focus to invoking source action. |
| P2 | Confirm exact quote | P3 | Explicit user approval plus idempotency key; server rechecks quote, cap, ceiling, mode, and authorization. |
| P2 | Quote expired/stale | P3 then P1 | No charge; return to row with Re-quote; old quote cannot be approved. |
| P3 | Pending / unknown response | L1/P3 | Reconcile by idempotency/status; never blind retry or claim paid/unlocked. |
| P3 | Settled and access verified | R1/A1/A2 | Unlock only accessible spans; receipt and fixture/Testnet labels remain visible. |
| P3 | Settled but access pending/failed | F1 | Payment and access are separate; no duplicate charge; recover fulfilment/receipt. |
| T1 | Resume | R1 | Server confirms current phase/revision before continuing. |
| T1 | Stop | H1 or terminal run state | Stop is not delete; preserve run, receipts, evidence, and limitations. |
| L1 | Reload reconciled | Last authoritative state | Discard only stale client assumptions; preserve safe draft/run state. |
| L1 | Draft/run unavailable | H1 or H0 | Explain what could not be restored; never fabricate completion or delete persisted history. |
| A1 | Synthesis validates citations | A2 | Only accessible evidence spans may become displayed citations. |
| A1 | Empty/unsupported evidence | U1 or limitation state | No completed-looking answer; explain evidence limitation and next safe action. |
| A1 | Provider timeout/invalid draft/unavailable span | E1 | Deterministic fallback only if it validates; label fallback and limitations. |
| E1 | Retry with usable evidence | A1 | Preserve fallback text until replacement validates; no invalid draft becomes final. |
| A2 | New research | H0/Q1 | Reset only current client thread; do not rewrite completed run or receipts. |

### Safe transition rules

1. **No implicit authority.** Moving into Review, opening P1/P2, accepting a
   recommendation, or reloading never implies a purchase. Plan approval and
   exact purchase approval are separate mutations.
2. **No unsafe retry.** A pending or unknown purchase response must reconcile
   server state by idempotency/status before any retry control is enabled.
3. **No protected leakage.** Premium preview can expose metadata, preview,
   price, and terms only. Exact protected spans require verified access.
4. **No stale widening.** A client edit that changes source scope, cap, or
   per-source ceiling after approval must create a new version or require the
   server's reapproval path; it must not silently widen the mandate.
5. **No fabricated completion.** Unsupported scope, empty evidence, invalid
   citations, unknown payment, access failure, and unavailable drafts are
   limitation/recovery states, never successful final answers.

## State cards

Each card records placement, owning authority, actions, complete recovery set,
responsive behavior, and keyboard/announcement requirements from the brief.

### H0 — First-run home/demo

- **Owner and purpose:** `HomeShell` and `QuestionComposer` own the first-run
  entry. Scope authority decides whether a submitted prompt belongs to the
  approved fixture/demo scope. No server run exists yet.
- **Decision/actions:** Default shows one question composer, one primary
  “Start research” action, grounded broad examples, and a compact How it works
  disclosure for Question, Evidence, and Answer. Keep the chosen example as
  editable text. Show that the demo uses approved synthetic data-centre source
  profiles; “allowed to read” is not a claim of source truth.
- **Placement:** Composer and scope note are **default**. Example prompts and
  How it works are **secondary**. Fixture/adapter detail is **advanced**.
- **Loading/error/blocked/recovery:** Disable duplicate submit while evaluating
  scope; show a named progress status. Empty input is an inline field error.
  Unsupported input transitions to U1. Network failure preserves the typed
  question and offers Retry. No server run or payment is created by a failed
  launch.
- **Responsive:** At 360/390px stack hero, composer, examples, and explanation;
  examples remain ordinary inputs/buttons, not a horizontal carousel. At
  768/1024/1440px keep one focused entry column; richer accent/illustration is
  allowed only here. No horizontal overflow at 320px reflow or 200% zoom.
- **Keyboard/announcements:** Native labelled textarea/input; IME-safe Enter
  submits and Shift+Enter inserts a line break. Tab order follows heading,
  composer, examples, primary action, then disclosure. Announce scope checking
  and unsupported result in a polite live region; do not read decorative copy.

### H1 — Returning draft or recent run

- **Owner and purpose:** `DraftStore`/run hydration and `HomeShell` show the
  user's last safe local draft or server run. This state is not a repeat of H0.
- **Decision/actions:** Default is “Resume draft” or “Resume research” with a
  small “New research” action. Show last step/phase, question, and compact
  saved-at/revision context. New research resets only the current client
  thread; it does not delete or rewrite persisted runs, receipts, or evidence.
- **Placement:** Resume and question/phase summary are **default**. Draft
  details and prior activity are **secondary**. Reset/new-thread semantics are
  a quiet secondary action, never a destructive clear button.
- **Loading/error/blocked/recovery:** Hydration announces “Restoring…” and
  disables duplicate resume. Stale or unavailable data moves to L1. Preserve
  locally typed draft on fetch failure and offer Retry; explain if only a local
  draft is available. Never pretend a completed run was restored.
- **Responsive:** Resume remains full width and visible at narrow widths; long
  questions wrap safely. At desktop, use one quiet workspace entry, not a
  dashboard of cards or dead History/Library routes.
- **Keyboard/announcements:** Resume is the first actionable control; focus
  lands on the restored step heading after success. Announce restored step and
  revision, or the exact recovery limitation. New research is an explicit
  button and does not use a confirmation chain.

### Q1 — Question

- **Owner and purpose:** `QuestionComposer` owns the editable question and
  `StepHeader` communicates Question. Scope authority remains authoritative for
  whether it can proceed.
- **Decision/actions:** Default shows the question in place, a concise step
  header, Back, quiet Save draft, and Continue to Sources (or the adopted
  equivalent when source selection is combined). Do not repeat the question as
  a giant post-submit heading.
- **Placement:** Question field and next/back controls are **default**. Scope
  explanation and example editing are **secondary**. Raw classifier or adapter
  information is **advanced**.
- **Loading/error/blocked/recovery:** Validate required text inline. During
  scope evaluation preserve text and prevent duplicate action. Unsupported
  scope uses U1; server conflict uses L1. Back/save preserves the field and
  step, with no spend or run creation.
- **Responsive:** Use a single column no wider than a comfortable reading/setup
  width; wrap the step header and actions at 360/390px. Textarea remains fully
  reachable at 200% zoom and 320px reflow.
- **Keyboard/announcements:** Label the input programmatically; expose required
  and error text via `aria-describedby`. IME composition must not submit early.
  Announce “Question saved” or scope result, not each keystroke.

### S1 — Sources

- **Owner and purpose:** `SourceProfileList` presents explicitly selectable,
  named profiles grouped by evidence family. Source/scope authority determines
  which profiles are allowed to be read; the list does not imply accuracy.
- **Decision/actions:** Default shows selected-source count, named profiles,
  allowed-to-read helper, Back, Save draft, and Continue to budget. Selecting
  profiles updates the count and a compact summary. “Edit” returns to this
  decision rather than exposing arbitrary raw domains.
- **Placement:** Profile choices, count, helper, and next action are **default**.
  Fixture approval/future adapter validation is **secondary**. Raw source IDs
  and adapter metadata are **advanced**.
- **Loading/error/blocked/recovery:** Loading preserves the question and shows
  profile skeleton/status. If zero profiles are selected, keep Continue disabled
  with an inline, programmatically associated minimum-selection reason. If a
  profile becomes unavailable, mark it blocked with the authority's reason and
  offer a valid replacement; do not silently substitute another family. Save
  and Back recover without discarding choices.
- **Responsive:** Stack profile rows/cards at 360/390/520px and preserve the
  checkbox/radio, title, family, status, and selection action. At desktop use a
  focused setup card, not a source rail plus budget column.
- **Keyboard/announcements:** Use native labelled checkboxes/radios and visible
  focus. Selected count is a polite live status; errors identify the specific
  control. All profiles and Continue are reachable without pointer or drag.

### B1 — Budget

- **Owner and purpose:** `BudgetEditor` edits a draft mandate; the server budget
  route validates the authoritative cap, spent, remaining, integer precision,
  and per-source ceiling once a run exists.
- **Decision/actions:** Default label is **Maximum research spend** and shows
  “Maximum research spend: X XRP”, fixture conversion “1 XRP ≈ S$10.00”, and
  explicit copy that this is a demo approximation, not live FX, not a charge,
  and not exact purchase consent. Continue to Review, Back, and Save draft are
  visible. Wallet balance, if available, is separately labelled from cap and
  source price. Show configured per-source ceiling and plain-language meaning.
- **Placement:** Cap editor and distinction between cap/balance/price are
  **default**. Conversion/mode details and persistent budget summary are
  **secondary**. Rounding, network, and payer authority are **advanced** unless
  the validated runtime contract requires them for a decision.
- **Loading/error/blocked/recovery:** Validate number, range, precision, and
  server-owned ceiling inline. On conflict/stale mandate use L1; never locally
  override server values. A cap of zero or below the required minimum is a
  clear blocked state with exact reason and edit/retry path. Back/save preserve
  values; Continue never charges.
- **Responsive:** Stack fields and summary at narrow widths. The label, XRP
  amount, conversion, and cap-not-charge note remain visible at 200% zoom and
  320px reflow. Avoid a dashboard or chart that hides remaining authority.
- **Keyboard/announcements:** Number input has a visible label, unit, min/max,
  and error association; do not rely on colour or a slider alone. Announce a
  successful saved cap and server correction. Focus moves to Review heading only
  after valid continuation.

### V1 — Review

- **Owner and purpose:** `PlanSummary` renders the server-generated plan
  snapshot. Plan authority owns intended approach, selected families, cap,
  per-source ceiling, and permitted actions.
- **Decision/actions:** Default is a readable definition-list summary of
  question, source families, maximum spend, per-source ceiling, approach, and
  what the system may do. Primary action is “Approve plan & start research”.
  Back returns to Budget; Save draft and exit preserves the state. Do not claim
  an evidence gap before research has run.
- **Placement:** Summary and approval are **default**. Advanced settings
  (stop conditions, horizon, technical limits) are **advanced** behind “Edit
  advanced settings”. Technical plan IDs and raw step payloads are **secondary**
  or inspection-only. Do not expand eight raw plan-step editors by default.
- **Loading/error/blocked/recovery:** Show plan-generation progress without
  inventing plan content. If generation fails, preserve setup and offer Retry.
  If plan is stale or the server rejects a field, use L1 and show the
  authoritative correction. Missing required source/cap remains a clear block.
  No redundant confirmation dialog precedes plan approval.
- **Responsive:** Summary rows become stacked label/value pairs at narrow
  widths; advanced disclosure remains operable at 320px. Desktop has one
  readable setup column, not a multi-column plan editor.
- **Keyboard/announcements:** Use headings, `dl/dt/dd`, native disclosure, and
  a single focus path. Announce plan-ready, validation error, and approval
  result in a live region. Entering advanced settings does not steal focus or
  silently alter values.

### V2 — Plan approval

- **Owner and purpose:** The plan/run authority receives explicit approval of a
  specific plan version. This is a permission gate for retrieval, not purchase.
- **Decision/actions:** The primary control names both actions and boundary:
  “Approve plan & start research”. Back and Save draft remain available until
  the mutation starts. No modal is required; no purchase control appears here.
- **Placement:** Plan summary and approval status are **default**. Server plan
  version and request identifiers are **advanced** inspection.
- **Loading/error/blocked/recovery:** Disable duplicate approval while pending;
  show phase status. A rejected/stale plan returns to V1/L1 with authoritative
  differences. A successful approval enters R1 only after the server confirms
  the approved version. A network timeout requires refresh/reconciliation, not a
  blind second approval.
- **Responsive:** Keep approval fully visible and not clipped by a sticky footer
  at every required width. At 320px the action wraps or grows vertically.
- **Keyboard/announcements:** Native button with explicit accessible name;
  focus moves to the Research heading on success. Announce “Plan approved;
  research started” or the exact failure. Do not announce it as a purchase.

### R1 — Research workspace

- **Owner and purpose:** `ProgressPanel` and persisted run authority own phase,
  readiness, pause/resume, and stop. The workspace has one primary centered
  answer/progress region.
- **Decision/actions:** Header shows compact question, current phase,
  pause/resume, and compact brief/budget summary. Below it, Sources and Activity
  are secondary tabs. Source rows have stable order: title/access, relevance,
  evidence family, open/protected label, price, one action area. Persistent
  strip: **Cap X XRP · Spent Y XRP · Remaining Z XRP**, with labelled SGD
  approximation. Document owns vertical scroll; no default three-column layout.
- **Placement:** Phase/progress, next action, budget strip, and pause/resume are
  **default**. Sources/Activity are **secondary** tabs; EvidenceDrawer,
  activity details, quote details, and receipts are **secondary** inspection.
  Raw identifiers and diagnostics are **advanced**.
- **Loading/error/blocked/recovery:** Name the current phase without invented
  percentages. Source loading is a status, not fake evidence. Blocked sources
  show exact server reason and “Continue without it”. Skipped, blocked, open,
  premium preview, and unlocked are distinct. Run errors preserve last safe
  state and provide retry/reconcile/stop where safe. History/Library are absent
  or clearly unavailable until their contracts exist.
- **Responsive:** At 360/390/520px stack header, progress, tabs, budget strip,
  and source rows; preserve every action and status. At 768/1024/1440px widen
  the centered workspace without adding a third simultaneous column. Avoid
  nested full-height scrolling; only an evidence drawer may own its own overflow.
- **Keyboard/announcements:** Tabs use native tab semantics or equivalent
  buttons with selected state. Pause/resume and source actions are in a stable
  tab order. Announce material phase, budget, blocked, skip, and access changes;
  do not read every activity event. Focus remains on the source action after a
  mutation.

### A1 — Open-only answer

- **Owner and purpose:** `AnswerPanel` asks synthesis authority for a grounded
  answer when approved run readiness and usable accessible evidence permit it.
  A BUY is not a prerequisite.
- **Decision/actions:** Default shows “Answer from available evidence”, concise
  answer/progress, uncertainty/limitations, and evidence-access labels. Open
  evidence can produce a cited answer without a purchase. A premium candidate
  may remain an optional P1 action. Empty or unsupported evidence is a truthful
  limitation, not a disabled generic Answer control beside a premium candidate.
- **Placement:** Answer/progress and next answer action are **default**.
  Sources, Activity, and citation inspection are **secondary**. Prompt/provider
  details and raw evidence identifiers are **advanced**.
- **Loading/error/blocked/recovery:** Show synthesis draft while streaming;
  timeout, invalid JSON, inaccessible citation, or empty evidence moves to E1,
  U1, or a limitation state as appropriate. Do not publish an invalid or
  fabricated answer. Retry preserves usable evidence and any prior validated
  result.
- **Responsive:** Answer remains the primary vertical region; citations and
  limitations wrap at narrow widths, with no horizontal citation strip. Print
  preserves answer, citations, and limitations without app chrome.
- **Keyboard/announcements:** Focus the answer heading or status after validated
  completion. Citation controls open accessible spans using EvidenceDrawer
  semantics; Escape restores focus. Announce synthesis start/validated/fallback
  once, not every streamed token.

### P1 — Premium proposal

- **Owner and purpose:** `SourceRow` presents a server-recommended candidate;
  purchase-plan authority explains why it may change the answer. It is a
  recommendation, not consent or an unlocked state.
- **Decision/actions:** Show candidate source, relevance, open/protected status,
  exact current price/quote summary, remaining authority, and two distinct
  actions: “Review purchase” and “Continue without it”/“Answer from available
  evidence”. Never place a generic disabled Answer button beside this state.
- **Placement:** Candidate reason, price, and actions are **default**. Full
  quote details, terms, and receipt history are **secondary**. Adapter/quote
  hashes are **advanced**.
- **Loading/error/blocked/recovery:** While recommendation loads, keep open
  evidence available. If quote is missing/expired, show Re-quote; if cap or
  ceiling blocks it, show system-owned Blocked and Continue without it. A
  skipped proposal remains visibly skipped; it does not become purchased.
- **Responsive:** Source row changes to a stacked record under 520px; action
  buttons remain individually labelled and full-width as needed. Long source
  titles/prices wrap without overlap at every width.
- **Keyboard/announcements:** Source action names include source identity where
  needed. Focus remains on the row after skip/block/requote. Announce
  recommendation and block status once; do not imply purchase.

### P2 — Exact purchase review

- **Owner and purpose:** `ApprovalModal` displays one explicit confirmation
  modal bound to one server quote. Purchase authority rechecks all guards.
- **Decision/actions:** Show exact source, why it may change the answer, exact
  XRP amount, labelled SGD approximation, cap/spent/remaining after purchase,
  quote expiry, network/mode, protected-content terms, and fixture settlement
  note. Final action is **“Approve purchase of X XRP”**. Cancel is side-effect
  free. Opening the modal does not charge.
- **Placement:** Decision-critical quote/authority and final approval are
  **default**. Technical quote details and raw IDs are **secondary/advanced**.
  There is exactly one purchase modal; no nested/chained confirmation.
- **Loading/error/blocked/recovery:** Quote fetch/bind has a pending state that
  disables duplicate submission. Expired quote returns to P1 with Re-quote and
  no charge. Over-cap/over-ceiling is blocked with exact reason and no bypass.
  Cancel restores the invoking source action. Unknown result moves to P3/L1;
  never show success while reconciliation is pending.
- **Responsive:** Modal fits 320px reflow with vertical sections and a visible
  final action; no critical terms or consent control is hidden behind horizontal
  scrolling. At 200% zoom, focusable controls remain reachable.
- **Keyboard/announcements:** Descriptive dialog title and initial context;
  focus trap; Escape closes only when safe; focus returns to invoking control.
  Final button has exact amount in its accessible name. Announce quote expiry,
  block, pending, and approved/unknown outcome without exposing protected text.

### P3 — Blocked, expired, pending, or unknown payment

- **Owner and purpose:** Purchase/settlement authority owns outcome; Activity
  renders a human-readable status and receipt/diagnostic details.
- **Decision/actions:** **Blocked** names the exact policy (remaining cap,
  per-source ceiling, unavailable mode) and offers Continue without it. **Expired**
  offers Re-quote. **Pending** says processing and disables duplicate submit.
  **Unknown** says outcome is not yet known and offers Reconcile/Refresh, never
  blind Retry. If settled, show settlement status separately from access status.
- **Placement:** Status and safe next action are **default**. Receipt/quote
  details are **secondary**. Idempotency keys, provider response, and raw
  diagnostics are **advanced** and never needed to decide whether to retry.
- **Loading/error/blocked/recovery:** Reconcile server status before any retry.
  Preserve cap/spent/remaining as server reports them. Unknown is not unpaid,
  paid, unlocked, or failed until resolved. Keep a receipt if settled and do not
  issue a duplicate payment.
- **Responsive:** Status text and action stack in the source row/activity item;
  no badge-only message. Long amounts and mode labels wrap safely.
- **Keyboard/announcements:** Status is a polite live region; focus moves to
  the safe recovery action only when it is newly actionable. Buttons say
  Reconcile, Re-quote, or Continue without it, not ambiguous Retry.

### F1 — Fulfilment failure / access mismatch

- **Owner and purpose:** Settlement and protected-content access are separate
  authorities. `SourceRow`/`ActivityFeed` must not infer unlock from payment.
- **Decision/actions:** Show “Payment/settlement status” and “Content access
  status” separately. If settled but protected access is pending/failed, offer
  receipt/recover access/contact or safe retry prescribed by the server; offer
  Continue without it and open-evidence answer where available. Never charge
  again merely to recover fulfilment.
- **Placement:** Failure explanation and safe recovery are **default**. Receipt,
  access diagnostics, and support details are **secondary**. Provider payload is
  **advanced**.
- **Loading/error/blocked/recovery:** Pending access remains locked. Failed
  access is labelled unavailable; no protected body appears and no claim says
  the source was unlocked. Recovery reconciles server access state and retains
  the purchase record. If no safe recovery exists, preserve limitation and
  proceed without the source.
- **Responsive:** Separate status rows stack at narrow widths; the answer path
  and Continue without it action stay visible. Do not bury a failed access state
  in a collapsed side rail.
- **Keyboard/announcements:** Announce settlement and access transitions as
  separate events. Focus the recovery action only after it becomes available.
  Evidence inspection remains disabled until access is verified.

### T1 — Pause/resume

- **Owner and purpose:** Run authority owns pause/resume/stop. `ProgressPanel`
  reflects a server-confirmed phase; client animation is not progress evidence.
- **Decision/actions:** Header action is Pause while active and Resume while
  paused; Stop is separate and clearly non-destructive. Preserve question,
  selected sources, cap/spent/remaining, decisions, receipts, and last safe
  evidence.
- **Placement:** Current phase and pause/resume are **default**. Stop semantics,
  recent activity, and server revision are **secondary/advanced**.
- **Loading/error/blocked/recovery:** Disable duplicate pause/resume while the
  mutation is pending. If pause is rejected because the phase changed,
  reconcile and show the current state. Resume only after server confirmation.
  Network interruption enters L1; do not claim paused or resumed based on a
  timeout.
- **Responsive:** Keep pause/resume in the compact header and visible after
  stacking. Use text plus state, not icon-only controls.
- **Keyboard/announcements:** Button name changes to Pause/Resume with current
  phase context. Announce paused/resumed/stopped and focus the control after
  completion unless a recovery banner requires attention.

### L1 — Reload/stale run

- **Owner and purpose:** Hydration/reconciliation combines the persisted server
  draft/run revision with local unsent fields. Server state wins for any
  mutation or payment/access state.
- **Decision/actions:** Default shows Restore/reconcile progress, current
  question/phase, and a safe action (Resume, Review changes, or New research).
  If a local draft differs from server state, expose the difference before any
  overwrite; do not silently widen scope or cap.
- **Placement:** Current authoritative state and safe next action are **default**.
  Revision diff, receipt, and diagnostics are **secondary**. Raw payloads are
  **advanced**.
- **Loading/error/blocked/recovery:** Re-fetch after reload or stale mutation.
  Keep local text until the user resolves a conflict. Unknown payment uses P3
  reconciliation. Missing draft/run moves to H1/H0 with an honest limitation;
  never fabricate completion or delete the prior record.
- **Responsive:** Recovery banner wraps and stays adjacent to affected state;
  action controls remain visible at 320px and 200% zoom.
- **Keyboard/announcements:** Announce restoring, conflict, reconciled, or
  unavailable states. Focus the first actionable recovery control, then restore
  focus to the original source/step action after resolution.

### U1 — Unsupported scope

- **Owner and purpose:** Scope authority decides support; `ScopeNotice` explains
  the result. The client must not map arbitrary prompts to the data-centre
  fixture.
- **Decision/actions:** Default says the question is outside the current demo
  coverage, names the supported fixture scope, and offers Edit question / Back
  to the composer. It may explain that real-domain adapters are future scope;
  do not promise them or show unrelated evidence.
- **Placement:** Unsupported explanation and Edit/Back are **default**. Adapter
  roadmap or fixture corpus detail is **secondary/advanced**.
- **Loading/error/blocked/recovery:** Scope evaluation is pending until the
  authority responds. A server error preserves text and offers Retry. An
  unsupported result creates no research run, purchase, or answer. Editing
  returns to Q1/H0 with text intact.
- **Responsive:** Keep the explanation and editing action in one readable card;
  no wide comparison table or evidence panel. All text wraps at 320px.
- **Keyboard/announcements:** Give the notice a heading and associate it with
  the composer error/status. Move focus to the notice or Edit action on entry;
  announce unsupported scope once. Do not announce it as a generic network
  failure.

### E1 — Synthesis fallback

- **Owner and purpose:** Synthesis authority may provide a deterministic fixture
  fallback only when the fallback itself validates against accessible evidence.
  `AnswerPanel` labels it; the client never invents fallback content.
- **Decision/actions:** Default shows the fallback answer/limitation, explicit
  “Fallback synthesis” label, uncertainty, evidence mode, and Retry synthesis
  when safe. Preserve a previously validated answer while a replacement draft
  is pending.
- **Placement:** Fallback label, limitations, and safe retry are **default**.
  Provider error detail and raw draft are **secondary/advanced**.
- **Loading/error/blocked/recovery:** Groq timeout, invalid JSON, unavailable
  source/span, or validation failure becomes fallback only through the server's
  deterministic validated path. If no valid fallback exists, show limitation;
  never render an invalid citation as final. Retry does not discard usable open
  evidence.
- **Responsive:** Label and limitations stay adjacent to answer; citation list
  wraps and remains inspectable on mobile/print.
- **Keyboard/announcements:** Announce fallback once with its cause at a useful
  level; do not stream raw invalid output. Citation inspection follows A1/A2
  drawer focus rules.

### A2 — Final cited answer

- **Owner and purpose:** Citation/synthesis authority validates the result;
  `AnswerPanel` renders only accessible, bound evidence spans.
- **Decision/actions:** Default order is concise answer, uncertainty and
  limitations, then claim-level citations. Labels distinguish open,
  premium/unlocked, fixture, fallback, and unavailable evidence. “View
  citation” opens the exact accessible span; raw hashes/IDs remain behind
  inspection.
- **Placement:** Answer, uncertainty, labels, and next safe action are
  **default**. Citation spans, receipts, and source metadata are **secondary**.
  Raw identifiers/export diagnostics are **advanced**.
- **Loading/error/blocked/recovery:** A final result requires server validation;
  inaccessible span or invalid citation returns to A1/E1. Protected content
  remains absent before verified access. Print/export preserves answer,
  citations, and limitations without application chrome.
- **Responsive:** Long citations and source titles wrap; no horizontal overflow.
  The centered answer remains primary at all required widths and 200% zoom.
- **Keyboard/announcements:** Heading landmarks and semantic citation buttons
  support keyboard inspection. Drawer focus traps safely, Escape restores the
  citation trigger, and live region announces “Answer ready” once. Do not use
  colour alone for evidence mode.

## Acceptance-criteria traceability

The rows below map every design-brief criterion to the states and transitions
that must be demonstrated by implementation and review. A mapping is not a
claim that the criterion has passed.

| AC | States/transitions to exercise | Required observable contract |
| --- | --- | --- |
| 1 | H0/H1 -> Q1 -> S1 -> B1 -> V1/V2 -> R1 -> A1/A2; Back/Save/Skip | Guided resumable sequence; Back and Save preserve state; Skip appears only for optional decisions. |
| 2 | H0 vs H1; H1 -> resume | First-run explainer is distinct; saved draft/recent run resumes at its safe step without repeating landing copy. |
| 3 | B1/V1 focused panel; P2 modal; P2 cancel | No chained mandatory dialogs; setup editing is focused; exact purchase is one explicit modal with safe cancel. |
| 4 | V1 -> advanced disclosure | Human-readable plan is default; raw stop conditions/horizon/technical fields are progressive. |
| 5 | R1 with Sources/Activity tabs; R1 -> A1 | One centered answer/progress region; secondary inspection tabs; no three-column default. |
| 6 | R1/P1 at 360/390/768/1024/1440 and 320 reflow | Stable source-row order and non-overlapping action region; statuses and long text remain visible. |
| 7 | B1 -> R1 -> P1/P3 | Cap/spent/remaining persist; XRP authority, labelled fixture SGD approximation, wallet balance, and source price are distinct. |
| 8 | P1 -> P2 -> P3 | Exact source/quote/amount/expiry/mode shown; server quote/authorization guards and manual approval remain; proposal is not approval. |
| 9 | P1/P2/P3/F1 -> A2 | Protected body absent pre-access; citations bind accessible spans; fixture settlement is not described as real publisher payment. |
| 10 | H0/Q1 -> U1 | Unsupported arbitrary prompt receives truthful scope state and edit path; no unrelated fixture evidence. |
| 11 | H1/R1/A2 shell | History/Library are usable only if contracts exist; otherwise absent or explicitly unavailable, with no dead navigation. |
| 12 | All setup/workspace/modal states at required widths/zoom/reflow | No body overflow, clipped critical action, or hidden purchase consent; responsive stacking preserves actions. |
| 13 | Q1/S1/B1/V1/V2/R1/P2/A1/A2/T1 | Keyboard path, focus trap/restore, labels, error association, target size, contrast, and meaningful live-region announcements meet WCAG expectations. |
| 14 | R1 -> A1 -> A2 with open evidence; empty/unsupported -> U1/E1 | Usable open evidence yields cited answer without BUY; empty/unsupported evidence remains limitation. |
| 15 | H0/H1/Q1/B1/P2/T1/L1/U1 | Pilot protocol measures targets only; no participant evidence is claimed. Test cap/spent/remaining, exact amount, backing out, resuming, and evidence labels. |

## Invariant checklist

Use this as the review gate for every implementation slice:

- [ ] State labels are human-readable before technical IDs; each state names a
  next safe action, preserved data, and recovery path.
- [ ] Home/demo and returning draft/run are distinct; unsupported prompts never
  receive data-centre evidence as an answer.
- [ ] Question, selected source profiles, cap, decisions, and last safe state
  survive Back, Save draft, pause/resume, reload, and recoverable errors.
- [ ] Sources are named allowed-to-read profiles/families, not arbitrary domain
  browsing or guarantees of truth; no silent source substitution occurs.
- [ ] “Maximum research spend” is visibly a cap, never wallet balance, actual
  source price, charge, or purchase consent.
- [ ] Cap, spent, remaining, per-source ceiling, XRP authority, fixture rate,
  SGD approximation, wallet balance, and payment mode stay distinct.
- [ ] Plan approval is explicit and separate from exact purchase approval;
  entering Review or opening a recommendation cannot spend.
- [ ] Advanced plan fields are behind disclosure; no arbitrary horizon is silently
  added to a non-demo question.
- [ ] Workspace has one centered answer/progress region, Sources and Activity
  secondary inspection, document-owned scroll, and no three-column default.
- [ ] Source rows retain title, access, relevance, family, price, and one action
  area at all required widths; open, preview, unlocked, skipped, and blocked
  states are distinct.
- [ ] A premium proposal is optional; usable open evidence can answer without a
  BUY and never sits beside a misleading generic disabled Answer control.
- [ ] P2 names exact source and quote, amount, expiry, mode, terms, and after-
  purchase authority; final button is explicit and manually approved.
- [ ] Expired, blocked, pending, and unknown payment states never blind-retry or
  claim payment/access; idempotency and server reconciliation are preserved.
- [ ] Settlement and protected-content fulfilment are separate. Protected text
  is absent until verified access, and fulfilment failure does not auto-charge.
- [ ] Synthesis drafts are intermediate; only validated citations become final.
  Fallback is labelled, and empty/unsupported evidence cannot masquerade as an
  answer.
- [ ] Evidence labels distinguish open, premium/unlocked, fixture, fallback,
  and unavailable; fixture settlement is never real-publisher payment copy.
- [ ] History/Library are absent or clearly unavailable until their contracts
  exist; no dead navigation is introduced.
- [ ] At 360/390/768/1024/1440px, 200% zoom, and 320px reflow there is no body
  overflow, clipped critical action, or hidden consent.
- [ ] Keyboard and assistive technology can complete the path; dialogs trap
  focus, close safely on Escape, restore focus, and announce only material
  changes.
- [ ] No manual pilot, live wallet, live provider, real publisher payment, or
  deployment rehearsal is represented as completed evidence.

## Documented design choices

1. **Guidance versus backend stages.** The UI names Question, Sources, Budget,
   Review, Research, and Answer because those are the user's decisions. The
   backend may still perform deterministic retrieval and purchase planning in
   different internal stages; the map never treats labels as permission gates.
2. **Open evidence is a first-class answer path.** The old “synthesize only
   after purchase” wording is superseded. Purchase remains useful and explicit,
   but optional when accessible open evidence is sufficient. Empty evidence still
   blocks a truthful answer.
3. **One workspace center.** Source and Activity inspection are tabs/drawers,
   not simultaneous desktop columns. This preserves comparison and auditability
   without turning the answer into a side rail.
4. **State-specific controls.** Blocked means a policy decision, expired means
   a quote is no longer approvable, pending/unknown means outcome is unresolved,
   and fulfilment failure means settlement/access diverged. These are not one
   generic error state.
5. **Fixture honesty.** Synthetic corpus, fixture settlement, and XRPL Testnet
   mode (if configured) are labels about the runtime mode. They do not claim a
   real publisher was paid or that a source claim is true.
6. **No hidden history/library promise.** Navigation is omitted or labelled
   unavailable until intended contracts exist; this state map does not create
   those capabilities.
7. **Recovery over destructive reset.** Reload, New research, Stop, and failed
   access preserve safe persisted records. A user may begin a new thread without
   erasing prior evidence or receipts.

## Review checklist for UO-03 acceptance

- [ ] Read this map against all S01–S09 current-product defects; S10–S11 are
  treated as inspiration only.
- [ ] Confirm UO-01 unsupported-scope behavior and UO-02 open-evidence gate are
  prerequisites, not reimplemented by a visual worker.
- [ ] Verify each state has one authoritative owner and no client-only bypass of
  server scope, plan, purchase, access, budget, or citation guards.
- [ ] Walk every transition in the table, including Back/Save, unsupported,
  blocked/expired, unknown payment, access failure, pause/resume, reload/stale,
  and synthesis fallback.
- [ ] Confirm implementation can derive the 15-criterion table without adding
  dead navigation, real adapters, wallet funding, or protected-body shortcuts.
- [ ] Review responsive and keyboard requirements before UI extraction; ensure
  exact purchase consent remains visible and focusable at 320px/200% zoom.
- [ ] Check contract notes below against `docs/contracts/DESIGN.md` and
  `docs/contracts/UX-CONTRACT.md`; server/security/payment/citation contracts
  remain stronger than any visual shortcut.
- [ ] Run the exact package verification assigned by the orchestrator after
  implementation; this document itself has no production behavior test.

## Contract reconciliation notes

The following source contracts were stale relative to the accepted brief and
were updated narrowly alongside this map:

- `docs/contracts/UX-CONTRACT.md` now describes the guided Question → Sources →
  Budget → Review → Research → Answer path, retains the server's Search /
  Purchase / Answer internals, and permits synthesis from usable open evidence.
  It still requires plan approval, citation validation, protected access, and
  exact purchase approval for premium evidence.
- `docs/contracts/DESIGN.md` now describes the broad deep-research audience,
  neutral-sans workspace, expressive treatment only for home/demo, and one
  centered workspace with Sources/Activity inspection instead of a default
  three-region desktop layout.

These are presentation/interaction corrections only. They do not authorize a
new provider, source adapter, wallet, real settlement, history/library feature,
or any weakening of server authority.
