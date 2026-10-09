**Re-scope after code verification (8 Oct, late).** This is a comment on #194, not a new issue.

Both research comments were checked against HEAD `77e01d8`, and about 35 cited ranges are accurate. Several findings change the plan.

**Corrections to the plan:**
1. **Requirements can't come from the server planner.** The UI always sends its own plan, so the server never plans (`server/routes.ts:127`). Freeze requirements in `/api/scope` or at run start, from the question plus the clarify answers, *before any evidence*. The clarify angle should feed both the sub-queries and the requirements; today it never reaches search.
2. **New answer fields would be silently stripped.** `AnswerSchema` is non-strict, so `coverage` and `followUp` disappear (`research.ts:222`, `loop.ts:101`, the store and the UI parse) unless the schemas change.
3. **Candidates can't be replaced.** `Store.updateRun` throws on a removed or duplicate candidate. Also, `decide()` receives all of `run.candidates`, so a merged follow-up would judge 16 paid hits with 17 Clef calls. Pass an explicit active pool: the original top 8 plus at most 4 focused hits.
4. **Exclusions need no publisher change.** Over-fetching `k = min(10, 5 + exclusions)` per publisher and dropping read versions in the client matches pre-filtering at our scale. The Orama `nin` enum filter can wait.
5. **"Skip Clef when everything is supported" would remove UC1's "Clef finds no gap" beat** (D16). Skip only the empty-gap rounds *after* round 1.
6. **There is no demo case for the follow-up's payoff.** 19 of 81 articles are free, and none closes UC2's or UC3's gap. In a simulated follow-up, UC2's 7 new free hits all have relevance ≤0.05. That needs a UC4 corpus case.
7. **Re-answer only when a new free passage addresses the requirement.** Otherwise UC2 makes a wasted DeepSeek call of about 5 s, and the scenario-test call counts break.
8. **Let Clef judge the frozen requirement text, not the LLM-written gap.** This closes the known weak spot where source text steers which article is bought.

**Split:**
- **E1** Requested facts frozen before evidence, a coverage checklist, and Clef judging the requirement.
- **E2** Try the next unresolved requirement within the 3-round cap, and record an explicit stop reason.
- **E3** One focused free follow-up search before buying. Ship it with E4, after R2.
- **E4** A UC4 story in which a focused free search finds the missing fact.
- **R2** Coverage judge: writer self-assessment vs Clef per requirement (comment 2's experiment).

**Order:** E1 follows the decision-model switch (M1), because E1 changes the decision model's gap input. E4's corpus work can start now.
