Part of #194. Ships with E3, but the corpus work can start now in parallel.

**Why:** the current corpus cannot show the payoff of a focused free search.
- 19 of 81 articles are FREE, and no free passage can close UC2's gap (analysts' pricing and margins) or UC3's (lead times in weeks).
- A simulated follow-up search with the real index, fusion and planner bore this out:
  - UC2: 7 new free hits, all with relevance ≤0.05.
  - UC3: 5 new free hits, the best at 0.40, none closing the gap.
- So "never pay for what you can read free" has no live proof beyond UC1.

**Do:** add a UC4 to the story bible and the corpus:
- **The question:** asks for 3 facts. The initial search's free reads cover 2.
- **A free article covers the third.**
  - It must rank below the initial cut-off for the original sub-queries, or be phrased differently from them.
  - It must surface for a focused query on the missing fact. BM25 searches the full body, while embeddings cover only the first 1,500 characters.
- **A paid article also promises the third fact.**
- **Expected outcome:** "3 of 3 · found free on a focused search · nothing bought". The paid article appears as a "would have bought" row.
- **Build it with the existing pipeline:** content via the corpus generator (D19), then `check-corpus`, the leak gate, `make embeddings` and the golden facts (H4).

**Write scope:**
- `data/corpus/v2/**`
- `scripts/check-corpus.mjs` (golden facts)
- `tests/scenarios` (a UC4 scenario)
- `docs/PRESENTATION-READINESS.md` (optional demo slot)

**Acceptance:**
- A fixture-mode UC4 scenario test passes with E3.
- One live run shows the follow-up finding the free article.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Corpus generation is a live batch job: never run it on the demo account's daily quota on a rehearsal or demo day.
- Ship with the `ship-pr` skill.
