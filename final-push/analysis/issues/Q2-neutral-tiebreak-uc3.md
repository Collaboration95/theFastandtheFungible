**Why:** two problems.

**1. Ties sort alphabetically, and `alphaleak-*` comes first.**
- Ties break on `articleId` in fusion (`server/agents/research.ts:45`, asserted at `tests/retrieval.test.ts:80`) and in policy (`server/agents/decision.ts:125`).
- In UC3, this lets Kopi (relevance 0.06) and an off-topic AlphaLeak post take paid slots, while NotFT's Penang article (0.61) is cut.
- A "neutral search engine" should not favour one seller's slug.
- Breaking ties on *claimed* relevance would reward inflation instead (AlphaLeak claims 0.96).

**2. UC3's refund scene only works because Clef-flash is fooled.**
- AlphaLeak (S$0.30) and The Fab Floor (S$0.25) make equal public promises for the UC3 gap.
- A calibrated or stronger judge therefore picks The Fab Floor on value per dollar, and no refund happens. In the decisions benchmark, calibrated Luna and the policy oracle both picked Fab Floor.
- Flash picks AlphaLeak only because it is fooled: raw addresses-gap 0.457 vs 0.193.
- So any Q3/Q5 or threshold change can silently delete the scene.

**Decided (owner, 8 Oct):** The Fab Floor's Penang lead-time article (`fab-floor-kestrel-penang-lead-times`) becomes a S$0.40 "data deep-dive".
- Writers set prices per article, so only that one manifest is re-signed.
- AlphaLeak stays at S$0.30, and wins UC3 round 1 on an inflated promise *and* a lower price, as FINAL-PUSH §11 UC3 describes.
- Update the roster note in FINAL-PUSH §10, which says "stays fixed", and the story bible accordingly.

**Write scope:**
- `server/agents/research.ts` (`fuse`) and `server/agents/decision.ts` (selection sort)
- the one corpus article and its manifest
- `tests/retrieval.test.ts`, `tests/decision-uc.test.ts`, `tests/scenarios`

**Do:**
- Break ties on a hash of (query + articleId + version), which is deterministic and neutral, in `fuse()` and in `decide()`.
- Apply the price change, and update FINAL-PUSH §10 and the story bible.
- Extend the UC regression to check UC3 under three judges:
  - raw Flash-like scores;
  - a "perfect judge" fixture that gives AlphaLeak and Fab Floor equal public scores;
  - calibrated scores.
- Fix the benchmark regression fixture: UC3-recovery currently keeps AlphaLeak's wallet active, but production quarantines the wallet (D21).

**Acceptance:**
- The UC2/UC3 scenario tests pass.
- A new test shows UC3 round 1 still buys AlphaLeak when both candidates score equally.
- UC3 round 2 still buys The Fab Floor.

**Priority:** required before or together with the Luna switch (M1). A rational judge such as Luna buys The Fab Floor in UC3 round 1 today, so without this change the refund scene disappears.

**Depends on:** nothing blocking. Use Q1 to measure before and after once it exists.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>`.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
