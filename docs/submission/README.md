# SingHacks finals submission pack

Ripple track. **Official deadline Fri 13 Nov, 23:59 SGT; our own target is Thu
12 Nov.** Live pitch **Wed 18 Nov, 11:30–12:00 SGT**, Swiss Pavilion, SFF
(Singapore EXPO). Scoring: [JUDGING-CRITERIA.md](../JUDGING-CRITERIA.md).

Judges **pre-assess the submission and the demo video** before SFF, and that
counts toward the final score alongside the live pitch. The organisers ask the
submission to show the latest functionality, the technical implementation, and
progress since SingHacks. Every file here is written to that brief. Facts as of
**7 Nov 2026**.

| File | What it is |
|---|---|
| [short-description.md](short-description.md) | 50 / 150 / 300-word descriptions with a label check |
| [ResearchAgent-SFF-deck.pdf](ResearchAgent-SFF-deck.pdf) | 12-slide deck; source [deck/index.html](deck/index.html) |
| [demo-video-script.md](demo-video-script.md) | 9-shot, 2:50 video for the owner to record |
| [pitch-2min.md](pitch-2min.md) | 2:00 pitch script with timing marks, plus a 3-minute variant |
| [qa-prep.md](qa-prep.md) | numbers card and 20 hard questions from the R / P / Y judges |

## Owner checklist

The form link is in the organisers' email and in the local, untracked
`docs/SFF-FINALS.md`. It is deliberately not committed to this public repo.

