# Execution status and resume ledger

## Current state

**Implementation in progress; UO-00 through UO-10 and the citation/runtime
hardening pass are implemented in this working tree.**

- Baseline app commit: `fc177016430811158d913be12f130f68a49bcc10`.
- Package date: 20 September 2026.
- Confirmed product direction: general deep research + optional paid sources +
  precise spending control; quiet neutral sans-serif; guided setup.
- All eleven original screenshots are bundled and separated into current and
  reference images. Original PNGs are immutable evidence.
- Application source, tests, and runtime configuration now include the accepted
  implementation slices described below. Historical Excalidraw scene
  changes/exports are preserved.
- This handoff records local work packages; it creates no new GitHub backlog.

## Current verification observations (rerun on this checkout)

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Typecheck | PASS | Current checkout; `npm run typecheck` |
| Unit/persistence | PASS | 21 tests across 4 files; `npm test` |
| Browser a11y invocation | PASS | `npm run test:a11y`; 1 test passed with no serious or critical axe violations |
| Full E2E | PASS | `npm run test:e2e`; 17 tests passed in the isolated one-worker fixture lane |
| New design visual review | PASS (focused automated captures) | UO-10 responsive/reduced-motion/200% captures; broader human review remains separate |
| Target-user pilot | NOT RUN | No participant results claimed |
| Fixture demo rehearsal after redesign | NOT RUN | Requires implementation |
| Package integrity | PASS | `node ui-overhaul/verify-package.mjs`; 11 PNGs, 17 Markdown files, 58 relative links |

The browser harness now uses an isolated `.playwright/runs.json` store and one
worker, so repeated runs do not mutate `data/runs.json` or race whole-store
persistence. The current browser lane also covers open-only answers, exact
purchase review, citation/span inspection, responsive tabs, and pause/resume/
stop/reload behavior. The qualitative pilot and demo rehearsal remain not run.

## Work ledger (maintain during implementation)

Copy work IDs from IMPLEMENTATION-PLAN.md. Keep WAITING, IN PROGRESS, REVIEW,
PASS, FAIL, and BLOCKED distinct; never mark a slice PASS without evidence.

| Work ID | Status | Owner / write scope | Commit | Evidence | Next action / blocker |
| --- | --- | --- | --- | --- | --- |
| UO-00 | PASS | Preflight: `playwright.config.ts`, `scripts/stop-dev.mjs`, isolated Playwright store | working tree | `TESTING.md` UO-00 results | Harness reaches 5100; browser runs are serialized and do not touch `data/runs.json` |
| UO-01 | PASS | Scope truthfulness: `src/App.tsx`, `server/index.ts`, `tests/e2e.spec.ts` | 8da071d (uncommitted) | Current aggregate: 21 unit, 17 E2E, 1 axe, typecheck | Unsupported scope server guard and recovery accepted |
| UO-02 | PASS | Open-evidence answer: `src/App.tsx`, `tests/e2e.spec.ts` | 8da071d (uncommitted) | Current aggregate: 21 unit, 17 E2E, 1 axe, typecheck | Unpaid cited-answer path and premium-only limit accepted |
| UO-03 | PASS | `ui-overhaul/STATE-MAP.md`, `docs/contracts/DESIGN.md`, `docs/contracts/UX-CONTRACT.md` | 8da071d (uncommitted) | Package verification and diff review | State/recovery map and contract reconciliation accepted |
| UO-04 | PASS | `ui-overhaul/prototype/` | 8da071d (uncommitted) | Local browser visual/interaction review, syntax and package checks | Prototype and dialog accessibility correction accepted |
| UO-05 | PASS | `src/App.tsx`, `src/styles.css`, `src/ui/index.tsx` | 8da071d (uncommitted) | Verify, 9 serial E2E, 1 axe, 320px check | Token/seam extraction and source-action race fix accepted |
| UO-06 | PASS | Serialized guided setup/draft/review in `src/App.tsx`, `src/styles.css`, `src/ui/`, focused tests | working tree | `tests/guided-setup.spec.ts`, focused captures | Question → Sources → Budget → Review and draft safety verified |
| UO-07–UO-10 | PASS | Workspace, evidence, purchase, tab, responsive, and accessibility hardening | working tree | `tests/uo-07-10.spec.ts`, `ui-overhaul/evidence/UO-10/` | Exact span inspection and mutually exclusive tabs included |
| Runtime/citation repair | PASS | `server/index.ts`, `server/dossier-validation.ts`, `src/App.tsx`, Playwright isolation | working tree | 21 unit, 17 E2E, 1 axe, typecheck, build | Restricted fallback citations, resumable plan drafts, and keyboard tab focus verified |
| Remaining plan | WAITING | Human pilot and demo rehearsal | — | NOT RUN | Run only when participants/demo machine are available |

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
active file owners, actual failing command or behavior, and available evidence.
The current changes are uncommitted in the working tree. Automated gates are
recorded above; the target-user pilot and fixture demo rehearsal remain NOT RUN.
