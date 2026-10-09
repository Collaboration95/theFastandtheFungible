**Decision (owner, 8 Oct):** a live decision round never substitutes the word-overlap fixture. If Clef fails, the round fails:
- nothing is bought;
- the free answer stands;
- the run says why.

Configured fixture mode (`make run` / `npm run demo`, no live provider) is unchanged. There the fixture *is* the provider, not a fallback.

**Why:** today, any single failure among the 1+N parallel Clef calls makes the whole round fall back, and the agent still buys.
- `decideRound` re-scores the entire round with the word-overlap fixture (`server/agents/decision.ts:97-101`).
- The loop then buys the fixture's pick without checking `fallbackReason` (`server/agents/loop.ts:191-203`).
- **It has happened live.** On 7 Oct, run `6185af46` bought the Kopi decoy, then The Fab Floor, on fixture rounds. Clef then recovered and bought NotFT, so UC2 spent S$1.25.
- Gate 5 held, because the round was labelled. But on stage it contradicts "a decision model chose".
- The fixture is also a weaker buyer: held-out purchase F1 0.667 vs Clef's tuned 0.783 (decisions benchmark, synthetic).

**Write scope:**
- `server/agents/decision.ts`, `server/agents/loop.ts`
- `tests/decision.test.ts`, `tests/decision-loop.test.ts`

No UI file change is expected. If one is needed, call it out in the PR (the v1.2 UI work is in flight).

**Do:**
- **`decision.ts`:** when a live `provider` is passed, do not catch and substitute.
  - Throw a typed `DecisionUnavailableError` carrying the Clef status (timeout, HTTP code, daily quota, invalid response).
  - Keep the zod validation of every answer.
- **`loop.ts`:** catch that error around `decide()`, and handle it explicitly rather than through `exclusive()`'s generic path.
  - Append an event.
  - Make no purchase.
  - End the run as FAILED, with the error "Decision model unavailable (<status>); nothing bought. The free answer stands." and `nextAction: 'ask'`.
  - Keep the answer, and keep the Stop and retry-delivery semantics unchanged.
- **Telemetry:** replace the `decision-fallback` score with `decision-unavailable`. Keep the `fully-live` run score correct.
- **Tests:** update the tests that asserted fixture substitution. Record this behaviour change in STATUS.md.
- **Related:** H1 makes these failures much rarer (account-lookup fix, 5 s timeout, quota fast-fail). Q4 later retries a single failed call before failing the round.

**Acceptance:**
- Loop test: a provider whose `judgeCandidate` rejects for one candidate gives zero intents and a FAILED run with the new error, and answer v1 is preserved.
- Fixture-mode UC scenario tests (`tests/scenarios`) are unchanged and still buy.
- A run with no decision rows and this error renders in the UI without a BUY stamp (checked in the existing UI test or by hand).

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- This must be a single-package fix (`server/agents`).
- Work in `../tftf-wt/<id>` and stay inside the write scope.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
