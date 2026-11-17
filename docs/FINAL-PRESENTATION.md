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
| Q&A | [qa-prep.md](submission/qa-prep.md) and the table below |
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
| 0:00–0:05 | Intro · empty → press → logo reveal | "We're The Fast and the Fungible." |
| 0:05–0:20 | Slide 1 · the paywall | Agents read for us now; paywalls stop them; we fix both sides. |
| 0:20–1:40 | **Live app**, the prepared run | Ask with a budget → free sources first → buys the one missing article → the key unlocks it and pays the writer → check it yourself. |
| 1:40–2:05 | Slide 3 · what we built since SingHacks | Before → after: web, Mac app, MCP; real sources; fixed rules; XRPL Testnet escrow. |
| 2:05–2:20 | Slide 5 · any agent, by URL | Buy from Claude/Cursor/VS Code with one URL; sell with one package. |
| 2:20–2:45 | Slide 6 · checked, not claimed | 1,000 Testnet purchases re-checked; 0 violations, 0 double charges, 0 breaches. |
| 2:45–3:00 | Slide 7 · what's next + QR | What's next; scan to check it out. |

Slides 2 and 4 are demo support: slide 2 is the map of what the demo shows (and
the no-network fallback), slide 4 explains the key-reveal payment if a judge asks.

## The demo, beat by beat

Golden question (frozen): **"What does the MAS stablecoin framework require, and
how quickly must an issuer redeem at par?"** Budget S$1. Run it about 10:50,
keep the finished tab open, never type a fresh question during the 3 minutes.

| Beat | What's on screen | Say |
|---|---|---|
| Ask | Question, budget chip, the 5-second plan sheet | "One question about MAS stablecoin rules, one Singapore dollar. Fixed rules decide what to buy; the AI can't spend." |
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


Fallbacks, in order: "Check our work" on the live app (no question used) → the
`/demo/` replay served offline (`node scripts/stage-check.mjs --serve-replay --rebuild`)
→ slide 2's recording.

## Script · 3:00 (short, 172 words)

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
| Checked | Slide 6 | "A thousand Testnet purchases, each re-checked on the ledger. A million simulated crashes, 34 attacks: zero double charges, zero breaches." |
| Next | Slide 7 | "Next: real money with a licensed partner, and outside writers. Scan to check it out. Thank you." |

Timing guide: paywall by 0:20, demo done by 1:40, before/after by 2:05, close by 3:00.
If you run long, drop the "Free" line and shorten "Checked" to "A thousand purchases, each re-checked on the ledger."
Keyboard: before the appendix, 1–7 jump to slides, 8 opens the appendix and 0 returns to the empty intro. On the appendix, digits, − and = open cards (0 opens "Is this real money?"); press Esc to close a card and Home to go back to the start.

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
