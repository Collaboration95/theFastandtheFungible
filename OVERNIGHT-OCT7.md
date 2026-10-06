# Overnight run, 7 Oct 2026: build the final push

> **Paste this into the orchestrating agent** (Claude Code or Codex, high reasoning):
> "Read `OVERNIGHT-OCT7.md` in the repo root and execute it to completion. You are the orchestrator."
>
> The human is asleep. Nobody answers questions until morning. Decide, record the decision in `STATUS.md`, and continue (prompt.md §12).

## 0. Mission and definition of done

Build everything specified in the GitHub issues of milestone **"10 Oct 2026 — AI Tinkerers demo"**: epics #111, #116, #121, #127, #135, #144, #149, #155 and all their sub-issues. **There is no cut order** (FINAL-PUSH D15). Everything is in scope, **except** the stretch epic #162 and its sub-issues (#163–#166, label `deferred`, titled "DO NOT IMPLEMENT"). Never implement those. Don't even open a branch for them.

**Done** means all of the following are true on `origin/main`:

1. Every non-`deferred` issue in the milestone is closed by a merged PR.
2. `npm run verify` passes (lint, typecheck, unit, scenario tests, Playwright, build).
3. The live smoke (#158) has run UC1, UC2 and UC3 once, green, on DeepSeek + Clef + XRPL Testnet. The tx hashes, the refund hash and the Langfuse trace URLs are recorded in `STATUS.md` → "Demo check".
4. The v2 corpus and embeddings are committed (#120, #123), and the Vertex corpus is gone (#156).
5. `STATUS.md` (morning report, §9) and `talk/build-log.md` (one entry per epic) are updated.

**The authoritative issue list** is always the milestone itself, because the coverage audit may have added issues after this file was written:

```bash
gh issue list --milestone "10 Oct 2026 — AI Tinkerers demo" --state open --limit 100 --json number,title,labels
```

## 1. Read first (in this order, then stop reading)

1. `AGENTS.md`: the rules.
2. `FINAL-PUSH.md`: the decisions D1–D24 are closed; never reopen them. §5 pseudocode, §7 reputation, §8 publisher duties, §9 x402 v2, §11 use cases, §12 gate clarifications.
3. `prompt.md` §2 (the five hard gates), §7 (worker protocol and repair loop), §12 (unattended mode).
4. The issue you are about to work on, and its parent epic.

Never read `docs/archive/`. Do not read the whole `docs/` tree.

## 2. Hard rules (any violation is a blocker)

- **The five gates** (prompt.md §2): no premium bytes before a grant; the budget is the only authorization and only policy code purchases; one charge per intent; real citations; label everything simulated.
- **Money:** XRPL **Testnet** only. Never mainnet. No real money. No cloud resources. Never log or commit seeds or API keys.
- **Hands off:**
  - the main checkout's uncommitted `v1.x-UX-tweaks` work;
  - `../tftf-wt/cloudrun`, `../tftf-wt/phase2`, and the `feat/xrpl-publisher-wallets` branch;
  - Cloud Run;
  - `docs/ux-walkthrough/`;
  - `docs/contracts/DESIGN.md`.
- **Ports:** never bind 5100/8788/8790. Tests use ephemeral ports. Live runs use `DEMO_PORT_OFFSET=300` (5400/9088/9090).
- **Playwright** runs only on the orchestrator, serially, on an up-to-date `main` checkout in `../tftf-wt/orchestrator`.
- **Langfuse** is off everywhere except the live smoke (#158) and an explicit `make live` (D22). Never run tests with `LANGFUSE_ENABLED=1`.
- **Live API budget for the whole night:** ≤ 300 DeepSeek calls, ≤ 1,000 Clef calls, ≤ 200 Workers AI embedding calls, ≤ 20 faucet requests. On a 429, back off; never spin.

## 3. Subagent policy: one or two, never more

- **You, the orchestrator,** own planning, merging, `main`'s health, Playwright, the live steps and `STATUS.md`.
- **Run at most 2 implementation subagents at the same time.** One is the default. Use the second only when two work packages in the same wave have **disjoint write scopes** (§5 marks these as parallel lanes).
- Give each subagent **one work package** (§5): one or more sibling sub-issues with one worktree, one branch and one PR. Batching siblings is how we save overhead, so don't spawn a subagent per tiny issue.
- **Don't spawn subagents** for reading, searching, reviewing or summarising. Do those yourself or through the Codex review CLI (§6). Don't spawn a subagent to babysit another.
- **Subagent brief** (paste this, filled in):

  > You are implementing work package `<WP>` = issues `#a, #b, …` (read each with `gh issue view`). Read `AGENTS.md`, `FINAL-PUSH.md` and `prompt.md` §2/§7 first.
  >
  > - Work only in `../tftf-wt/<wp-id>` on branch `<wp-id>`, created from `origin/main`, then `npm ci`.
  > - Copy `.env` from the main checkout only if an issue says it needs live keys.
  > - Stay inside the union of the issues' write scopes.
  > - Implement every **Do** item. Meet every **Acceptance** item with a runnable test.
  > - Run `npm run check:fast` until green (repair loop: at most 3 attempts per failure, then reduce scope and leave `TODO(<issue>)` with a PR note).
  > - Commit with Conventional Commits, push, then open one PR: `gh pr create --base main --title "<type>(<area>): <summary> [<WP>]"`, with a body using the prompt.md §7.8 template, and `Closes #a`, `Closes #b`.
  > - Reply with the PR URL, what was verified, and any `TODO`.
  > - Do not merge. Do not touch other worktrees.

## 4. Per-PR loop (the orchestrator does this for every PR)

1. `gh pr checks <pr>` (one read, no polling loops) and a local `npm run check:fast` in the PR's worktree.
2. **Codex review, exactly one pass** (§6). Paste the review output into a PR comment: `gh pr comment <pr> --body-file /tmp/review-<pr>.md`.
3. **BLOCKERS:** the subagent (or you) fixes them in one commit, then re-run `check:fast`. There is no second review (prompt.md §8). NITS go into one `followup`-labelled issue per epic, or get dropped.
4. **Merge:** `gh pr merge <pr> --squash`. Then confirm `main` is still green: in `../tftf-wt/orchestrator`, run `git pull && npm ci && npm run check:fast`. **A red `main` is top priority:** fix it before anything else.
5. Make sure the closed issues are closed, remove the worktree (`git worktree remove`), and delete the branch.
6. Append one line to `STATUS.md` → "Done since last check-in". After an epic completes, append a build-log entry (packages, PR links, wall clock, review blockers, what broke, one lesson).

## 5. Work packages and waves

Issue numbers as created (#111–#166). Lanes in the same wave can run in parallel (≤ 2 subagents). A package waits for everything in earlier waves to merge, unless noted.

| Wave | Lane | Work package (issues, one PR) | Needs live keys? |
|---|---|---|---|
| **0** | — | **WP-W0** contracts: #112, #113, #114, #115 | no |
| **1** | A | **WP-C1** roster + story bible: #117, #118 | no |
| 1 | B | **WP-S1** publisher host + Orama + search route: #122, #123 (BM25 path and code first), #124 | no |
| **2** | A | **WP-C2** generator: #119 → then **WP-C3** generate and commit the corpus: #120 (orchestrator runs the live generation) | DeepSeek |
| 2 | B | **WP-S2** manifests + AlphaLeak: #125, #126 | no |
| **3** | A | **WP-P1** x402 402 + facilitator + buyer: #128, #129, #130 | no (simulated rail) |
| 3 | B | **WP-A1** scope/plan + retrieval + gaps: #136, #137, #138, #139. Shares `server/publisher-client.ts` with WP-P1, so whichever merges second rebases. | no (fixtures) |
| **4** | A | **WP-P2** proofs + challenge/refund + wallets + gate suite: #131, #132, #133, #134 | Testnet for #133 (the orchestrator runs `make wallets CREATE=1`) |
| 4 | B | **WP-A2** reputation + calibration: #140, #141 | no |
| — | orch | **Testnet probe** after wave 4: `#158 --probe` (one paid purchase + one challenge/refund on the Testnet; catches rail problems before integration) | Testnet |
| **5** | A | **WP-A3** loop integration, then Langfuse spans: #142 → #143 | no |
| 5 | B | **WP-SITE** writer blogs: #145, #146, #147, #148 | no |
| — | orch | **Embeddings:** after #120 merges, run `make embeddings` live, commit the cache (completes #123's live part) | Workers AI |
| **6** | A | **WP-T1** retire Vertex + UC scenario tests: #156, #157 | no |
| 6 | B | **WP-UI** functional UI: #150, #151, #152, #153; then #154 after #157 merges (presets and fixtures come from the UC scenarios) | no |
| **7** | orch | **WP-T5** doctor/make targets: #160 → **#158** live smoke (orchestrator) → **#159** Playwright (orchestrator) → **#161** docs + build log | all |

The 7 Oct coverage audit created no new issues. It appended an "Added by coverage audit (7 Oct)" section to 43 issues: route fixes, scope additions, and a **Depends on** line on every sub-issue. **That section is part of the spec.** Where it refines the original text, it wins. If issues are added later, slot each one into the wave of its epic's package (same lane), or a final wave 7 package if it's cross-cutting.

**Live steps the orchestrator runs itself** (with `.env` from the main checkout, never printing secrets):

- `make doctor` and `make keys` before wave 2.
- Corpus generation (#120): ≤ 120 DeepSeek calls.
- `make embeddings`: ≤ 200 calls.
- `make wallets CREATE=1` (#133).
- The live smoke (#158) with `DEMO_PORT_OFFSET=300`.

If a provider is down, keep building on fixtures, mark the live step `blocked` in `STATUS.md` → "Needs you", and continue.

## 6. Code review: Codex CLI, `gpt-6-luna`, fast tier, high reasoning (D24)

Verified on this machine: codex-cli 0.160, model `gpt-6-luna` present, fast = service tier `fast` (priority).

**Primary (gate-focused, our blocker prompt):** run inside the PR's worktree after `git fetch origin main`:

```bash
codex exec -m gpt-6-luna -c service_tier='"fast"' -c model_reasoning_effort='"high"' \
  -s read-only --ephemeral -C "$PWD" -o /tmp/review-<pr>.md - <<'EOF'
Review the changes on this branch versus origin/main (run `git diff origin/main...HEAD` and read touched files as needed) for PR #<pr>, which closes issues <#a, #b>. Read AGENTS.md and FINAL-PUSH.md §12 first.
This is a demo shipping in days. Report at most 5 BLOCKERS, each with file:line and a one-line fix. A blocker is only:
(a) a violation of a hard gate in prompt.md §2 (premium bytes before a grant; any spend path not gated by policy code and the budget; more than one charge per intent; a citation that doesn't resolve to an accessible exact span; an unlabelled simulation or fallback);
(b) something that breaks build, typecheck, tests or app startup;
(c) an Acceptance item in the closed issues that is not met or has no test;
(d) a leaked secret or a seed or key in logs.
Everything else goes under NITS (at most 5, one line each). If there are no blockers, reply exactly "NO BLOCKERS". Do not ask for refactors, docs or style changes.
EOF
```

**Optional second opinion (built-in reviewer, no custom prompt allowed with `--base`):**

```bash
git fetch origin main:refs/remotes/origin/main
codex review -c model='"gpt-6-luna"' -c service_tier='"fast"' -c model_reasoning_effort='"high"' --base origin/main
```

Use the optional pass only for the money-path packages (WP-P1, WP-P2, WP-A3), and treat its P0/P1 findings as blockers only if they match (a)–(d).

## 7. Order constraints and gotchas

- **WP-W0 first, alone.** Every later package imports its schemas. W0 keeps old code compiling through thin adapters.
- **Search and retrieval tests use the mini corpus** (`tests/fixtures/corpus-mini`) until #120 merges. Don't block on the live corpus.
- **The money core is hardened.** WP-P1 and WP-P2 must port, not weaken, the one-charge-per-intent tests (reserveIntent, the claimSubmitting compare-and-swap, the write-once signed blob, LastLedgerSequence expiry).
- **The simulated rail** is the default in tests and the fixture demo. Every simulated path is labelled SIMULATED.
- **AlphaLeak is caught by the protocol**, not special-cased in the client. Only `publisher/bad-actors.ts` knows it lies.
- **Reputation** is keyed by publisher wallet (D21). The UI tab is labelled "Writers" for now. Its final name is X3, deferred.
- **UI work is functional and additive** (D23): new component files and minimal `App.tsx` wiring. Keep the stage-pace motion (D13).
- **Never reopen decisions.** If an issue conflicts with FINAL-PUSH, FINAL-PUSH wins. Record the conflict in `STATUS.md` → "Decisions I made".

## 8. Recovery (on every start, resume or context reset)

Read, then continue from where things stand. Never redo a merged package.

```bash
cat STATUS.md
git fetch origin && git log --oneline -30 origin/main
gh pr list --state all --limit 50
gh issue list --milestone "10 Oct 2026 — AI Tinkerers demo" --state open --limit 100
git worktree list
```

## 9. Morning report (`STATUS.md`, committed directly to `main`)

Keep the existing format (prompt.md §12) and fill it in:

- **Needs you:** blocked items, live steps that failed, decisions only the human can make.
- **Decisions I made:** one line each, with the reason.
- **Done since last check-in:** work package → PR link → issues closed.
- **Demo check:**
  - `npm run verify` result;
  - live smoke per UC: providers, spend, tx hash, refund hash, reputation after UC3, Langfuse trace URL;
  - the `/w/` writer index URL.
- **Next up:** the stretch epic #162 stays untouched; UX polish (X4) is the human's next step.
