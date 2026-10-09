**Why:** AI Tinkerers rules out decks (`docs/PRESENTATION-READINESS.md` "Event logistics"). The talk leads with decision models and calibration, so Q&A will probe it. This issue produces one page of numbers to answer from, plus one screen to open only on request.

All benchmark numbers come from the decisions benchmark on [`bench/decisions-vs-clef`](https://github.com/Collaboration95/theFastandtheFungible/tree/bench/decisions-vs-clef/bench/decisions). It is SYNTHETIC: 160 scenarios, 28 held-out topic families. Label it that way every time.

**Content:**

**Calibration, the thesis.**
- The production model at the time, Clef-flash: its raw "addresses the gap" score ranks well: held-out AUROC 0.82.
- Its probabilities are flat in the middle: predictions of 0.27–0.50 come true 24–31% of the time (`out/reliability.md`).
- Held-out purchase F1: production configuration 0.505, calibrated package 0.783 [0.643, 0.898]. Four-question Brier: 0.186 → 0.075.
- Why we did not ship the calibrator: it was fitted on synthetic data, and it would buy the MarketPulse rewrite in UC2.

**The model choice (after M1's live comparison).**
- We benchmarked two decision models under a preregistered rule.
- OpenAI Decisions (`gpt-6-luna`) beat Clef-flash on held-out data:
  - F1 0.983 vs 0.783, Brier 0.015 vs 0.075;
  - raw and uncalibrated it still scores 0.915;
  - it is more injection-resistant;
  - one request per round instead of 1 + N, at about the same cost.
- The one criterion it failed was our own demo story. UC3 needed a judge that gets fooled. We fixed the story (Q2), not the judge, and switched (M1).
- The whole study cost US$0.96.
- If the live comparison does not hold, the slot uses Clef-flash, and this beat becomes "the challenger that won on F1 and failed our regression gate".

**Injection, the known weak spot.**
- Writer-authored title, abstract, tags and the writer's claimed relevance all reach the decision model's state (`server/agents/clef.ts:47-50`). So does the LLM-written gap.
- Measured attack lift: Clef-flash mean +0.025, max +0.246 (48 of 84 attack pairs scored higher than their clean twin); Luna mean −0.014, max +0.021.
- **What bounds the loss:**
  - the S$1 per-source cap;
  - the per-prompt budget;
  - 3 rounds;
  - after the fact, proofs, `/challenge`, refunds and trust.
- **The structural fix is planned:** the decision model will judge the frozen requirement, not gap text that sources can influence (E1, #194).

**How agents built it.** Two anecdotes, both in STATUS.md and OVERNIGHT-REPORT-OCT8:
- Relevance was normalised to the top hit, so every writer claimed 1.0 and UC3 bought the wrong source first.
- The leak gate caught the LLM reusing persona openers across free and paid posts.
- Add the US$0.96 preregistered benchmark that led to the model switch.

**An option for UC1:** show a completed real run from the sidebar instead of running it live. That removes one of four live failure points and frees about 30 s.

**Also in this issue (owner, 8 Oct):** update the 5-minute script in `docs/PRESENTATION-READINESS.md`:
- "decision model" wording instead of a named model;
- UC3 at the new price (#204);
- the model-choice beat (after #214's comparison);
- the UC1 live-or-pre-staged option.

Settle the trust score's reader-facing name (#165) and record it on #165.

**Write scope:** `docs/QA-PACK.md` (new), `docs/PRESENTATION-READINESS.md` and `talk/` notes.

**Depends on:** M1's live comparison, for the model-choice section.

**Acceptance:**
- Every number cites a file on `bench/decisions-vs-clef` or a STATUS line.
- Every benchmark number is labelled SYNTHETIC.
- No claim that a model is "calibrated" without saying what calibration buys.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first. This is a docs-only change. Ship with the `ship-pr` skill.
