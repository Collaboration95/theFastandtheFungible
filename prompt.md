# ResearchAgent: October 10 build prompt (v2, 6 Oct)

> Paste this into the orchestrating agent. Use **GPT-6.1 Sol** for the
> orchestrator, every implementation worker, and the single review pass.
>
> **Product, scope and decisions live in [FINAL-PUSH.md](FINAL-PUSH.md)**
> (decisions D1–D14, open items O1–O5). This file holds the hard gates and
> the workflow. The 4 Oct version is archived at
> `docs/archive/prompt-v1-oct4.md` (history only, not acceptance criteria).

## 0. Situation

- **Event:** AI Tinkerers Singapore, Sat 10 Oct 2026, Singtel 8George (8 George St).
  Lightning demos start 10:40, with 5 minutes of live demo plus Q&A. The
  audience wants running code and visible internals. They do not want a pitch.
- **Today:** Tue 6 Oct. `main` holds the v1 build (single synthetic Vertex
  corpus, x402-shaped flow, XRPL Testnet, DeepSeek, Clef, Langfuse). The 6 Oct
  pivot ([FINAL-PUSH.md](FINAL-PUSH.md)) is not implemented yet.
- **Time:** feature freeze is **Thu 8 Oct, 20:00 SGT**. Fri 9 Oct is for
  rehearsal only.
- **Operating principle:** 80/20. Ship a working, visibly impressive demo. Every
  feature must reinforce a pillar (FINAL-PUSH D12). If a small bug slips
  through, the next agent fixes it. Favour speed over ceremony, except for the
  five gates in §2.

## 1. The product

