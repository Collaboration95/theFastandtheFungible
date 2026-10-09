**Why:** a decision round today has four robustness and latency problems. All were verified at HEAD.

- **One failure substitutes the whole round.** If any of the 1+N parallel Clef calls fails, the fixture re-scores the entire round (`server/agents/decision.ts:97-101`). With 9 parallel calls, a whole-round failure is about 9 times as likely as a single-call failure. H3 stops the buying, but the round is still lost.
- **Failed siblings keep running.** `Promise.all` does not cancel the other calls after the first failure (`decision.ts:92-95`), which wastes quota.
- **Calibration blocks the re-answer.** The calibration Clef call is awaited before the re-answer (`server/agents/loop.ts:212-216`). That costs about 0.8 s at p50 per verified purchase, and up to about 6 s on a timeout plus retry.
- **Empty-gap rounds still call Clef.** When the gap is empty, the round still makes 9 Clef calls before the deterministic `SKIP_NO_GAP` (`decision.ts:119`).

**Do:**
- **Per-candidate handling:** retry a failed `judgeCandidate` once, then mark that candidate "not scored" (a labelled SKIP) instead of substituting the round. Fall back to the fixture only when `judgeRound` itself fails.
- **One `AbortController` per round:** abort the siblings when the round is abandoned.
- **Parallel calibration:** run the calibration call alongside the re-answer, and await it before the next `decide()` so trust ordering holds. Make the reputation update idempotent per intent.
- **Skip empty-gap rounds after round 1.** Keep round 1, because UC1's story is "Clef finds no gap" (`tests/scenarios/scenarios.test.ts` checks that table).

**Write scope:**
- `server/agents/decision.ts`, `server/agents/loop.ts`, `server/reputation.ts`
- `tests/decision.test.ts`, `tests/decision-loop.test.ts`, `tests/reputation.test.ts`

**Acceptance:**
- Tests for one failed candidate, aborting the siblings, and calibration finishing before the next round.
- UC scenario tests unchanged.
- Live UC2 latency recorded before and after.

**Note after the Luna switch (M1):** with one batched request per round, per-candidate retry applies to the Clef path. The parallel calibration and the empty-gap skip apply to both providers.

**Depends on:** H1, H3 and M1.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>`.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
