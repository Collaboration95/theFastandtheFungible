# Next steps: plan of record

**Last updated:** 9 Oct 2026, 07:15 SGT (run complete; see §0).

**Read this first** if you are picking up the work. It replaces every earlier draft of this file.
- The work itself is specified in GitHub issues #195–#214. The master list is #202.
- How to run it (waves, PR bundles, rules) is in [prompt.md](prompt.md) in this folder.
- The repo's root `prompt.md` §2 still holds the five hard gates.

**Revert point:** the tag `known-good-2026-10-08` (`cb04be4`, CI green).

---

## 0. Outcome of the run (9 Oct, 07:15 SGT)

The plan below has been executed. Read this section first; the rest is the plan as it was made.

### Merged to `main`

| PR | Contents |
|---|---|
| #215 | v1.2 UI, on-stage strings, Q&A pack, talk script |
| #216 | no decision fallback, Clef resilience, `make preflight` and the `CF_BACKUP=1` swap, neutral tie-breaks |
| #217 | golden-fact check, UC3 at S$0.40, UC4 content |
| #218 | real-corpus question bank and eval harness |
| #219 | OpenAI Decisions provider, trust check by delivered-body cosine, round robustness |
| #220 | switchable decision wordings; the plain gap question is the default |
| #221 | requested facts frozen before evidence, decision-model coverage, next-fact rounds, one free re-search, UC4 |
| #222 | calibration layer (OFF), production-path harness, reports |

STATUS.md on `main` has the detail.

