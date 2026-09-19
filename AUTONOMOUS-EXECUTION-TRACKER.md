# ResearchAgent autonomous execution tracker

## Purpose and current checkpoint

This is the durable progress ledger for the autonomous October 1 local-critique
run. The source of truth for public workflow state is the
[Paywalled Research Roadmap project](https://github.com/users/Collaboration95/projects/9);
this document provides the dependency-aware handoff an orchestrator needs to
keep executing without rediscovering the plan.

**Baseline:** `main` at `b948970` (`docs(roadmap): align plan with GitHub execution backlog`)

**Target integration branch:** `codex/oct1-autonomous-critique`

**Run goal:** Deliver the complete local paywalled-finance-research critique
product. The user should be able to configure a research mandate, inspect and
edit a plan, compare open and premium evidence, manually approve one article
purchase, observe only correctly unlocked evidence affect a cited dossier, and
inspect/export a truthful Evidence Receipt.

**Guardrail:** Local deterministic product first. No hosting, OAuth, accounts,
mainnet, real premium article storage, paywall bypass, generic commerce, or
default auto-buy.

## How to keep this current

After each issue is integrated into the orchestration branch, update its row
below with the status, commit SHA, verification evidence, and one-line note.
Push the tracker change in the same integration commit or a closely adjacent
docs commit. Use the GitHub Project custom `Workflow` field, not the generic
GitHub `Status` field:

- `Backlog`: dependency still open.
- `Ready`: all blockers are integrated and the item can be dispatched.
- `In progress`: a Luna subagent owns an active worktree.
- `Review`: integrated to the orchestration branch; final PR-to-main merge is
  still pending.
- `Blocked`: an explicit stop/escalation condition is active.
- `Done`: only after the integration PR is merged to `main`.

Do not promote a blocked item merely to keep agents busy. When the next wave
has unrelated, ready work, dispatch it in parallel instead.

## Cross-cutting preflight (not a new product issue)

| Check | Required evidence | Status | Commit / note |
| --- | --- | --- | --- |
| Clean install and baseline | `npm ci`, `npm run verify` | Passed | `7a53ac9` scopes Vitest to product unit tests; clean install passed and `npm run verify` passes. |
| Fast local gate | `check:fast` runs typecheck + deterministic Vitest tests | Passed | `c280f32`; `npm run check:fast` passes. |
| Commit hook | Tracked Husky hook invokes `npm run check:fast` | Passed | `c280f32`; clean-install Husky pre-commit hook invocation passes. |
| Browser proof baseline | Existing Playwright and accessibility suites assessed and documented | Passed | `b32dca4`; cross-platform fixture server; e2e 5/5 and a11y 1/1 pass. |

Keep the existing npm/TypeScript/Vitest/Playwright stack. Full `verify` is an
integration gate; e2e and accessibility checks run at workflow milestones and
where an issue explicitly requires them.

## 20-issue critical path

The plan is ordered in dependency waves. Issues within one wave can use
separate worktrees only when file ownership does not overlap. #25 and #27 are
already complete and are intentionally not part of this 20-issue run.

| Wave | Issue | Outcome | Depends on | Initial state | Integrated commit / tests / note |
| --- | --- | --- | --- | --- | --- |
| 1 | [#8 RA-01](https://github.com/Collaboration95/theFastandtheFungible/issues/8) | Canonical validated article fixture corpus | — | Review | `33b4fe9`; canonical catalog validation, public-body stripping, `check:fast`, and `verify` pass. |
| 1 | [#32 UX-01](https://github.com/Collaboration95/theFastandtheFungible/issues/32) | Editable official-view Excalidraw wireframes | — | Review | `1ef4420`; canvas JSON/SVG generation check, `check:fast`, and `verify` pass. |
| 2 | [#33 UX-02](https://github.com/Collaboration95/theFastandtheFungible/issues/33) | Official landing and application shell | #32 | Backlog | |
| 2 | [#34 PLAN-01](https://github.com/Collaboration95/theFastandtheFungible/issues/34) | Finance research approaches and plan artifacts | #8 | Ready | |
| 2 | [#22 LDF-02](https://github.com/Collaboration95/theFastandtheFungible/issues/22) | Clean, repeatable local research state | #8 | Ready | |
| 2 | [#9 RA-02](https://github.com/Collaboration95/theFastandtheFungible/issues/9) | Local wallet and manual research mandate | #8, #32 | Ready | |
| 3 | [#35 PLAN-02](https://github.com/Collaboration95/theFastandtheFungible/issues/35) | Reviewable, editable research plan | #33, #34 | Backlog | |
| 3 | [#20 LDF-04](https://github.com/Collaboration95/theFastandtheFungible/issues/20) | Evidence-family workspace and evidence gaps | #8, #33 | Backlog | |
| 4 | [#23 LDF-05](https://github.com/Collaboration95/theFastandtheFungible/issues/23) | Rich paywalled article cards and inspection | #20 | Backlog | |
| 4 | [#21 LDF-06](https://github.com/Collaboration95/theFastandtheFungible/issues/21) | Visible formal research workflow and controls | #35, #20 | Backlog | |
| 5 | [#14 RA-06](https://github.com/Collaboration95/theFastandtheFungible/issues/14) | Explainable article valuation | #21, #23 | Backlog | |
| 6 | [#26 LDF-07](https://github.com/Collaboration95/theFastandtheFungible/issues/26) | Recommended/redundant/blocked comparison | #14 | Backlog | |
| 7 | [#36 BUY-01](https://github.com/Collaboration95/theFastandtheFungible/issues/36) | Explicit approval, quote, settlement, and unlock lifecycle | #9, #26 | Backlog | |
| 8 | [#10 RA-07](https://github.com/Collaboration95/theFastandtheFungible/issues/10) | Claim-level evidence-impact comparison | #36 | Backlog | |
| 9 | [#11 RA-08](https://github.com/Collaboration95/theFastandtheFungible/issues/11) | Evidence Receipt view and JSON export | #36, #10 | Backlog | |
| 9 | [#37 OUT-01](https://github.com/Collaboration95/theFastandtheFungible/issues/37) | Analyst-ready cited dossier | #10 | Backlog | |
| 9 | [#6 RA-03](https://github.com/Collaboration95/theFastandtheFungible/issues/6) | Safe reset and canonical rerun | #22, #36 | Backlog | |
| 9 | [#16 RA-05](https://github.com/Collaboration95/theFastandtheFungible/issues/16) | Deterministic research and purchase failure states | #8, #36 | Backlog | |
| 9 | [#5 RA-09](https://github.com/Collaboration95/theFastandtheFungible/issues/5) | Truthful sandbox, wallet, and access labels | #33, #36 | Backlog | |
| 10 | [#24 LDF-08](https://github.com/Collaboration95/theFastandtheFungible/issues/24) | Canonical local release gate | #6, #11, #37, #26 | Backlog | |

## Dispatch and review rules

1. The first dispatch is #8 and #32 in two isolated Luna/xhigh worktrees.
2. Complete all acceptance criteria and focused tests before integrating a
   subagent’s commit.
3. Before each integration, the orchestrator reviews the diff and runs
   `npm run check:fast` plus `npm run verify`; use targeted Playwright/a11y
   checks for affected user-facing flows.
4. Only after integration are downstream dependencies eligible for `Ready`.
5. Keep at most three Luna/xhigh subagents active and avoid overlapping files.
6. Push the orchestration branch after every stable wave or earlier when a
   nontrivial integration has landed.
7. Keep underlying GitHub issues open until the final PR merges to `main`.

## Required final proof

Before handoff, the orchestration branch must provide all of the following:

- `npm ci` works from a clean worktree.
- `npm run check:fast` and `npm run verify` pass.
- Relevant `npm run test:e2e` and `npm run test:a11y` checks pass.
- The canonical local story demonstrably shows buy, skip, and block; explicit
  approval; locked-before/unlocked-after access; a cited claim impact; dossier;
  receipt; failure states; and reset.
- No credentials or premium bodies are committed, exposed to client code, or
  printed in logs.
- The PR diff is reviewed end-to-end, all tracker rows are current, and the
  PR description links every included issue and verification result.

## Escalation log

| Date | Issue | Condition | Decision needed | Safe work pushed? |
| --- | --- | --- | --- | --- |
| | | | | |