See [FINAL-PUSH.md §1](FINAL-PUSH.md#1-what-we-are-building): a neutral search
engine for agent-readable expertise, with a wallet. Writers search their own
articles, Clef decides what is worth buying, code pays the writer over x402 on
XRPL Testnet, and every promise is checked after delivery.

## 2. The only hard gates

Never merge a PR that breaks one of these:

1. **No premium bytes before a grant.** Premium bodies and spans must not reach
   the browser, SSE, logs, the LLM, or the decision model until a verified delivery grant
   exists for that run, resource, and version. Unbought candidates are judged
   on their public metadata and preview only.
2. **The budget is the only authorization.** The server enforces
   `spent + reserved ≤ budget` and `price ≤ per-source cap (default S$1.00)`.
   A budget of S$0 means zero purchases. **Only policy code** can initiate a
   purchase, using decision-provider outputs. The LLM never can, and no text
   from any article can raise the budget or the cap. Stop halts new purchases
   immediately.
3. **One charge per intent.** A retry, a parallel request, or a restart
   mid-purchase produces at most one settlement.
4. **Citations are real.** Every citation in a displayed answer or the PDF must
   resolve to a span the run could access. The span text must be an exact
   substring of that resource's delivered body. Drop invalid claims; never
   repair them by attaching a different span.
5. **Everything simulated or substituted is labelled.** The UI always shows the
   research model (`DeepSeek <model>`, `Groq <model>` or fixture), the decision provider
   (`Cloudflare <model>` or fixture), the publisher location (local or Cloud Run), and the
   settlement label (`SIMULATED SGD · no real funds` or `XRPL TESTNET · no real value`;
   XRPL Testnet settlement returned on 5 Oct, #98). A fallback is allowed, but
   it is always visible.

Everything else is best effort.

Clarifications for the 6 Oct direction (search hits, the 5 s action modal,
trust, refunds, labels) are in [FINAL-PUSH.md §12](FINAL-PUSH.md#12-hard-gates-promptmd-2-unchanged-with-clarifications).

## 3. Cut from scope

See FINAL-PUSH D11. Also out: per-purchase human approval, AWS AgentCore,
audience questions on stage.

## 4. Target architecture

See FINAL-PUSH §3 (diagram), §5 (client flow), §8 (writer site and manifest)
and §9 (x402 v2 changes). The v1 code under `server/`, `publisher/` and
`shared/` is the starting point; the hardened single-charge purchase core is
kept.

## 5. Corpus

See FINAL-PUSH §10 (writers) and O1 (writer websites and content, deferred).
The Vertex corpus stays as the offline backup scenario (D14).

## 6. Work packages

See FINAL-PUSH §13: W0 contracts first, then W1 search, W1 pay and W1 agent in
parallel, then W2 UI and W2 corpus. Write scopes are listed there.

## 7. Worker protocol

The orchestrator pastes this section into each worker's brief.

1. Work in your own worktree and branch:
   `git worktree add ../tftf-wt/<ID> -b <id> origin/main`, then `npm ci`.
   Copy `.env` from the main checkout only if your package needs live keys.
2. Read `FINAL-PUSH.md`, this file, the files you own, and `shared/contracts/`.
   Do not read `docs/archive/`; it is the replaced direction.
3. Stay inside your write scope. If you need a change to a contract someone
   else owns, make the smallest additive change and call it out in the PR.
4. Do not start servers on 5100/8788/8790, because other workers use them. Tests
   that need servers listen on ephemeral ports. Do not run Playwright; the
   orchestrator runs it on `main`.
5. You may delete or rewrite tests that encode removed behaviour: the
   3-value `FacetSchema` gaps, a publisher search that ignores the query, the
   5-hop x402-shaped flow (`/v1/quotes`, `/v1/settlements`, Bearer secret,
   `X-Delivery-Token`), and Vertex-only questions outside the scenario
   fallback. Never weaken tests that guard a §2 gate.
6. WIP commits may use `--no-verify`. The final commit must pass the
   pre-commit hook (`npm run check:fast`). Use Conventional Commit messages.
7. Timebox: if the same failure survives about 3 attempts or 45 minutes, ship
   the part that works and leave `TODO(<ID>)` plus a note in the PR. The next
   agent picks it up.
8. Open the PR with
   `gh pr create --base main --title "<type>(<area>): <summary> [<ID>]"` and
   this body:

   ```markdown
   ## What
   ## Closes
   Closes #.. (or "Part of #..")
   ## How verified
   Commands run and their results
   ## Demo impact
   What the audience will now see
   ## Build notes (for the talk)
   Time spent · what broke · what surprised you · what the reviewer caught
   ## Follow-ups
   ```

### Repair loop (from the retired `docs/AGENT-DEVELOPMENT.md`)

1. Establish the failure with a named case and an expected outcome.
2. Implement the smallest coherent change inside the assigned write scope.
3. Run focused checks and capture case ID, expected/actual behavior, exit status,
   minimal diagnostics, and a trace or screenshot when it helps.
4. Give that evidence to the worker for a bounded repair, up to three attempts.
5. Run the independent acceptance check on the resulting code tree.

A worker's success message is a claim; exit codes and artifacts are evidence.
Deleting tests, relaxing limits, or blindly accepting screenshots does not
repair the product. After repeated conceptual failure, identify the wrong
assumption or reduce the task, and continue other ready work.

## 8. Review: exactly one pass

When a PR is ready, spawn one reviewer (GPT-6.1 Sol) with the PR diff and this
prompt:

> Review this PR once, for a demo that ships in days. Report at most 5
> **BLOCKERS**, each with `file:line` and a one-line fix. A blocker is only:
> (a) something that violates a §2 gate in prompt.md, (b) something that breaks
> build, typecheck, tests, or app startup, (c) obviously wrong core behaviour
> the demo depends on, or (d) a leaked secret. Everything else goes under
> **NITS** (at most 5, one line each); nits will not be fixed now. If there are
> no blockers, reply "NO BLOCKERS". Do not ask for more tests, refactors, docs,
> or style changes.

The worker (or the orchestrator) then fixes the blockers in one commit. Once
`check:fast` is green, **squash-merge**. There is no second review. Collect the
nits into one `followup`-labelled issue per wave, or drop them.

## 9. Orchestrator loop

- **Start:** run W0 alone and merge it. Then start every wave-1 worker in
  parallel. Use subagents if your harness supports them; otherwise run one
  session per package, each in its own worktree, started with "Read prompt.md;
  you are package <ID>."
- **Merging:** merge each PR as soon as it passes review and `check:fast`. The
  default order is W0 → search → pay → agent → UI → corpus (FINAL-PUSH §13).
  On a conflict, the later PR rebases.
- **Red `main`:** a red `main` is the top priority. Spawn a fixer at once whose
  only job is to make `check:fast` green.
- **After each wave:** on `main`, run `npm run verify` (Playwright, serial) and
  smoke-test with `npm run demo`, running FINAL-PUSH UC1–UC3 and one S$0 ask.
  Spawn fix-forward tasks for anything broken, then start the next wave.
- **Issues:** one issue per FINAL-PUSH §13 stream; link it to the decision IDs
  it implements. Issues #59–#78 belong to the replaced direction.
- **Build log:** after each wave, append a summary to `talk/build-log.md` and
  commit it directly to `main`. Only the orchestrator writes this file, which
  avoids merge conflicts. Record:
  packages, PR links, wall-clock time, the number of review blockers, what
  broke, and one lesson learned. This is raw material for the talk, so keep it
  honest and specific; it cannot be reconstructed later.
- **Never:**
  - push to `main` without a PR, except to fix a red `main` or to update
    `STATUS.md` and `talk/build-log.md` (§12);
  - use real money or real credentials beyond the provided API keys;
  - create cloud resources;
  - weaken a §2 gate.

## 10. Schedule (SGT)

| When | Milestone |
| --- | --- |
| Tue 6 Oct night | Docs pivot merged; W0 contracts merged |
| Wed 7 Oct | W1 search, W1 pay, W1 agent in parallel; merged by Wed night |
| **Wed 7 Oct night** | **End-to-end on `main`: ask → clarify → plan → federated search → free answer → Clef + trust → x402 v2 purchase → proof check → answer v2**, the most important milestone |
| Thu 8 Oct | W2 UI, W2 corpus, UC1–UC3 scenarios; **feature freeze at 20:00**; afterwards the human records a labelled fallback video |
| Fri 9 Oct | The human rehearses 3× on the presenting laptop; tag `demo-oct10` |
| Sat 10 Oct | `npm run demo:live` at the venue, phone hotspot as backup, `SOURCE_MODE=scenario` (Vertex) as the offline fallback |

## 11. The goal: when the orchestrator is done

Done when every item below is true on `origin/main`:

- The FINAL-PUSH §13 streams are merged and `npm run verify` passes.
- `npm run demo:live` runs FINAL-PUSH §11 UC1 (S$0 spent), UC2 (a paid article
  changes the answer, Testnet receipt) and UC3 (AlphaLeak fails its proof, the
  challenge refunds on Testnet, trust quarantines it).
- A S$0 budget buys nothing and shows "would buy"; the scenario fallback works
  offline.
- Every citation in the UI and the PDF opens or names the exact passage.
- `STATUS.md` lists the remaining human-only steps: fallback recording,
  rehearsals, and tagging `demo-oct10`.

Then **stop**. Don't invent features.

## 12. Unattended mode (overnight `/goal` runs)

The human starts this once and checks in each morning. Nobody answers
questions overnight.

- **Never wait for a human.** When something is ambiguous, choose the option
  that keeps the §1 story and the §2 gates intact, record the decision in
  `STATUS.md`, and continue.
- **Never stall on one thing.** Give a stuck package the `blocked` label and a
  line in `STATUS.md`, then move to other ready work. Anything only a human can
  do (a missing key, a deploy, a recording, a rehearsal) goes under "Needs you"
  and is skipped.
- **State lives in git and GitHub, not in your memory.** On every start or
  resume, after a crash, restart or context reset, read these before doing
  anything:
  - `STATUS.md`;
  - `git log --oneline -30 origin/main`;
  - `gh pr list --state all --limit 50`;
  - `gh issue list --label blocked`;
  - `git worktree list`.

  Continue from there. Never redo a merged package. Remove worktrees once
  their PRs merge.
- **Concurrency:** run at most 6 workers at once. On rate limits (HTTP 429),
  back off and retry later instead of spinning.
- **Live API calls** happen only in the post-wave live smoke test and the
  one-off corpus/embedding build. Stay under about 300 DeepSeek calls and
  1,000 Clef calls per night.
- **Clock:** check the time in SGT. Before Thu 8 Oct 20:00, build. After that,
  only fixes that stay inside one package. Don't start W2 while the
  Wednesday-night milestone in §10 is broken.
- **`STATUS.md`** lives at the repo root, and you commit it directly to `main`.
  Update it after every merge, and at least every 2 hours. Keep it short:

  ```markdown
  # Build status (<SGT timestamp>)
  ## Needs you
  Blockers and decisions waiting on the human; always at the top, empty if none.
  ## Decisions I made
  One line each, with the reason.
  ## Done since last check-in
  Package, PR link.
  ## In progress
  ## Next up
  ## Demo check
  The last `npm run demo` smoke result: PASS or FAIL, plus one line.
  ```
