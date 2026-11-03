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