### Live results
- **The decision model switched to OpenAI Decisions** (`DECISION_PROVIDER=openai` in `.env`; `cloudflare` reverts). In the live comparison, Clef-flash held the UC3 story 0/2 and the new provider 3/3. The main fix was the plain gap question ("The open gap is part of what the question asks."), not the model. Results are on #214.
- **Final live smoke** on `main` `4e3a2a5`: UC1–UC4 passed at the first attempt (UC2 25.6 s, UC3 33.7 s, UC4 11.6 s with S$0).
- **Coverage judge (#213):** the decision model scored 0.938 against 0.760 for the writer grading itself, so the decision model grades requested facts.
- **Real-corpus eval** over the 48-question bank (`eval/REPORT-decisions.md`): at raw threshold 0.20 the agent rarely buys wrong but rarely buys at all. Only 1 of 19 paid-needed questions got a purchase, because the paid abstracts tease the figure rather than state it.
  - **Calibration:** a calibrator is committed but kept OFF. It lifts F1 from 0.41 to 0.71, but waste rises from S$1.20 to S$4.15, most of the gain is the threshold, and it was fitted on 21 positives.
- **Live spend for the whole run:** about US$1.5.

### What is left

| Item | Owner and status |
|---|---|
| Stage cut, Sat 10 Oct by 08:30 SGT | On the latest `main`: reset reputation, `make preflight`, `make smoke`. Pass → tag `demo-oct10`; fail → present `known-good-2026-10-08`. Before 08:00 SGT the primary Cloudflare allowance may be exhausted; use `CF_BACKUP=1`. |
| #201 | Owner checklist: rehearse twice, decide whether UC1 is shown pre-staged, upgrade Cloudflare to US$5/month later. |
| #212 | Open: full Clef 27B on held-out data, and latency under production load. Both need a paid Cloudflare plan. |
| Next product step | Paid abstracts that state what they contain, so paid-needed questions get bought. Then refit the calibration on more labelled data. |
| Housekeeping | The owner's main checkout is still on the old `v1.2-tweaks` branch with the now-merged v1.2 UI changes uncommitted. Switch it to `main`. |

---

## 1. Decisions already made (owner, 8 Oct)

| # | Decision | What it means | Issue |
|---|---|---|---|
| 1 | **Switch the purchase-decision model to OpenAI Decisions (`gpt-6-luna`).** | Clef-flash stays selectable as the revert. D9 in `FINAL-PUSH.md` is amended from "Clef judges value" to "a decision model judges value". | #214 |
| 2 | **No decision fallback.** | If the live decision model fails (timeout, error, refusal), the round fails: nothing is bought, the free answer stays, and the run says why. Offline fixture mode is unchanged. | #197 |
| 3 | **UC3 price.** | The Fab Floor's Penang lead-time article becomes a S$0.40 "data deep-dive"; AlphaLeak stays at S$0.30. AlphaLeak then wins round 1 on price as well, so the refund scene survives a judge that can't be fooled. | #204 |
| 4 | **Trust check after a purchase.** | Compare the relevance score the writer *signed* with the same measure taken on the *delivered* article (the same embedding cosine, computed after the grant). A delivery whose proof failed records `observed = 0`. Honest writers keep their score; inflated claims lose it. | #205 |
| 5 | **One queue, no dates.** | Work is ordered by dependency and file conflicts only. #194 and its sub-issues are un-deferred. | #202 |
| 6 | **Saturday's stage build.** | Early Saturday, run preflight and a live smoke test on the latest `main`. If both pass, tag it `demo-oct10` and present it; otherwise present `known-good-2026-10-08`. Work on `main` continues either way. | #201 |
| 7 | **The v1.2 UI work** (budget popover, info dot, preset rows), uncommitted in the main checkout. | Ships first, inside PR 1, after the full verify passes. | prompt.md |
| 8 | **How the work runs.** | Each PR bundles three or more issues; at most 3 PRs run at once. PRs merge automatically when CI is green. No review agent runs; the owner reviews after everything merges. Only one coordinator makes live API calls, under a spend cap. | prompt.md |
| 9 | **Cloudflare daily allowance.** | Cloudflare converts each search query into numbers for the meaning match, converts delivered articles for the trust check (#205), re-indexes changed articles, and hosts the backup decision model. For now the demo stays on the free plan, with the friend's separate account (`CLOUDFLARE_API_TOKEN_2`) as the backup. If the allowance runs out (HTTP 429, code 4006), swap to the backup pair (#196). The upgrade to the US$5/month plan comes later. Never run batch jobs (benchmarks, `make embeddings` sweeps, `make corpus`) on rehearsal or demo days. | #196, #201 |
| 10 | **UI rules for every new on-stage state.** | One short line at the top level, with detail on demand (expander, tooltip, Show work). No taglines, no mechanism explanations, no code words, and no provider chips in the header. Taken from `docs/ui-critique-oct7.md` and the owner's direction. | prompt.md §3a |
| 11 | **Talk script.** | `docs/PRESENTATION-READINESS.md` is rewritten for the model switch and the UC3 price, and the trust score's reader-facing name (#165) is settled there. | #200 |
| 12 | **Not now.** | Cloud Run deployment (sponsor credits) is skipped for now. #108, #163, #164 and #166 stay deferred. The final presentation is planned after Saturday. | — |

## 2. Still open

Nothing in the plan itself. The remaining planning items are listed on #201.

---

## 3. Background a new agent needs

### How buying works at `cb04be4`

1. **Plan:** the UI always sends its own plan (1–3 sub-queries), so the server planner never runs (`server/routes.ts:127`).
2. **Search:** one federated search across the writers' indexes; reads up to 8 free articles; keeps up to 8 paid candidates.
3. **Answer:** the research LLM writes cited claims plus up to 3 free-text `openGaps`. "Enough evidence" simply means it returned no gaps.
4. **Decide:** the loop judges only `openGaps[0]`, only against the candidates from the first search, for up to 3 rounds. The decision model scores each candidate:

   ```
   value = gap_material × addresses_gap × P(original) × (0.5 + 0.25 × credibility) × trust
   ```

   Policy code buys the eligible candidate with the best value per dollar, within the budget and the S$1 per-source cap.
5. **After a purchase:** the proof is checked (a failed proof leads to `/challenge`, a refund and a trust loss), the article is re-scored for calibration, and the answer is rewritten.
6. **What citation checks prove:** that the quoted text exists exactly, not that it supports the claim.

### The decision-model benchmark (8 Oct)

The full study is on the [`bench/decisions-vs-clef`](https://github.com/Collaboration95/theFastandtheFungible/tree/bench/decisions-vs-clef/bench/decisions) branch. The data is **synthetic**: 160 scenarios, with 64 held out × 3 repeats in 28 topic families.

| Held out | Purchase F1 | 4-question Brier (lower is better) |
|---|---|---|
| Clef-flash as production runs it (raw scores, threshold 0.15) | 0.505 | 0.186 |
| Clef-flash, tuned and calibrated | 0.782 | 0.074 |
| **Luna, "batch-evidence" wording, raw scores, threshold 0.20** | **0.915** | **0.031** |
| Luna, tuned and calibrated | 0.983 | 0.014 |
| Word-overlap fixture | 0.667 | 0.159 |

**Other findings:**
- **Injection lift** (mean / max): Luna −0.014 / +0.021; Clef-flash +0.025 / +0.246.
- **Requests per round:** Luna sends one batched request; Clef-flash sends 1 + N.
- **Cost:** about the same, US$0.48 vs 0.44 per 1,000 rounds.
- **Clef-flash under-buys** (recall 0.37). Its raw scores rank candidates well (AUROC 0.82), but they are not probabilities: predictions of 0.27–0.50 come true only 24–31% of the time.

**What follows for the build:**
- **Thresholds:** never apply the benchmark's calibrated thresholds (0.38 for Clef-flash, 0.05 for Luna) to raw scores. Luna runs raw at 0.20.
- **No synthetic calibrators.** Fitted on templated data, they buy nothing in UC2 and they let the MarketPulse rewrite through, by lifting its P(original) from 0.26 to 0.99. Calibration must be fitted on in-domain data, last (#207).
- **Use the batch-evidence wording.** With today's production wording, Luna refused often enough that 11 of 64 rounds failed.
- **Empty gap means no model call.** On an empty gap, Luna refused or scored it 0.87.
- **Refusals:** a refusal fails the round (decision 2).
- **Option order:** pin it. Luna's answers shifted by up to 0.94 when the order of options changed.
- **The UC3 story was fragile.** AlphaLeak and The Fab Floor made equal promises and AlphaLeak cost more, so only a judge that could be fooled bought AlphaLeak. Decision 3 fixes that.
- **Validity limits:**
  - An OpenAI model generated the data.
  - The labels are correct by construction.
  - 119 preview/body overlaps make the task easier than the real corpus.
  - The 30 gold items are unreviewed.

  Hence #214's live comparison on the real corpus, and #212.

### Evidence sufficiency (#194)

- **Freeze the requested facts before any evidence is read**, at scope or run start, from the question plus the clarify answers. Never derive them after a purchase (gate 1).
  - The decision model then judges the frozen fact text instead of LLM-written gap text, which closes the hole where an article steers which source gets bought.
- **`AnswerSchema` is non-strict.** New fields such as `coverage` are silently stripped until the schemas change.
- **Excluding already-read articles needs no publisher change.** Ask each publisher for `k = min(10, 5 + exclusions)` hits and drop the read ones in the client.
- **No current article lets a focused free search pay off.** 19 of 81 articles are free, and none closes UC2's or UC3's gap. #211 adds a UC4 case.
- **The UC2 trap:** the free filing gives *company* margin guidance. The requested fact must say "analyst" estimates, or it will be marked supported by mistake.
- **Re-answer only when a new free passage addresses the missing fact.** Otherwise it wastes about 5 s and breaks the scenario-test call counts.

### Verified problems and the issue that fixes each

| Problem (at `cb04be4`) | Where | Issue |
|---|---|---|
| A failed decision-provider account lookup is cached forever; `CLOUDFLARE_ACCOUNT_ID` is unset | `server/agents/clef.ts:98`, `server/routes.ts:43` | #195 |
| One failed decision call makes the whole round fall back to the fixture, which still buys (bought the Kopi decoy live on 7 Oct) | `server/agents/decision.ts:97-101`, `server/agents/loop.ts:191-203` | #197 |
| A 429 sleeps up to 60 s even on a daily-quota error; the 3 s timeout is too tight for 9 parallel calls | `clef.ts:73-89`, `clef.ts:83` | #195 |
| UC1's free sources contradict each other (10-year JGB at 0.85% vs 2.14%; rate held vs raised), and a live run wrote "sources disagree" | `or-boj-statement-2026-09-18`, `or-jgb-yield-table-2026-09` | #198 |
| UC2's paid article says "two tranches"; the free filing says "three installments" | `notft-kestrel-tsmc-deal-margins`, `or-kestrel-tsmc-filing-2026-09-29` | #198 |
| The PDF says "SIMULATED SGD" on Testnet runs; "55.2%" renders as "55. 2%"; live runs show "Replaying" | `server/report-template.ts:34`, `src/components/Answer.tsx:65`, `src/components/RunTape.tsx:89` | #199 |
| Score ties sort alphabetically, so `alphaleak-*` comes first | `server/agents/research.ts:45`, `decision.ts:125` | #204 |
| The clarify answer never reaches search | `src/App.tsx` plan send, `server/routes.ts:127` | #208 |
| The trust check compares the search cosine with the decision model's gap score, so honest writers lose trust (Fab Floor 1.00 → 0.76 live) | `server/reputation.ts:83-88` | #205 |
| Only the first gap is ever tried | `loop.ts:185,196` | #209 |
| The calibration call blocks the re-answer, and failed sibling calls are never cancelled | `loop.ts:212-216`, `decision.ts:92-95` | #206 |
| No check before going on stage (reputation left over from a rehearsal, quota, real timeout) | `scripts/doctor.mjs` | #196 |

---

## 4. The work: 7 PRs in 4 waves

Full instructions are in [prompt.md](prompt.md).

| PR | Bundles | Wave | Starts after |
|---|---|---|---|
| 1 | Stage UI and Q&A: v1.2 UI work, #199, #200 | 1 | — (must merge by Fri 10:00 SGT) |
| 2 | Decision-path hardening: #197, #195, #196, plus #204's tie-breaks | 1 | — |
| 3 | Corpus: #198, plus #204's UC3 price and tests, plus #211's UC4 content | 1 | — (rebases after PR 2 if tests overlap) |
| 4 | Measurement: #203, plus the harnesses for #212 and #213 | 1 (when a slot frees) | — |
| 5 | Decision-model switch: #214, #205, #206 | 2 | PRs 2 and 3 |
| 6 | Requested facts and free re-search: #208, #209, #210 | 3 | PR 5, plus #213's result |
| 7 | Calibration and research write-ups: #207, plus the #212 and #213 reports | 4 | PRs 4 and 6 |

**Coordinator-only steps** run between waves: the live smoke tests, the #214 comparison, embeddings for changed articles, the stage cut, and STATUS.md.

**Merge order for shared files:**
- `server/agents/decision.ts`: PR 2 → PR 5 → PR 7
- `server/agents/loop.ts`: PR 2 → PR 5 → PR 6
- `data/corpus/v2/**`: PR 3 only
- `src/components/Answer.tsx`: PR 1 → PR 6

## 5. Do not

- Don't apply calibrated thresholds to raw scores, ship synthetic calibrators, or set `BUY_THRESHOLD` from the benchmark.
- Don't batch the Clef-flash path (measured worse), and don't add judgment caching (no evidence it would hit).
- Don't run batch jobs on the demo Cloudflare account. Workers never make live calls.
- Don't let a substituted or failed decision buy anything.
- Don't break a hard gate (root `prompt.md` §2):
  - no premium bytes before a grant;
  - the budget is the only authorization to spend;
  - one charge per intent;
  - real citations;
  - everything simulated or substituted is labelled.

## 6. Sources

- **Issues:** #194 (with the re-scope comments), #195–#214, and the master list #202.
- **Benchmark:** the [`bench/decisions-vs-clef`](https://github.com/Collaboration95/theFastandtheFungible/tree/bench/decisions-vs-clef/bench/decisions) branch (paper, data, `question-wordings.md`, the Luna adapter in `providers/openai-decisions.ts`). The gist `a8c957e8…` copies it, and its URL is public on that branch.
- **Codex thread extracts** in this folder: `01-…`, `02-…`, `02a-…`, `02b-…`, `03-…`. These are history only.
- **Issue drafts:** [issues/](issues/) and [issues/manifest.tsv](issues/manifest.tsv), which hold the bodies as filed.
