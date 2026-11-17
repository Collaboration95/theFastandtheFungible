# Final presentation · SingHacks finals at SFF · 18 Nov 2026

Everything for the 3-minute pitch in one place. Pitch deck: `pitch/index.html`
(one self-contained file, opened by double-click, no server; PDF alongside). The older 14-slide judge deck
(`site/deck/`) is for Q&A only.

## The slot

| | |
|---|---|
| When | **Wed 18 Nov, 11:30–12:00 SGT**, Tenity SingHacks Awarding. Briefing **11:10** (compulsory). |
| Where | **Swiss Pavilion, Hall 5, booth 5A25**, Singapore EXPO. Badge: Level 1, Apex Gallery, from 07:00. |
| Format | **3 minutes** per team, then the judges deliberate and announce on the spot. Screen and HDMI provided; bring our own cable, USB-C adapter and a phone hotspot. |
| Judges | Already pre-assessed the submitted deck and video. Tenity: skip the problem, go straight to the solution, show what changed since SingHacks. |
| Ripple track criteria (form wording) | Reachability 25 · Feasibility 25 · Technical depth 25 · Creativity 20 · UX and design 10 |

## Links

| What | Link |
|---|---|
| Live sandbox (XRPL Testnet) | https://ra-front-651013803640.asia-southeast1.run.app |
| Short link / QR target | https://collaboration95.github.io/theFastandtheFungible/try/ |
| Replay (no backend) | https://collaboration95.github.io/theFastandtheFungible/demo/ |
| Repo | https://github.com/Collaboration95/theFastandtheFungible |
| Release v1.1.1 | https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.1.1 |
| Pitch deck (local) | Double-click `pitch/index.html` (no server). Rebuild: `node scripts/pitch-build.mjs`; export PNGs and PDF: `node scripts/pitch-export.mjs pitch` |
| Pitch deck (preview of main) | https://htmlpreview.github.io/?https://github.com/Collaboration95/theFastandtheFungible/blob/main/pitch/index.html |
| Pitch deck (PDF, 21 pages) | https://github.com/Collaboration95/theFastandtheFungible/raw/main/pitch/ResearchAgent-finals-pitch.pdf |
| Script and Q&A | [pitch-2min.md](submission/pitch-2min.md) · [qa-prep.md](submission/qa-prep.md) |
| Stage fallbacks | [stage.md](stage.md) · [judge-week-runbook.md](judge-week-runbook.md#pitch-day--18-nov) |

## The pitch in one breath

Knowledge work is going agentic, and the best knowledge sits behind paywalls.
Agents stop at the paywall; experts can't sell to agents. ResearchAgent lets an
agent buy the one article it needs, within the budget you set, and the writer is
paid only when the article unlocks.

## Non-negotiables (owner, 18 Nov)

- **Intro logo reveal:** slide 00 opens empty; the first press plays the logo
  reveal on the same slide (white tile springs in, mark draws, "ResearchAgent"
  slides out); the next press goes to slide 01. Every pass must keep this.
- **No in-slide interaction on pitch slides:** each slide reveals itself on
  arrival; clicks and → only advance. The appendix stays interactive.
- **Look:** Saturday evening painted palette (final).

## Run of show (3:00)

| Time | On screen | Point |
|---|---|---|
| 0:00–0:15 | Slide 1 · the frame | Agents read for us now; paywalls stop them; we fix both sides. |
| 0:15–1:35 | **Live app**, the prepared run | Ask with a budget → free sources first → buys the one missing article → the key unlocks it and pays the writer → check it yourself. |
| 1:35–2:00 | Slide 3 · since SingHacks | Before → after, in four rows. |
| 2:00–2:20 | Slide 5 · any agent, by URL | Buy from Claude/Cursor/VS Code with one URL; sell with one package. |
| 2:20–2:45 | Slide 6 · proof at scale | 1,000 verified purchases, 0 violations, 34 attacks. |
| 2:45–3:00 | Slide 7 · next + QR | What's next; scan and try it. |

Slides 2 and 4 are demo support: slide 2 is the map of what the demo shows (and
the no-network fallback), slide 4 explains the key-reveal payment if a judge asks.

## The demo, beat by beat

Golden question (frozen): **"What does the MAS stablecoin framework require, and
how quickly must an issuer redeem at par?"** Budget S$1. Run it about 10:50,
keep the finished tab open, never type a fresh question during the 3 minutes.

| Beat | What's on screen | Say |
|---|---|---|
| Ask | Question, budget chip, the 5-second plan sheet | "One question, one budget, confirm once. From here, code decides purchases; the model can't spend." |
| Free first | Free documentation searched, a gap found | "It answers from free sources first, and finds what's missing." |
| Buy the gap | One note bought, S$0.40 | "It buys only the article that fills the gap." |
| Key reveal | Payment steps: locked in escrow → writer released the key → key matches the lock → article unlocked | "The key that unlocks the article is the key that pays the writer." |
| Check it | **Check the key yourself** | "Your browser reads the public ledger and checks the key matches the lock." |

Rehearsed on the live sandbox at about 02:00 on 18 Nov: it bought exactly one
team-authored note ("What the MAS stablecoin framework requires of issuers",
S$0.40, paid by key reveal), unlocked at 68.3 s, done at 78.6 s, cited [1]: par
within five business days. Capture notes are kept with the deck sources in `pitch/src/`.

- **Run it in the presenting browser profile.** Runs are private to the browser
  cookie: a run started elsewhere shows "That question isn't available here".
- **It takes about 80 s**, so never run it inside the 3 minutes. Run it at about
  10:50 and present the finished tab.
- **At 10:50, press "Check the key yourself" once** and see the green result; the 02:00
  rehearsal never pressed it. Also check which sentence carries citation [1].
- Don't open "Technical details": it says "Decisions: fixture", which is the honest
  label for rule-based buying, but it isn't the story to tell on stage.

Fallbacks, in order: "Check our work" on the live app (no question used) → the
`/demo/` replay served offline (`node scripts/stage-check.mjs --serve-replay --rebuild`)
→ slide 2's recording.

## Slide copy (source of truth for the deck)

No criterion markers, no source footers, no page headers. Every number below is
from `docs/submission/facts.json` or the cited evidence.

1. **Frame.** Headline (owner to pick; default A): A "Agents do the research now.
   The best research is paywalled." · B "Knowledge work is going agentic. Knowledge
   is still paywalled." · C "Your next reader is an agent. It stops at the paywall."
   Two sides as arrow rows: Agents → hit the paywall → settle for what's free ·
   Experts → can't sell to agents → their best work goes unread. One line:
   "ResearchAgent lets an agent buy the one article it needs, inside your budget,
   and pays the writer the moment it unlocks."
2. **What you'll see (demo map).** Ask with a budget → Free sources first → Buy the
   gap → Key unlocks the article and pays the writer → Check it yourself.
3. **Since SingHacks.** Before (19–20 Sep): one web app · fictional sources ·
   a model proposed each purchase and a person approved every quote · simulated
   payments by default. After: live sandbox since 11 Nov, any agent by URL ·
   12,104 real documentation passages plus paid notes · policy code buys within
   the budget; the model can't spend · XRPL Testnet escrow where the key that
   unlocks the article pays the writer. (No stats strip, no dates: G3/G4.)
4. **How the payment works.** Agent asks → policy locks payment to the article's
   key hash (XRPL escrow) → writer publishes the key to collect → ledger validates
   → article unlocks → your browser checks sha256(key) = lock.
5. **Any agent, by URL.** Buy: paste one MCP URL; one-click add for Cursor and
   VS Code; Claude takes a connector URL; Claude Code one command. Sell: a Hono
   seller package (Express and FastAPI adapters too) adds key-reveal delivery to a
   paid x402 endpoint; a separate Python buyer bought from it on Testnet.
6. **Proof at scale.** 1,000 Testnet purchases, each re-read from a public node,
   median 20.3 s · 210,480 protocol states checked, 0 violations, 7 of 7 seeded bugs
   caught · 1,000,000 simulated crash and retry schedules, 0 violations ·
   34 attacks on the test stack, 0 breaches · paid notes lifted correct answers
   from 31 to 48 of 100 protocol questions (development set, simulated settlement).
7. **Next, and try it.** Next steps (plans, not claims): Mainnet with a licensed
   partner · outside writers and publishers selling to agents · RLUSD settlement
   once issuers enable escrow. Large QR to /try/. Team: The Fast and the Fungible.

Labels that must stay visible somewhere on the relevant slide: XRPL Testnet (no
real value), team-authored writers, simulated settlement for the 31 → 48 result.

## Owner feedback tracker (18 Nov, 00:40)

| # | Feedback | Status |
|---|---|---|
| F1 | No 09:30 deadline; hill-climb with subagents (Opus designs, Sonnet grunt work, Fable critique) | in progress |
| F2 | Remove criterion markers ("Creativity · Technical depth") from every slide | in spec |
| F3 | Slide background must differ from the app's cream so the demo doesn't melt into the deck | design |
| F4 | Remove source footers (`docs/key-reveal-escrow.md`), page headers and footers unless essential | in spec |
| F5 | One committed .md hub (this file) with all links and an HTML preview link of the latest deck | this file |
| F6 | Slides are boring: explore design directions inspired by aigpt8, prompt-fu and common-grounds-makeathon slides; aigpt8 is the bar (strong visuals, light interactivity); /talk-style live widgets and GIFs allowed | design |
| F7 | Must also export to PDF | design |
| F8 | Slide 1: frame the problem as agentic knowledge work blocked by paywalls, both sides (agents can't access; knowledge owners can't sell); one short line on what ResearchAgent does | in spec |
| F9 | Since-SingHacks slide: clear left/right contrast, bullets and arrows, never 3 continuous lines, a little interactive | in spec |
| F10 | Features slide doesn't look good: rework | in spec |
| F11 | Last slide too verbose: drop registry publication, holdback and the "no outside customers" point; frame limits as next steps | in spec |
| F12 | Drop the builder-feedback slide and any builder-feedback numbers; no personal names on slides | in spec |
| F13 | Make the before/after contrast the centre of the story | in spec |
| F14 | QR code larger than the old slide 14's | design |
| F15 | Drop the "Paid on delivery. Proven on the ledger." tagline | in spec |
| F16 | Keep the content of old slides 7 (proof) and 8 (any agent), trimmed; drop the "recorded release run, 11 Nov" line | in spec |
| F17 | Slide changes are instant (no transitions); content loads fast, no slow reveals | design |
| F18 | 3–4 Opus design variants, not radically different; not a game | in progress |
| F19 | 14 slides is too many for 3 minutes | 7 (5 on the pitch path) |
| F20 | Golden demo question frozen (MAS stablecoin); explore a more everyday research question (e.g. recent tech/markets news) with team-authored notes in the background | in progress |
| F21 | Booth display (later, not primary) | later |

## Owner feedback, round 2 (18 Nov, 01:45)

| # | Feedback | Status |
|---|---|---|
| G1 | Keep the Signal design, tone it down a notch, remove LLM-like signals | step A |
| G2 | Remove "recorded run" labels (slides 2 and 4 and everywhere); only "Testnet" and "(simulated payments)" on 31 → 48 remain | step A |
| G3 | Since-SingHacks: drop the 350+ PRs / releases / months strip; the slide is only the before → after contrast | step B |
| G4 | No dates ("live sandbox since 11 Nov", "19–20 Sep") | step B |
| G5 | Slide 2: drop "What you'll see"; titles must say plainly what the slide is | step B |
| G6 | Slide 3 title: plain and short, e.g. "What we built since SingHacks" | step B |
| G7 | Slide 1: sleeker agents/experts rows, no header logo, bigger and higher headline, shorter one-liner; Linear-level restraint | step A |
| G8 | New intro: empty orange slide → Enter → "ta-dum" logo reveal, the wordmark comes out of the mark | step A |
| G9 | Slide 4 needs rework | step B |
| G10 | Slide 5 looks like a Flask app: rework | step B |
| G11 | Slide 6 cards are bare: rework | step B |
| G12 | Replace the yellow highlight block with a better marker device in the spirit of aigpt8's "Why it works" (hand-drawn ellipse, circle, sparkles) | step A |
| G13 | No Python server: one self-contained index.html that opens by double-click | step A |
| G14 | Open the deck for the owner when done | after step B |

## Script · 3:00 (short, about 180 words)

You can't memorise 450 words, and you don't need to. Say one short line per beat;
the slides and the live app carry the rest. Pauses are fine: the demo fills them.

**Cue card:** Paywall → Ask → Free → Buy → Key → Check → Before/after → One URL → Checked → Next

| Beat | On screen | Say (one line) |
|---|---|---|
| Intro | Empty slide → press → logo | "We're The Fast and the Fungible." |
| Paywall | Slide 1 | "Agents do the research now. But the best research is paywalled. Agents settle for what's free; writers can't sell to agents. ResearchAgent fixes both." |
| Ask | Live app, the finished MAS run | "One question about MAS stablecoin rules, one Singapore dollar. Fixed rules decide what to buy; the AI can't spend." |
| Free | Sources | "It reads free sources first and finds the gap." |
| Buy | The bought note, S$0.40 | "Then it buys one article. Forty cents." |
| Key | Payment steps | "The key that unlocks the article is the key that pays the writer. No delivery, no payment." |
| Check | Press "Check the key yourself" | "And you can check it yourself, on the public ledger." |
| Before/after | Slide 3 | "At SingHacks: one web app, sample sources, a person approving every purchase. Now: live on the web, a Mac app, and inside Claude, Cursor and VS Code, paying on XRPL Testnet." |
| One URL | Slide 5 | "Any agent connects with one URL. Any writer sells with one package." |
| Checked | Slide 6 | "A thousand purchases, every one re-checked on the ledger. Zero errors, zero double charges, zero breaches." |
| Next | Slide 7 | "Next: real money with a licensed partner, and outside writers. Scan to check it out. Thank you." |

Timing guide: paywall by 0:20, demo done by 1:40, before/after by 2:05, close by 3:00.
If you run long, drop the "Free" line and shorten "Checked" to "A thousand purchases, zero errors."
Keyboard: 1–7 jump to slides, 0 returns to the empty intro, the appendix opens with its tile keys.

### Questions to have one line ready for

| Likely question | One-line answer |
|---|---|
| Is this real money? | No. XRPL Testnet, real ledger, no real value. Mainnet needs a licensed payments partner; that's the next step. |
| "Simulated payments" on the +17 result? | That benchmark ran offline to measure answer quality, so its payments were simulated. The 1,000 purchases are real Testnet escrows. |
| So it's wrong half the time? | It's a hard protocol development set; free docs alone got 31 of 100, adding paid notes got 48. The point is the lift from buying the right article. |
| The demo took 80 s, slide says 20 s? | 20.3 s is the median for the purchase itself across 1,000 runs; the full answer adds research and writing. |
| Who decides what to buy? | Fixed policy rules inside your budget, after one confirmation. The model writes the answer; it can't spend. |
| Where can I use it? | The live web sandbox; a Mac app (Apple Silicon and Intel; offline demo on first run, Testnet in Settings); MCP by URL for Claude, Cursor and VS Code, an npm MCP package and a Claude Desktop extension; TypeScript and Python SDKs; one-line `try --testnet`. |
| Who are the writers? | Today, our own team-authored notes plus 12,104 public documentation passages. Anyone can publish a note from a phone, with an operator approving each one; no outside writer has published yet. |
| What stops the writer taking the money without delivering? | No key, no payment: collecting the money publishes the key, and the key is what unlocks the article. A key match proves delivery, not quality; for quality there's an opt-in 20% holdback the buyer's policy can take back. |
| Are the 1,000 purchases 1,000 customers? | No: scripted repeats of one team note by fresh Testnet accounts, to prove the payment path at volume, each re-checked on a public node. |
| Is the escrow scheme standard x402? | x402 carries the payment; the key-reveal escrow is our own scheme (`escrow-v1`), documented and drafted for upstream, not yet filed. |
| Can it use RLUSD? | Not yet in escrow: RLUSD's issuers have escrow locking off today. We checked on Testnet and Mainnet; it's on the list once it's enabled. |
