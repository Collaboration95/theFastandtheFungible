Part of #194. Ship together with E4 (a corpus case that shows the payoff) and after R2.

**Why:** retrieval runs once, before the loop. A missing fact can change which paid article gets bought, but it never causes a second search. An article the first query missed stays undiscovered, even when it is free.

**Do:**
- **When to search:** run at most **one** follow-up federated search per run, when coverage has a `missing` or `partial` requirement.
  - Run it before round 1, and before the budget guard (`server/agents/loop.ts:183`), so an S$0 run still researches free sources.
  - Use the answer's `followUp.query`: at most 300 characters, sanitised like gaps. When it is invalid, fall back to the requirement text plus question keywords, and label the fallback.
- **Exclusions, client-side, with no publisher change:**
  - Ask each publisher for `k = min(10, 5 + its exclusions)` and drop already-read or already-acquired versions.
  - At our scale (at most 8 free reads and 3 buys per run) this matches pre-filtering. Signed manifests are unaffected.
  - Keep exclusion lists per publisher, so one seller never learns what was read from its competitors.
  - A publisher `nin` filter on an exact enum key is only needed if more than 5 exclusions per publisher become common.
- **Register new candidates before `addContent`** (`server/store.ts:167-170`). Never mutate existing candidates: calibration reads `candidate.manifest`.
- **Active pool for judging:** the original top 8 plus at most 4 focused paid hits, never all 16. Today `decide()` is handed all of `run.candidates` (`loop.ts:191`).
- **Read the new free hits.** Re-answer **only** when a new free passage addresses the requirement, and keep the new answer only if coverage improves.
  - This protects UC2's answer versions [1, 2] and the LLM call counts in the scenario tests.
  - It also avoids a wasted DeepSeek call of about 5 s.
- **Persistence and labelling:**
  - Persist the attempt before dispatch, so a resume never repeats it.
  - Add a `FOLLOW_UP` event and RunTape row. Reusing `SEARCH` would overwrite the first search row.
  - If the follow-up fell back to keyword search, the run's search label must switch to keyword (gate 5).
- **Gate 1:** generate the query only from the free-only v1 answer, never after a grant.

**Write scope:**
- `server/agents/{research,loop}.ts`, `server/publisher-client.ts`
- `src/components/RunTape.tsx`, `src/stage.ts`
- `tests/retrieval.test.ts`, `tests/decision-loop.test.ts`, `tests/scenarios`
- regenerated `src/fixtures/uc/*.json`

**Acceptance:**
- An unread hit #6 surfaces when hits #1–5 were already read.
- Exactly one attempt per run, including across a restart.
- Stop, S$0 and a down publisher are handled without breaking bounds.
- UC2/UC3 picks are unchanged.
- The E4 case shows "found free; nothing bought".

**Latency budget:** about +1–4 s with the gated re-answer. Measure it on UC2.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