- [ ] **Mon 9 Nov:** confirm our registered team name (decision A5 on
      [#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265)).
- [ ] **Mon 9 Nov:** ask Tenity whether the pitch is 2 or 3 minutes, and decide
      who presents.
- [ ] **Tue 10 – Wed 11 Nov:** once J3 has merged and v1.0.0 is
      published, an agent fills the placeholders below and
      re-exports the deck.
- [ ] **Wed 11 Nov:** record the video ([script](demo-video-script.md)). Check
      the "Before you press record" list first: gh-pages must be republished.
- [ ] **Thu 12 Nov:** upload the video unlisted, put its link in the deck
      (slide 12) and re-export, then submit the form with the fields below.
- [ ] **Thu 12 Nov:** open the GitHub repo in a private window to confirm it is
      public, and the deck PDF and video link to confirm both open.
- [ ] **Fri 13 Nov, 23:59 SGT:** hard deadline. Our target is a day earlier.
- [ ] **14–17 Nov:** rehearse the [pitch](pitch-2min.md) to time; study the
      [numbers card](qa-prep.md#numbers-card-memorise-these).
- [ ] Watch for the email with SFF passes and entry instructions.

## Form fields, drafted

| Field | Required | Paste this |
|---|---|---|
| **Team name** | yes | `theFastandtheFungible`. This is the team and repo name in the README; check it matches what we registered at SingHacks, as the form asks for the original name. |
| **Short description** | yes | The **150-word** tier from [short-description.md](short-description.md#150-words). If the field is short, use the 50-word tier; if it is long, use the 300-word tier. Replace every `{{…}}` first. |
| **Pitch deck** | no | Upload [ResearchAgent-SFF-deck.pdf](ResearchAgent-SFF-deck.pdf) (PDF, 12 pages). If upload fails, use the raw link: `https://github.com/Collaboration95/theFastandtheFungible/raw/main/docs/submission/ResearchAgent-SFF-deck.pdf` |
| **GitHub repository** | yes, must be public | `https://github.com/Collaboration95/theFastandtheFungible` |
| **Demo link** | no, but judges pre-assess it | `{{VIDEO_URL}}`: the unlisted video recorded from [demo-video-script.md](demo-video-script.md) |

If the form has a free-text notes field, paste this (54 words):

> Judges can run the whole path on XRPL Testnet with one line, no clone:
> `npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0/researchagent-mcp-1.0.0.tgz try --testnet`
> (Node ≥ 22.13). It ends with six Testnet links and `RESULT PASS`. Replay:
> https://collaboration95.github.io/theFastandtheFungible/demo/ · Live ledger
> check: https://collaboration95.github.io/theFastandtheFungible/ledger/ ·
> Testnet only, no real money, no hosted instance.

## Placeholders

These mark work still landing on 7 Nov. Before submitting, replace each
placeholder, or delete the sentence it sits in. Find any that are left with:

```sh
grep -rn '{{' docs/submission/ --include='*.md' --include='*.html'
```

| Placeholder | Fill with | Comes from | Where it appears |
|---|---|---|---|
| `{{RELEASE_TAG}}` | the tag carrying `try`, expected `v1.0.0` | release lane, after J3. **Filled `v1.0.0` (7 Nov).** | short-description (150, 300), deck slides 2, 3, 12, video script (prereqs, shots 2, 7, 8), this README |
| `{{RELEASE_VERSION}}` | npm version, expected `1.0.0` | release. **Filled `1.0.0` (7 Nov).** | short-description, deck slides 3 and 7, video script, this README |
| `{{RELEASE_PY_VERSION}}` | wheel version: `1.0.0`, or `1.0.0rcN` for an RC (PEP 440) | release. **Filled `1.0.0` (7 Nov).** | video shot 8 |
| `{{J3_FIRST_TRY_SECONDS}}` | seconds from `init` to a validated Credential, first try | J3 ([#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389)) `docs/evidence/round4-j3/slim-onboarding.json`. **Filled `33.9 s` (7 Nov; cold init 1.396 s + publish to Credential 32.491 s = 33.888 s).** | deck slide 8, video shot 7, qa Q2 |
| `{{REGISTRY_STATUS}}` | "also on npm, PyPI and the MCP Registry", or "not yet on npm or PyPI" | owner decision A3 | deck slide 8 |
| `{{UPSTREAM_FILED_URLS}}` | the filed issue URLs, or "not yet (drafts in docs/feedback/upstream/)" | owner task B1 | deck slide 11 |
| `{{UPSTREAM_FILED_ANSWER}}` | "Yes, three, on <date>", or the fallback line in Q13 | owner task B1 | qa Q13 |
| `{{VIDEO_URL}}` | the unlisted video link | owner, after recording | deck slide 12, form |

Already filled from merged work on 7 Nov: the release tag, version and wheel version (v1.0.0), the J3 first-try time (33.9 s), the J1 judge-bank rate (**15/20**,
[#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390)) and
the S1b Settings page ([#386](https://github.com/Collaboration95/theFastandtheFungible/pull/386)).

**If J3 has not merged:** change deck slide 8's writer card to
"Credential in 43.8 s", and use the video's shot-7 fallback.

## Rebuild the deck

```sh
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci    # fonts come from @fontsource-variable
node docs/submission/deck/export.mjs      # PDF here + PNGs in scratch/deck-png/ to look at
```

The export fails if any slide's content overflows its 1920 × 1080 frame. The
visual system follows [UX-DIRECTION §5](../design/UX-DIRECTION.md#5-visual-system):
ink on paper, Geist only, mono for hashes and commands, sentence case.
Placeholders render in amber mono so an unfilled one is obvious in the PDF. The
pixel agent on slides 1 and 12 is cut from
[`design/character/sprite-sheet.png`](../../design/character/sprite-sheet.png)
at integer scale; each frame shows a real state (verified; search, pay, key,
verified, refund). Every number on a slide names its source on the slide's
bottom line. When a number changes, edit the HTML, re-export and commit both.

## Facts discipline

- Use only merged facts, each with its date and label: **XRPL Testnet**
  (validated transaction, no real value), **simulated** (offline rail),
  **fixture** (substituted model or research), **fictional** (research writers
  and corpus), **team-authored** (our own real notes, not an independent
  writer), **TEST-SGD** (our Testnet IOU, stand-in for RLUSD).
- Never imply a hosted instance. The `/demo/` page is a replay of a recorded
  Testnet run; `/ledger/` is a static page that re-checks hashes read-only.
- Timings are single measurements on one Mac unless stated. Say so when asked,
  and keep the misses: two of four cold `try` runs overran 90 s.
- The 93.15% quality number is LIVE decisions on a fixture corpus with
  simulated payments (3 Nov). Quote it only with its caveats
  ([qa-prep Q19](qa-prep.md#19-does-it-actually-buy-the-right-things)). The
  80.05% and 52.9% → 40.7% figures are historical.
- The [tracker](../SFF-PUSH.md) is the source of truth for newer numbers.
