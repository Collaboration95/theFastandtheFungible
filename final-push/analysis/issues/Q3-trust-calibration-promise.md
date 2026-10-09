**Why:** the C in T = H × C (D6) should measure whether a writer kept its signed promise. FINAL-PUSH defines the inputs as `claimed = pick.relevance` and `observed = clef.rescore(gap, body)` (§5 pseudocode), and Brier as the mean of (claimed − observed)² (§7). In code these are two different quantities:

- **`claimed`** is the manifest's search relevance: the query–article cosine on the fixed `cosineRange` scale (`server/reputation.ts:88`).
- **`observed`** is Clef's answer to "the purchased passages address the open gap" (`server/agents/clef.ts:32`).

**What goes wrong:**
- **Honest writers lose C** whenever the agent buys them for a gap their article never promised to cover. Live, 7 Oct, run `6185af46`:
  - The Fab Floor: "relevance claimed 0.59, observed 0.11", so C went 1.00 → 0.76. It was bought by a fixture fallback round.
  - NotFT: C 0.97 → 0.91.
  - Kopi: C 1.00 → 0.50.
- **AlphaLeak keeps C = 1.00.** Calibration runs only on VERIFIED deliveries (`server/reputation.ts:83`). AlphaLeak's proof fails, so only H drops.
- After UC3, the Writers tab can therefore show the honest insider as *worse-calibrated than the liar*, and the talk leads with calibration.

**Decided (owner, 8 Oct): option A.** It interprets D6; record that in FINAL-PUSH §7.

- **A. Same scale as the promise (chosen).**
  - Keep `claimed` = the signed manifest relevance; D4 says "promises (relevance)".
  - Measure `observed` the same way: the cosine between the query and the *delivered* body, using the same embedding and `cosineRange`. That is computed after the grant, so gate 1 holds.
  - It is deterministic and needs no extra Clef call.
  - Honest writers stay near C = 1; AlphaLeak's inflated 0.96 is caught whenever its body is delivered.
- **B. Same judge (not chosen).**
  - `claimed` = Clef's pre-purchase addresses-gap score from the public abstract, which is already in the decision row.
  - `observed` = Clef's score on the body for the same gap.
  - This measures "did the abstract oversell the body for this need", but it charges the writer for Clef's own misjudgements.

**Failed proofs (default):** record `observed = 0` for a delivery whose proof failed. The signed promise was broken by definition, so no re-scoring of the body is needed. This also fixes AlphaLeak keeping C = 1.00. Re-score only bodies that arrived under a verified grant (§12.1).

**Write scope:**
- `server/reputation.ts`
- `server/agents/loop.ts` (pass the inputs)
- the publisher query embedder reused through the client, for option A
- `tests/reputation.test.ts`, `tests/calibration.test.ts`

**Acceptance:**
- A test where an honest writer is bought for an unrelated gap: C stays near 1.
- A test where an inflated claim delivers a less relevant body: C drops.
- The UC3 Writers tab shows AlphaLeak worse than The Fab Floor after the run.

**Depends on:** Q2. It changes which articles UC3 buys.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- No premium bytes may reach anything before a verified grant.
- Work in `../tftf-wt/<id>`.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
