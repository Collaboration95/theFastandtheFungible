# Story bible (locks UC1–UC4)

Machine-readable source: `story-bible.json` (consumed by #119 and #157). Roster: `data/writers/*.json`. All content is SYNTHETIC; real names (TSMC, BoJ, JGBs) are allowed (D20).

**Company:** Kestrel Semiconductor, a fictional fabless AI-accelerator designer (Singapore HQ, listed in Taipei, Penang packaging). Latest deal, announced 29 Sep 2026: five years with TSMC, 24,000 N3P wafers a month from Q3 2027, US$1.1 billion prepayment in three installments (US$400m, then 2 × US$350m), about US$22,500 a wafer (was US$19,800).

| UC | Question (locked) | Free covers | Gap | Winner | Impact | Spend |
|---|---|---|---|---|---|---|
| UC1 | What did the Bank of Japan change at its last meeting, and how did 10-year JGB yields react? | Open Records BoJ statement (25 bp hike to 1.00%, 18 Sep 2026), yield table (10y 2.05% → 2.14% → 2.19%), Basis Points recap | none | none (decoys: Basis Points analysis S$0.40, NotFT S$0.90, Kopi, MarketPulse rewrite) | n/a | S$0 |
| UC2 | What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC? | Filing: terms and prepayment, no analyst view | analyst view on the picked angle | NotFT `notft-kestrel-tsmc-deal-margins` (S$0.90): consensus FY27 gross margin 55.2% from 58.5% on 1 Oct 2026; wafer US$22,500 vs US$19,800 (+13.6%) | QUALIFIES | S$0.90 |
| UC3 | Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter? | Penang Phase 2 commissioned 15 Aug 2026, 11,000 → 16,000 units a month; no lead times | lead times in weeks | Round 1 AlphaLeak (S$0.30, relevance 0.96) fails proof, refunded, quarantined; round 2 The Fab Floor (S$0.40 data deep-dive): 26 wk (1 Jun), 22 wk (1 Aug), 18 wk (15 Sep 2026) | STRENGTHENS | S$0.70 gross, S$0.40 net |

**UC2 clarify (few-shot steers it):** one question, "Which angle matters most to you?" with [capacity allocation · pricing & margins · delivery timeline]. Rehearsal pick: pricing & margins. If the user picks capacity allocation instead, buy The Fab Floor (`fab-floor-kestrel-allocation`, S$0.25). MarketPulse (`mp-kestrel-deal-digest`) is skipped as a rewrite of NotFT; Kopi is cheap opinion with no figures.

**AlphaLeak plant (D19):** `alphaleak-kestrel-penang-lead-times`, S$0.30, relevance 0.96, claims a `dated-figure` on passage `lead-times`, whose text has no digits and no date. The Fab Floor's `lead-times` passage has the true dated series. Skipped rewrite in UC3: `mp-malaysia-packaging-digest`.

**UC3 price (owner, 8 Oct, #204):** The Fab Floor's `fab-floor-kestrel-penang-lead-times` is a S$0.40 data deep-dive (The Fab Floor's standard price stays S$0.25). AlphaLeak (S$0.30) is cheaper, so with equal public scores it still wins round 1 on value per dollar; after its refund and quarantine, round 2 buys The Fab Floor, within the S$1 per-source cap.

**Golden facts (#198):** `goldenFacts` in `story-bible.json` lists one key, its accepted values and one regex per fact (BoJ rate 1.00% and vote 7–2; 10-year JGB +9 bp to 2.14% on 18 Sep; Kestrel HQ Singapore; prepayment in three installments; Phase 2 commissioned 15 Aug 2026; 45 MW connection; 40 MW of solar). `scripts/check-corpus.mjs` fails when any golden-path article states a different value.

**UC4 (#211):** "When was Kestrel Semiconductor's Penang Phase 2 packaging plant commissioned, how large a grid connection does it need, and how much of its electricity comes from renewable sources?" The first search reads the commissioning date (`or-penang-packaging-output-2026-q3`) and the 45 MW connection (`lf-penang-grid-connection`). The third fact (40 MW of solar signed 8 Sep 2026, about 17% of annual use) is in the free Load Factor post `lf-corporate-green-power-round-2026`, which only a focused search finds: its title, abstract, tags and first 1,500 body characters are about the green power round in general. The paid Load Factor deep-dive `lf-kestrel-penang-phase2-power-deep-dive` (S$0.60) promises the same fact. Expected: "3 of 3 · found free on a focused search · nothing bought", with the deep-dive shown as a skip row in the decision table. It is a demo question since the follow-up search (#210) and its fixture scenario test landed.
