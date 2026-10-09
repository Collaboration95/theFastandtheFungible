Part of #194 (un-deferred 8 Oct). Build after the Luna switch (M1), since this changes the decision model's gap input.

**Why:** "enough evidence" today means only that DeepSeek returned `openGaps: []`.
- No step tracks the requested facts one by one.
- The free-text gap that the decision model judges is written by the LLM *after* it has read source text. Writer-authored sources can therefore steer which article gets bought (a known Q&A weak spot).
- Separately, the clarify angle never reaches search. The UI sends the plan from before clarify, and the server skips its planner (`server/routes.ts:127`).

**Design** (refines the two research comments on #194):
- **Requirements, frozen before any evidence is read.**
  - Up to 5, with stable IDs (`r1…`), derived from the question plus the clarify answers.
  - Create them in `/api/scope` (its plan is what the client sends) or at run start from `input.answers`.
  - Put the clarify angle into *both* the sub-queries and the requirements; that fixes the angle never reaching search.
  - Never re-extract after a purchase. Gate 1 forbids paid text flowing into requirements or queries.
- **Coverage from the answer call.**
  - The answer returns `coverage[]`, each entry `{requirementId, status: supported|partial|missing|conflicting, claimIds}`.
  - Validate coverage *after* citation validation:
    - a dropped claim downgrades `supported`;
    - a missing or malformed entry becomes `unknown`;
    - an empty gap list never clears a missing requirement.
  - `AnswerSchema` is non-strict, so new fields are silently stripped today; update it, and make `sanitizeGaps` keep `requirementId`.
- **The decision model's `gap` input becomes the open requirement's frozen text** (sanitised), not LLM gap text. Evidence only chooses *which* requirement is open.
  - This closes the gap-steering hole.
  - Re-check UC2/UC3 gap_material live with the chosen decision model (M1), since gap scores were sensitive to wording.
- **Fixture path:**
  - Requirements come from the `FIXTURE_GAP_RULES` cues plus one core requirement.
  - Status comes from the rules' `answered()` predicates.
  - Gap texts stay byte-identical, so the scenario tests hold.
- **UI and report:**
  - The answer card shows "Requested facts · 1 of 2 supported", with a status per fact.
  - The report PDF gets a coverage line.
  - "2 of 3 supported" is a display, never a sufficiency threshold.
- **Known risk:** UC2's free filing gives *company* gross-margin guidance of about 47–48%. Keep "analyst" in the requirement text so DeepSeek can't mark "analysts' pricing & margins" as supported from it.

**Write scope:**
- `shared/contracts/{answer,run}.ts`
- `server/agents/{scope,research,loop}.ts` and `server/routes.ts`
- `src/components/Answer.tsx` and the report template
- minimal `src/App.tsx` wiring; coordinate with the v1.2 UI work

**Acceptance:**
- Contract, research-agent, decision-uc and scenario tests pass.
- UC2 shows 1 of 2 → 2 of 2 after the purchase.
- UC1 shows all requirements supported with no purchase.
- A source-injected gap phrase no longer reaches the decision model.

**Depends on:** M1 (the decision-model switch) and Q2. Q5 must be fitted after this.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>`.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
