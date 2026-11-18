# Final presentation · SingHacks finals at SFF · 18 Nov 2026


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





## Run of show (3:00)

| Time | On screen | Point |
|---|---|---|
| 0:00–0:05 | Intro · empty → press → logo reveal | "We're The Fast and the Fungible." |
| 0:05–0:20 | Slide 1 · the paywall | Agents read for us now; paywalls stop them; we fix both sides. |
| 0:20–1:40 | **Live app**, the prepared run | Ask with a budget → free sources first → buys the one missing article → the key unlocks it and pays the writer → check it yourself. |
| 1:40–2:05 | Slide 3 · what we built since SingHacks | Before → after: web, Mac app, MCP; real sources; fixed rules; XRPL Testnet escrow. Presented at AI Tinkerers Singapore; top 3 projects on Google Cloud Run. |
| 2:05–2:20 | Slide 5 · any agent, by URL | Buy from Claude/Cursor/VS Code with one URL; sell with one package. |
| 2:20–3:00 | Slide 6 · what's next + QR | What's next; scan to check it out. |

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

## Script · 3:00

Plain text copy for notes: read it straight through. Stage directions are in italics.

### Intro
*(empty slide, press once for the logo)*

Hi, we're The Fast and the Fungible, and this is ResearchAgent.

### The problem and what we built
*(slide 1, done by 0:30)*

More and more research is done by AI agents. But a lot of information sits behind paywalls built for people with subscriptions. So agents hit the wall and settle for whatever is free, and the experts who wrote the good stuff have no way to sell to them.

ResearchAgent is a marketplace for AI agents. Your agent buys the one article it needs, for a few cents, inside a budget you set, and the writer gets paid the moment it's delivered. All on the XRP Ledger, with escrow, pay on delivery and verifiable receipts.

### The demo
*(switch to the live app, the finished MAS run; done by 1:40)*

Here's a real run on our live app. I asked a question and gave it a budget of one Singapore dollar.

Before it spent anything, it showed me its plan. After that, fixed rules decide what to buy, inside my budget. The AI interprets the answer, but it can never spend.

*(point at "28 sources · 17 read · 1 bought")*

It found 28 sources and read 17, mostly free documentation. That left a gap, so it bought exactly one article, a note on the MAS framework, for forty cents. Sixty cents of my budget is still left.

*(point at "Unlocked" and "Paid by key reveal")*

The money sits locked in an escrow on the XRP Ledger. The writer can only collect it by publishing a key, and that same key is what unlocks the article. So the writer gets paid at the moment the article is delivered. No article, no payment.

*(point at the answer)*

And here's the answer, with the article it bought in its sources.

*(open "Check it yourself", press "Check the key yourself")*

To make this trustworthy and transparent, you can verify it yourself on the public ledger. Your browser checks that the key matches the lock.

### Since SingHacks
*(slide 3, by 2:05)*

At SingHacks, this was one web app with sample sources, simulated payments, and a person approving every purchase. Today it's live on the web, on the Mac, and inside Claude, Cursor and VS Code. It reads over twelve thousand real documentation passages, and every purchase is a real escrow on XRPL Testnet.

Along the way, we presented it at AI Tinkerers Singapore, and it was one of the top three projects on Google Cloud Run.

### Any agent
*(slide 5)*

Any agent can use it by pasting one URL. And any writer with a paid endpoint can start selling to agents by adding one package.

### What's next
*(slide 6, close by 3:00)*

Next: real money with a licensed payments partner, outside writers and publishers selling to agents, and settlement in RLUSD. Scan the code to try it yourself. Thank you.

If you run long: skip "Before it spent anything..." in the demo.
Keyboard: before the appendix, 1–6 jump to slides, 7 opens the appendix and 0 returns to the empty intro. On the appendix, digits, − and = open cards (0 opens "Is this real money?"); press Esc to close a card and Home to go back to the start.

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
