# Build run: one queue, bundled PRs, four waves

Paste this into the coordinating agent.

You coordinate a parallel build of the work listed in issue #202. It is delivered as **7 bundled PRs in 4 waves**.
- **You:** plan, start the workers, decide the merge order, run every live step yourself, and keep STATUS.md current.
- **Workers:** implement inside their own worktrees.

## 1. Read first

1. [`final-push/analysis/NEXT-STEPS.md`](NEXT-STEPS.md): the plan of record. It holds the owner's decisions, the background, and which issue fixes which problem.
2. Issue #202, and every issue in the wave you are about to start. The issues hold each task's write scope and acceptance criteria. Read them in full.
3. `AGENTS.md` and `FINAL-PUSH.md`. Note that D9 is being amended by #214.
4. The repo's root `prompt.md` §2, the five hard gates.
5. The ship-pr skill (`ship-pr/SKILL.md` in the repo's skills folder).

## 2. Owner overrides for this run (8 Oct)

These replace any conflicting instruction in the root `prompt.md` or `AGENTS.md`:

- **No dates.** There is no feature freeze and nothing waits for a date. Order work only by dependencies and by which files are shared.
- **No review of any kind.**
  - Skip step 4 of the ship-pr skill.
  - Don't run `scripts/orch/review.sh`.
  - Don't start a reviewing agent.
  - The owner reviews everything after all the PRs have merged.
- **#194 and its sub-issues are no longer deferred.**
- **One PR per bundle (§5).** Each PR closes or advances three or more issues. Use one `Closes #…` or `Part of #…` line per issue.
- **At most 3 workers at once.**
- **Merge automatically** once the branch passes `npm run check:fast` and CI is green.
- **The decision-model switch (#214) is approved.** The D9 amendment ships inside PR 5.

## 3. Rules that still hold

- **The five hard gates** (root `prompt.md` §2):
  - no premium bytes anywhere before a verified grant;
  - the budget is the only authorization to spend, and only policy code buys;
  - one charge per intent;
  - citations are exact spans of accessible text;
  - everything simulated or substituted is labelled.
- **Worktrees.** Every bundle gets its own:
  ```
  git worktree add ../tftf-wt/<branch> -b <branch> origin/main
  ```
  then `git branch --unset-upstream`. Never edit files in the main checkout. The one exception is PR 1, which *copies* the v1.2 UI work out of it.
- **Workers never:**
  - make live API calls (no real model calls, embeddings, corpus generation or Testnet payments);
  - bind ports 5100, 8788 or 8790;
  - run Playwright.

  Tests use mocks and fixtures.
- **Never** log keys or wallet seeds, use real money, or create cloud resources.
- **Intended behaviour changes**, for example #197 replacing the fallback tests, go in the PR body and STATUS.md. A test or check may be loosened only when the fix belongs elsewhere. Say what and why, in both places.
- **Stuck work:** label the issue `blocked`, add a line to STATUS.md, and carry on with everything else. Never wait for a human.

## 3a. UI rules (owner, 8 Oct)

Every change under `src/` follows these. They come from `docs/ui-critique-oct7.md` ("Patterns to stop") and the owner's direction.

- **Don't bombard the reader.**
  - Each state shows one short line at the top level ("Thinking about …", "Searching 8 writers", "Bought 1 source").
  - Detail is one step deeper, on demand: an expander, a tooltip, or Show work. Most readers never open it.
- **No taglines, no explanations of the mechanism, no helper text under controls.** A label must stand alone; if it can't, use a tooltip.
- **One surface per event.** A toast only when the event is off screen.
- **No code vocabulary in reader-facing text:** gap, threshold, provider, refusal, manifest, 402, H/C/T, UC1, and the like.
- **Label lists once; badge only the exceptions.** The honesty labels from gate 5 (settlement, synthetic content, a substituted or failed decision) stay visible but quiet.
- **No model or provider chips in the header.** Which decision provider ran belongs in the run's details and Show work.
- **Light theme only.** Keep motion for the one event that matters, the purchase.
- **The new states** (#197, #208, #214), as one line each:
  - **Failed round:** "Couldn't judge sources right now · nothing bought", with Retry. The reason goes in Show work.
  - **Requested facts:** "2 of 3 answered", expandable to the list.
  - **Provider label:** in the run's details, not the header.

## 4. Revert, live calls and the stage

**Revert points:**
- the tag `known-good-2026-10-08`, the whole app;
- the provider setting documented in #214, the decision model only.

**Live calls** (coordinator only):
- **Budget:** US$5 in total for this run, across all providers.
- **Stop live work** at the first quota or rate-limit error (any HTTP 429, including daily-allowance code 4006). Record it in STATUS.md.
- **On a daily-allowance error** for the search-embedding and backup-decision provider, you may switch once to the backup credential pair (#196). Record the swap in STATUS.md and continue within the budget. Never print credential values.
- **No batch jobs** (benchmarks, full corpus generation, bulk embedding) on either account. The only re-embedding allowed is for the few articles a PR changed.
- **Logging:** add one STATUS.md line per live step: what ran, the number of runs, the estimated spend.
- **Reputation:** reset it before every live use-case run.

**The stage cut, Sat 10 Oct:**
- Finish by 08:30 SGT. The slot is at 10:40.
- On the latest `main`: reset reputation, run `make preflight`, then `make smoke`.
- If both pass, tag that commit `demo-oct10` and present it. Otherwise present `known-good-2026-10-08`.
- Record the choice in STATUS.md and on #201.
- After the cut, don't change the presenting machine until the slot and its Q&A are over. Work on `main` continues.

## 5. The waves

**Shared files: merge in this order.** If two bundles touch the same file, the earlier one merges first and the later one rebases.
- `server/agents/decision.ts`: PR 2 → PR 5 → PR 7
- `server/agents/loop.ts`: PR 2 → PR 5 → PR 6
- `data/corpus/v2/**`: PR 3 only
- `src/components/Answer.tsx`: PR 1 → PR 6

### Wave 0: setup (coordinator, serial)

1. `git fetch`.
2. Confirm that CI on `main` is green and that the tag `known-good-2026-10-08` exists.
3. Run `gh pr list`. If an open PR touches a bundle's files, hold that bundle and say why.
4. Read every wave 1 issue, then create the worktrees for PRs 1–3.

### Wave 1: PRs 1, 2 and 3 in parallel; PR 4 when a slot frees

**PR 1: Stage UI and Q&A** (branch `stage-ui-qa`). **Must merge by Fri 9 Oct, 10:00 SGT.**
1. **The v1.2 UI work.**
   - Copy it from the main checkout into the worktree without changing the main checkout:
     - the tracked diffs (`src/App.tsx`, `src/components/Ask.tsx`, `Budget.tsx`, `BudgetSlider.tsx`, `Settings.tsx`, `src/styles.css`, `src/fixtures/wpui.test.tsx`, plus the v1.2 bullet in `STATUS.md`);
     - the new files (`src/components/BudgetPopover.tsx`, `InfoDot.tsx`, `Roll.tsx`, `src/useDismiss.ts`).
   - The worker runs `npm run check:fast`. You run `npm run verify` (browser tests) before merging.
2. **#199:** the on-stage strings.
3. **#200:**
   - Write `docs/QA-PACK.md`. Leave the model-choice section with both outcomes written out; you fill it in after the wave 2 comparison.
   - Update the 5-minute script in `docs/PRESENTATION-READINESS.md`:
     - "decision model" wording;
     - UC3 at the new price;
     - the model-choice beat.
   - Settle the trust score's reader-facing name (#165), and record it on #165.

**PR 2: Decision-path hardening** (branch `decision-hardening`). Work in this order:
1. **#197:** no fallback; a failed round buys nothing.
2. **#195:** account-lookup retry, quota fast-fail, 5 s timeout.
3. **#196:** `make preflight`.
4. **#204, first half:** neutral tie-breaks in fusion and in policy.

Use `Closes #197 #195 #196` and `Part of #204`.

**PR 3: Corpus** (branch `corpus-golden-uc3-uc4`). Merge it after PR 2.
1. **#198:** fix the UC1 and UC2 contradictions, and add the golden-fact check.
2. **#204, second half:** the UC3 price (The Fab Floor's Penang article to S$0.40) plus the UC3 tests, including the "equal scores still buy AlphaLeak first" case.
3. **#211:** the UC4 story-bible entry and articles. Write them by hand; no live generation.

Keep the free/paid leak gate green. List every article whose first 1,500 body characters changed; you re-embed those as a live step. Use `Closes #198 #204` and `Part of #211`.

**PR 4: Measurement** (branch `measurement`).
1. **#203:** the question bank on the real corpus, the export of per-purchase labels, and the offline eval command.
2. **#212, harness only:** port only the harness code from the decisions benchmark branch (linked in NEXT-STEPS §6) into `eval/decisions/` (no outputs or caches), and point it at the real corpus.
3. **#213, harness only:** requirement-level labels, plus the two coverage arms (the writer grades itself; the decision model grades each fact).

No live runs. Use `Closes #203` and `Part of #212 #213`.

**Wave 1 exit:**
- PRs 1–4 merged and `main` green.
- Re-embed the articles PR 3 listed.
- Run `make preflight` and a live `make smoke` (UC1–UC3) on `main`.
- Update STATUS.md and the checkboxes on #202.

### Wave 2: the decision-model switch

**PR 5: Decision-model switch** (branch `decision-model-switch`). Starts after PRs 2 and 3.
1. **#214:**
   - the new decision provider and its "batch-evidence" request shape;
   - honest provider labels everywhere;
   - an empty gap means no model call;
   - a refusal means a failed round;
   - pinned option order;
   - a preflight check for the new provider;
   - the D9 amendment in `FINAL-PUSH.md` and `AGENTS.md`.

   The default provider does not change in this PR.
2. **#205:** the trust check compares the writer's signed relevance with the same measure on the delivered article. Keep it out of `loop.ts` if you can.
3. **#206:**
   - retry a failed call once before failing the round;
   - one abort per round;
   - calibration runs alongside the re-answer and is awaited before the next decision;
   - skip empty-gap rounds after round 1.

Use `Closes #214 #205 #206`.

**Wave 2 exit (coordinator):**
1. Run the live comparison as #214 specifies: at least 5 runs each of UC1–UC3 plus 5 new questions, per provider, within the budget.
2. Choose the demo provider by #214's rule, and set it in the demo `.env`. Never commit `.env`.
3. Fill in the model-choice section of `docs/QA-PACK.md`. It may ride in PR 6, or go in a docs-only PR if PR 6 won't land before the stage cut.
4. Record the results on #214 and in STATUS.md.

### The stage cut (§4)

It runs whenever Saturday 08:30 SGT arrives, whichever wave is in progress.

### Wave 3: requested facts and free re-search

**PR 6: Requested facts and free re-search** (branch `requested-facts`). Starts after PR 5.
1. **#208:**
   - Freeze the requested facts at scope or run start, from the question plus the clarify answers.
   - Send the clarify angle into search.
   - Validate coverage against the citations.
   - Show the "Requested facts · N of M supported" checklist.
   - The decision model judges the frozen fact text.

   If #213's result is ready, use it to choose who grades coverage. If not, ship the writer's own grading and leave the choice switchable.
2. **#209:** try the next unresolved fact within the 3-round cap, and record an explicit stop reason.
3. **#210:**
   - one focused free follow-up search per run, before buying;
   - exclude already-read articles on the client;
   - re-answer only when a new free passage addresses the missing fact;
   - add the follow-up event and its RunTape row.
4. **#211's UC4 scenario test.**

Use `Closes #208 #209 #210 #211`.

**Wave 3 exit:** a live smoke on UC1–UC4, then STATUS.md.

### Wave 4: calibration and research write-ups

**PR 7** (branch `calibration`). Starts after PRs 4 and 6.
1. **#207:**
   - fit versioned calibrators on #203's data;
   - keep the rewrite guard on raw originality;
   - record both raw and calibrated scores;
   - re-tune the threshold and lock it with the UC regression.
2. **#212's report**, from your live runs within the budget. Skip any part that needs the open quota decision, and say so.
3. **#213's report.**

Use `Closes #207 #212 #213`.

## 6. Worker brief

Give each worker:
- the bundle name and branch;
- the worktree path;
- the issue numbers, to be read in full, in the order given in §5;
- the combined write scope;
- what it must not touch: other bundles' files and the main checkout;
- the rules in §3, plus §3a for any bundle that touches `src/`.

**Done means:**
- every acceptance item in every issue of the bundle is met;
- `npm run check:fast` is green;
- no live calls were made;
- the worker ran ship-pr steps 1–3 (rebase, check, push and open the PR);
- the PR body lists each issue, the behaviour changes, the tests changed and why, any loosened checks, and any article that needs re-embedding.

The worker then stops and reports the PR link. **The coordinator merges**, so the order in §5 holds: ship-pr steps 5–8, never step 4.

## 7. Coordinator loop

1. Keep at most 3 workers running. Start the next bundle as soon as its dependencies have merged and a slot is free.
2. When a worker reports:
   - check the PR against its issues' acceptance criteria and write scope;
   - merge in order;
   - make sure the next bundle rebases.
3. After every merge:
   - CI on `main` must be green;
   - add one STATUS.md line (direct commits to `main` are allowed for STATUS.md);
   - tick the box on #202.
4. Run the live steps at each wave exit (§4, §5), within the budget.
5. If something is stuck, follow §3. The other bundles keep moving.

## 8. Finish

Report to the owner:
- the merged PRs, with links;
- the behaviour changes;
- the live comparison result and the provider in use;
- the stage cut decision;
- live spend;
- anything blocked, and the open quota question.

Then stop. The owner runs the review.
