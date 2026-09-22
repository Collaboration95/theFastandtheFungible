# ResearchAgent next-stage UX brief

This is the durable UX brief after the September overhaul. It replaces the
portable overhaul package, state-map ledger, prototype notes, and worker
prompts. It records the interaction contract and remaining product questions;
it is not a claim that future work is complete.

## Product direction

ResearchAgent is a calm deep-research workspace, not a chat transcript or a
payment dashboard. The user should be able to:

1. frame a question;
2. choose the evidence universe the system is allowed to read;
3. set a maximum spend;
4. approve a readable research plan;
5. inspect evidence and receive an open-only answer when possible;
6. optionally approve an exact premium-source purchase; and
7. verify the answer against accessible evidence spans.

The working surface stays neutral, focused, and sans-serif. Expressive or
editorial treatment belongs only on the first-run home/demo surface. The
workspace has one centered answer/progress region; Sources and Activity are
secondary tabs or disclosures, not simultaneous desktop columns.

## Current accepted baseline

The September implementation established:

- Guided Question → Sources → Budget → Review setup.
- A truthful unsupported-scope state for the fixture scenario.
- A first-class open-evidence answer path with no required purchase.
- Human-readable plan approval separate from purchase consent.
- Optional premium proposals and an exact-quote approval modal.
- Mutually exclusive Overview, Sources, and Activity tabs.
- Citation inspection bound to exact accessible spans.
- Pause/resume/stop/reload behavior and reset-safe receipts.
- Explicit fixture labels and protected-preview states.
- Responsive checks at 360, 390, 768, 1024, and 1440 CSS px, plus
  reduced-motion, 200% zoom, and keyboard checks.

The UO-10 owner run passed its focused automated checks. A qualitative user
pilot and full presentation rehearsal were not run and must not be represented
as completed research.

## State model

These are durable semantic states, not required routes. The server remains
authoritative for supported scope, plan approval, budget, quotes, settlement,
access, and citation validity.

| State | User decision | Required safe outcome |
| --- | --- | --- |
| Home | Start or resume | First-run explanation differs from returning state |
| Question | What am I investigating? | Unsupported scope preserves text and offers a supported path |
| Sources | What may the system read? | Named profiles; zero selection cannot proceed |
| Budget | What is the maximum spend? | Cap, wallet balance, price, and consent remain distinct |
| Review | Is this the right plan? | Readable summary; advanced fields disclosed progressively |
| Research | What evidence is available? | One centered progress/answer area with secondary inspection |
| Open answer | Is accessible evidence sufficient? | Cited answer can complete without buying anything |
| Premium proposal | Could a source materially help? | Recommendation remains optional |
| Purchase review | Do I approve this exact quote? | Exact source, amount, expiry, mode, terms, and remaining authority |
| Purchase outcome | What happened to settlement? | Settled, blocked, expired, pending, and unknown are distinct |
| Fulfilment | Is the resource accessible? | Settlement never implies access automatically |
| Final answer | What changed and why? | Only validated accessible spans become final citations |
| Recovery | What state can safely resume? | Reload and retry reconcile server state without destructive reset |

## Transition invariants

- Opening Review or a premium proposal never spends money.
- Plan approval and exact purchase approval are separate mutations.
- Usable open evidence may be synthesized without a purchase.
- Premium previews expose metadata, preview, price, and terms only.
- Expired quotes cannot be approved; unknown outcomes cannot be blindly retried.
- Settlement and fulfilment are separate; a fulfilment failure cannot trigger a
  second charge.
- Synthesis drafts are intermediate. Only server-validated citations become a
  final answer.
- Unsupported scope, empty evidence, invalid citations, unknown payment, and
  unavailable access are recovery or limitation states—not successful answers.
- New research resets the current client thread, not persisted receipts or
  completed evidence records.

## Workspace hierarchy

### Default surface

- Current question and compact mandate summary.
- Current stage and one primary action.
- Answer/progress region.
- Persistent cap, spent, and remaining amounts when a run exists.
- Clear open, premium preview, unlocked, blocked, and fallback labels.

### Secondary inspection

- Sources and evidence-family comparison.
- Activity, purchase, and receipt events.
- Citation drawer with source, exact span, access mode, and binding reason.
- Recovery details for stale, pending, or failed operations.

### Advanced disclosure

- Stop conditions, horizon, technical IDs, provider/model detail, quote hashes,
  network fields, and low-level receipt data.
- Advanced detail must never be required to understand the decision or consent.

History and Library navigation should remain absent until their storage,
retention, access, and empty/error contracts are implemented. Do not add dead
navigation as a visual promise.

## Language rules

Use specific decision language:

- “Maximum research spend,” not “wallet” when referring to the cap.
- “Review purchase,” not “Buy now” before an exact quote is loaded.
- “Fixture payment · simulation only,” not “paid” without context.
- “Premium preview” and “Premium · unlocked,” not ambiguous “available.”
- “Skipped · duplicate family” and a plain policy reason for blocked sources.
- “Fixture fallback · validated locally” when provider synthesis was not used.

Never expose chain-of-thought, a truth score, or language implying that a
fixture source is real, that a publisher was paid, or that Testnet assets have
S$ value.

## Accessibility and responsive contract

- Native controls and headings are preferred.
- Enter behavior is IME-safe; Shift+Enter creates a line break where relevant.
- Errors are programmatically associated with their controls.
- Dialogs and drawers trap focus only while open, close safely on Escape, and
  restore focus to their trigger.
- Tabs support keyboard focus and selection semantics.
- Live regions announce material changes, not token-by-token noise.
- Status is never communicated by color alone.
- At 320px reflow and 200% zoom, source title, state, price, consent, and safe
  recovery remain visible without body-level horizontal overflow.
- Reduced motion removes non-essential transitions and smooth scrolling.

## Next-stage discovery questions

Validate these before expanding the UI:

1. Do researchers understand the difference between allowed sources and trusted
   evidence?
2. Can they distinguish maximum spend, remaining authority, source price, and
   exact consent without explanation?
3. Is an open-only answer the expected default, or do users want the system to
   propose premium evidence earlier?
4. What evidence is sufficient to judge whether an article is worth buying?
5. Does a before/after claim view explain purchase impact better than a general
   activity log?
6. Do users need saved history and a purchased-source library, and what
   retention/licensing expectations follow?

## Proposed next slices

### UX-1 — qualitative comprehension pilot

Run five to eight sessions using fixture mode. Measure task completion and
whether participants can explain source authorization, cap versus price,
proposal versus approval, open versus protected evidence, and citation meaning.

### UX-2 — evidence-impact view

If the pilot confirms the need, add a compact before/after claim comparison
showing the exact paid span that changed or strengthened each claim. Preserve
uncertainty and unchanged claims; do not imply causality where none exists.

### UX-3 — receipt and revisit contract

Specify receipt export, local history, purchased-source access, expiry,
retention, and report linkage before adding navigation. Empty, unavailable,
revoked, and version-mismatch states are required.

### UX-4 — broader scenario shell

Only after server scenario support exists, replace fixture-specific setup copy
with a scenario-aware scope contract. The UI must never accept arbitrary input
and silently map it to unrelated evidence.

## Acceptance for a UX change

A slice is acceptable when:

- one user decision is clearer without hiding authority or limitations;
- all loading, empty, blocked, error, and recovery states are specified;
- server ownership is unchanged or deliberately updated with tests;
- open-only and protected-content paths both remain truthful;
- keyboard, focus, responsive, zoom, and reduced-motion checks pass;
- fixture/live labels remain explicit; and
- any user-research claim links to actual evidence rather than a plan.
