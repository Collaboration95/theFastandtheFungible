Part of #194. Build after E1.

**Why:** the loop judges only `answer.openGaps[0]` (`server/agents/loop.ts:185`), and if nothing qualifies it `break`s (`:196`). The second and third gaps are never tried. The run then ends with the generic label "Stopped: no eligible purchase, exhausted budget, or three-round limit" (`:218`), so the reader can't tell an answered question from one that was given up on.

**Do:**
- **Move on to the next requirement.** When the current requirement has no eligible purchase, choose the next unresolved one not yet attempted.
  - Key attempts by requirement plus an evidence fingerprint, so a renamed gap can't loop.
  - Stay within the existing 3-round cap and the existing budget; policy is unchanged.
- **Record a `stopReason`** in the checkpoint:
  - `complete`
  - `no eligible purchase for the remaining facts`
  - `budget exhausted`
  - `round limit`
  - `decision model unavailable` (H3)
  - `stopped by user`
- **Show it.** The UI and the report put the reason next to the requested-facts checklist.

**Write scope:**
- `server/agents/loop.ts`
- `shared/contracts/run.ts` (a checkpoint field)
- `src/components/Answer.tsx`, `src/components/RunTape.tsx`
- `tests/decision-loop.test.ts`

**Acceptance:**
- A loop test where requirement 1 has no candidate and requirement 2 has one: the agent buys for requirement 2 within the cap.
- Each stop reason is covered by a test.
- UC scenario picks are unchanged.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
