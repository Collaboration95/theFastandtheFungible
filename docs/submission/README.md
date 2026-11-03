# SingHacks finals submission pack

Ripple track. Submit by **Thu 12 Nov** (official deadline 13 Nov, 23:59 SGT).
Pitch on **Wed 18 Nov, 11:30 SGT**, Swiss Pavilion, SFF. Scoring:
[JUDGING-CRITERIA.md](../JUDGING-CRITERIA.md).

| Form field | Use | Status |
|---|---|---|
| Team name | the owner fills it in | owner, [#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265) |
| Short description | [short-description.md](short-description.md) (50 / 150 / 300 words) | ready |
| Pitch deck (PDF) | [ResearchAgent-SFF-deck.pdf](ResearchAgent-SFF-deck.pdf), source [deck/index.html](deck/index.html) | ready; video link TODO on slide 10 |
| Public GitHub repo | https://github.com/Collaboration95/theFastandtheFungible | ready |
| Demo link (video) | script: [demo-video-script.md](demo-video-script.md) | TODO: recording on #265, target Wed 11 Nov |

Also in this folder: the [2-minute pitch](pitch-2min.md) (with a 3-minute
variant) and the [judge Q&A prep](qa-prep.md).

## Rebuild the deck

```sh
npm ci                                   # fonts come from @fontsource-variable
node docs/submission/deck/export.mjs     # PDF here + PNGs in scratch/deck-png/ to look at
```

The export fails if any slide's content overflows its 1920 × 1080 frame. The
visual system follows [UX-DIRECTION §5](../design/UX-DIRECTION.md#5-visual-system):
ink on paper, Geist only, mono for hashes and commands, and sentence case.
Every number on a slide names its source file on that slide's bottom line. When
a number changes (e.g. after the next scorecard), edit the HTML, re-export and
commit both.

## Facts discipline

Use only merged facts, each with its date and label: XRPL Testnet (validated
transaction), simulated (offline rail), fixture (substituted model or research)
or fictional (writers and corpus). Anything pending is marked TODO. The
[tracker](../SFF-PUSH.md) is the source of truth for newer numbers.


## Numbers source correction for #321, slide 7 and pitch (3 Nov)

Use the fresh generalised-policy result from `eval/scorecard/fresh-results.json`
and `eval/REPORT-decisions.md` §10, with the full rule audit in `eval/FRESH-AUDIT.md`.
The earlier 80.05% was a reused holdout after repeated corpus exposure; retain it
only as labelled historical comparison, not an independent generalisation claim.

Exact headline/pitch sentence: **“On 48 fresh synthetic questions, 93.15% of gross article spend bought a requested fact retained in the final cited answer (95% CI 81.25–100.00%).”**

Place this caveat beside it: **LIVE decisions/coverage; fixture research, keyword search and SIMULATED payments. Same-vendor labels await human review; structured templates and fixed model draws limit generalisation.**

Slide 7 supporting figures (95% source-cluster CIs):

- Wasted gross/net spend: **6.85% [0.00–18.75]**, no benchmark refunds.
- Supported-fact uplift: **+66.67 pts [45.83–83.33]** (13 → 45 supported facts / 48).
- Gross purchase denominator **S$14.60**; contributing purchase numerator **S$13.60**.
- **0 audit violations / 10 API runs / 568 observations**, not all production runs.
- **48 questions, 24 new source documents, four domains**: water utilities,
  maritime logistics, fibre networks, food cold chain. No pooling with old heldout.

For an optional comparison, #324 reused-heldout final-used spend is **80.05%
[63.16–92.00]**, gross/net waste **19.95% [8.00–36.84]**, uplift **+38.04 pts
[24.00–51.14]**; fresh main-policy final-used **90.07% [79.31–100.00]**, waste
**9.93% [0.00–20.69]**, uplift **+66.67 pts [45.83–83.33]**. Different-set numbers
are descriptive. Fresh paired policy change **+3.08 pts [0.00–9.43]** in used
spend does not establish strict improvement. Avoid “93% of facts”, “customer
ROI”, “production success”, “overfitting ruled out” or measured live-writer claims.

Deck owner: update slide 7/pitch and export the PDF from these sources after the
numbers PR merges. This lane changes this source note only; it does not edit the
deck HTML or silently overwrite the pitch manuscript.


Evaluation candidate was frozen before shipping rebases; #322's later recovery/
export additions were checked locally but not live re-evaluated here. Do not
label this as a fresh live measurement of the final merged SHA.
