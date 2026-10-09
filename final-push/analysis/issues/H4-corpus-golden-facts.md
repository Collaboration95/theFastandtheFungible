**Why:** golden-path sources contradict each other, and nothing checks for it.

**UC1: the two FREE Open Records sources disagree with each other.**
- `or-boj-statement-2026-09-18`:
  - says the board voted to raise the rate "from 0.75% to 1.00%" (body character 322);
  - says "The yield on the 10-year JGB rose by 3 basis points to 0.85%" (character 2796).
- `or-jgb-yield-table-2026-09`:
  - says the 10-year closed at "2.05% on 17 September 2026, 2.14% on 18 September 2026 (+9…" (character 105);
  - says "eight members voted to maintain the current target of 0.5%" (character 2353).
- **It shows live.** Run `c8360e25` (7 Oct) wrote the gap: "The cited sources disagree on the 10-year JGB yield level and the size of the 18 September move (3 bp to 0.85% vs 9 bp to 2.14%), and this is unresolved." Its gap_material was 0.83.
- That breaks UC1's beat, "free suffices, Clef finds no gap" (D16). The overnight smoke happened not to trigger it, so it is nondeterministic.

**UC2: the article we buy contradicts the free filing.**
- The free filing `or-kestrel-tsmc-filing-2026-09-29` says the prepayment comes "in three installments" (US$400m + 2 × US$350m).
- The paid `notft-kestrel-tsmc-deal-margins` says "payable in two tranches", and calls Kestrel "Hsinchu-based"; check the story bible for Kestrel's headquarters.

**Nothing catches this:** `scripts/check-corpus.mjs` has no golden-fact check.

**Write scope:**
- `data/corpus/v2/articles/**`, preferring FREE articles, which have no manifest to re-sign
- the golden facts in `data/corpus/v2/story-bible.json`
- `scripts/check-corpus.mjs`
- `tests/corpus-v2.test.ts`
- `data/corpus/v2/embeddings.json`, only through `make embeddings` and only if a changed sentence sits in the first 1,500 body characters

**Do:**
- **UC1:** edit the two late sentences to match the story bible.
  - The 0.85% sentence (character 2796) should say 2.14%, +9 bp.
  - The "maintain 0.5%" sentence (character 2353) should match the hike to 1.00%.
  - Both are past the 1,500-character embedding window, so no re-embed is needed.
- **UC2:** either align the free filing to "two tranches", or edit NotFT.
  - Changing the filing's sentence at about character 554 needs one re-embed.
  - Editing NotFT needs its proofs re-signed.
  - Either way, run the 8-word free/paid leak gate.
- **Golden facts:** add them to the story bible (a key and its expected value per UC). Add a `check-corpus` rule that fails when a golden-path article states a conflicting value for a listed key; one regex per fact is enough.

**Acceptance:**
- `npm run check:fast` passes, including the search-leak and corpus tests.
- `check-corpus` fails on a contradiction planted in a test fixture.
- One live UC1 run shows no "sources disagree" gap.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- This must be a single-package fix (corpus).
- Work in `../tftf-wt/<id>` and stay inside the write scope.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
