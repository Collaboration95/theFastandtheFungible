# Execution status and resume ledger

## Current state

**Package ready; application overhaul NOT STARTED.**

- Baseline app commit: `fc177016430811158d913be12f130f68a49bcc10`.
- Package date: 20 September 2026.
- Confirmed product direction: general deep research + optional paid sources +
  precise spending control; quiet neutral sans-serif; guided setup.
- All eleven original screenshots are bundled and separated into current and
  reference images. Original PNGs are immutable evidence.
- Application source, tests, and runtime configuration were not changed in the
  package task. Historical Excalidraw scene changes/exports are preserved.
- This handoff records local work packages; it creates no new GitHub backlog.

## Baseline observations (rerun; not implementation acceptance)

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Typecheck | PASS reported by testing worker | 20 September 2026; `npm run typecheck` |
| Unit/persistence | PASS reported by testing worker | 19 tests across 3 files; `npm test` |
| Browser a11y invocation | FAIL at harness startup | Polls 5173 while Vite uses 5100; no test body executed |
| Full E2E | NOT RUN / blocked | Fix harness before claiming coverage |
| New design visual review | NOT RUN | No new UI implemented |
| Target-user pilot | NOT RUN | No participant results claimed |
| Fixture demo rehearsal after redesign | NOT RUN | Requires implementation |
| Package integrity | See `evidence/package-verification.md` | Links, image hashes, portability, Git publication checks |

Known first blockers: Playwright 5173/5100 mismatch; cleanup script omits 5100;
client BUY gate on final answer; unsupported prompts receive data-centre
fixture output. The plan defines repairs and required regressions.

## Work ledger (maintain during implementation)

Copy work IDs from IMPLEMENTATION-PLAN.md. Keep WAITING, IN PROGRESS, REVIEW,
PASS, FAIL, and BLOCKED distinct; never mark a slice PASS without evidence.

| Work ID | Status | Owner / write scope | Commit | Evidence | Next action / blocker |
| --- | --- | --- | --- | --- | --- |
| UO-00 | WAITING | Assign preflight owner | — | — | Start implementation here |
| Remaining plan | WAITING | Assign only when dependencies pass | — | — | Follow dependency order |

## Design decisions

Record each departure from the brief with user consequence and rationale. Do
not silently replace guided setup with a chat-only interface or restore the old
busy dashboard. Routine token choices can be decided by the orchestrator.

| Date | Decision | Why | Impact / evidence |
| --- | --- | --- | --- |
| 2026-09-20 | Neutral sans-serif + one accent; short guided setup | Explicit user preference | DESIGN-BRIEF.md |
| 2026-09-20 | General research user, not finance-only | Explicit audience clarification | DESIGN-BRIEF.md |

## Resume note

At the end of each session write: current commit, last accepted work package,
active file owners, actual failing command or behavior, available evidence, and
the exact next task. Preserve incomplete work rather than rerunning audits.
