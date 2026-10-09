# Stage review, 9 Oct (rehearsal of the live demo on main)

Three AI reviewers (Sonnet 5.5) ran the live demo on main (`1e7eaf4`) thirteen times through the browser pane: a random question to prove it is live, then UC1 to UC4, S$0, and Stop. Raw reports are in [stage-review-oct9/](stage-review-oct9/). The walkthrough has the same content with mockups and alternatives to vote on: open `docs/ux-walkthrough/index.html`, tabs **Shipped** and **Review**.

They are agents, not people in a room. Treat the clutter judgements as opinion and the timings as good to a second or two. The Stop finding was checked against the server's event log.

## Setup that matters

- The primary Cloudflare account's 10,000 daily neurons ran out. Live search falls back to keyword-only and the header shows "Fixture fallback · Search". Run `CF_BACKUP=1 make live` until 08:00 SGT (STATUS.md already says so). The first reviewer ran without it, so its chip finding is an artifact.
- Press "." for the Presenter menu. Set "Skip them (clarify=never)" before going on stage; "Reset reputation" is there too.
- Stage 1× pace made UC3 take 69 s against 34 s in the final smoke. Real pace is faster but hides the beats.

## Is it too cluttered?

Home is clean. The last screen is not: about 60 things, and the ones that carry the story (the BUY, the refund, trust 0.8 → 0.4) are the smallest. The shipped Done screen has about as many words as the v1.1 mockup it followed.

## Point at

- Home: "Ask a question. Give it a budget." and the budget chip.
- The big budget number counting S$2.00 → S$1.10.
- The yellow v2 answer, "Qualifies the free answer", Compare v1 → v2.
- The receipt (View): invoice, ledger link, "Charges 1", "XRPL TESTNET · no real value".
- Show work → Policy, if asked how it chose.
- UC3 only: the red "Proof failed", the green "Refunded S$0.30", the BLOCKED row on the re-ask.

## Do not point at

- The short answer on an off-topic question (it answers with the nearest thing in the corpus). Point at the open gap and "S$0.00".
- The 12-row decision list (repeated writer names, no titles).
- The v2 headline and the "Gap closed" sentence (v2 can repeat v1; the sentence splices two).
- The Writers tab (clipped trust columns, "T 0.03").
- The bottom stepper, the "T 0.80" chips, Wire, the yellow "i".
- "OpenAI Decisions · gpt-6-luna" while saying Clef. Say "decision model".

## What could go wrong

1. **Stop does not stop a purchase already in flight.** Verified on three UC3 runs against the event log: no purchase started after Stop was accepted (the gate holds), but Stop at about 12 s still ended with S$0.40 paid, the article never read and no v2, under "stopped by you". Clean window: about the first 6 s after the plan card closes.
2. **The screen can contradict the server.** At Stage 1× the UI said "Nothing paywalled was worth buying" and "S$0.00" for about 10 s after the server had bought.
3. **UC4 spent S$0.60 in one run** (the handoff says S$0), and the screen still said "found free on a focused search". It went S$0 in the final smoke, so it varies.
4. **A random question gets a confident, irrelevant short answer** and six "challenges". The gap is honest; the headline is strange.
5. **Dead air**: 0 to 5 s after Ask, up to 26 s if the clarify card waits, about 6 s after the refund in UC3.
6. **Stale toasts** ("Answer ready · Go back to chat") sit over the home box for 10 s or more. N does not focus the box.
7. **Hard gate 5**: "simulated" is now a small yellow "i". The v1.1 AB3 test required five of five viewers to say "no real money". Re-run it before shipping that.

## Ten-minute script

Assumes `CF_BACKUP=1`, clarify=never, Stage 1× pace.

| Time | Say | Point at |
|---|---|---|
| 0:00 | LLMs write, a decision model chooses, code pays. You give it a budget and that is the only thing that can spend. | Nothing yet |
| 0:30 | Before the real demo: shout me a question. This is live, no replay. | Type it, Ask |
| 1:00 | It shows its plan and gives me five seconds to cancel before it can spend a cent. | The plan card |
| 1:20 | It has nothing about that, so it says so and spends S$0.00. It refuses to invent. | The open gap and the budget, not the short answer |
| 1:50 | Now the real one. A S$2 budget is the only authority it has. | N, click the box, "Kestrel–TSMC outlook", Ask |
| 2:20 | Free sources first. It names what it still doesn't know: analyst views. | Short answer, then OPEN GAP |
| 2:50 | A decision model scores every paywalled article against that gap. One clears the bar; an op-ed and a rewrite do not. | "Worth buying", while the bar fills (it folds in 3 s) |
| 3:20 | Plain code pays the writer over x402 on XRPL Testnet. Watch the number. | S$2.00 → S$1.10 |
| 3:50 | It checks the writer's promise against what arrived, then reads the article. | "Proof verified · 14 claims recomputed" |
| 4:20 | The answer changes: margins are being cut, not demand. | Yellow v2, "Qualifies the free answer", Compare v1 → v2 |
| 4:50 | One charge, a ledger transaction, labelled Testnet. | View receipt |
| 5:30 | Now a writer who games the system. | N, "Malaysia packaging lead times", Ask |
| 6:15 | AlphaLeak claims high relevance and is cheap, so round one buys it. Its proof fails; it is challenged and refunds on-chain. | Red "Proof failed", green "Refunded S$0.30". Say aloud: "its track record falls from 0.8 to 0.4". The screen won't. |
| 7:15 | Round two: AlphaLeak is blocked and the honest writer is bought. | The BLOCKED row (scroll the rail), yellow v2 |
| 8:00 | Ask again. AlphaLeak is never bought. | N, same question, BLOCKED at about 20 s |
| 8:45 | If you want to see how it decided: every article, every probability. | W → Policy. Skip Wire. |
| 9:30 | LLMs write, a decision model chooses, code pays. Questions? | Q&A pack ready |

If it goes wrong: slow ("the buying decision is a real model call"; do not press Stop); over 75 s (N, open the finished run from the sidebar); a fallback chip ("that is the labelled fallback"); a weird random answer (point at the gap and S$0.00).

Untested idea for the live proof: an audience question that the corpus can answer but is not on the demo list, for example "Is Kestrel's Penang Phase 2 plant at full capacity?" (a free Open Records note says 92% of rated capacity). Rehearse it once before using it.

## Simplifications, ranked

| # | Change | Size |
|---|---|---|
| 1 | Put the bought fact in the v2 headline; answer every requested fact | S |
| 2 | Fix the "Gap closed" sentence (old gap text spliced onto "is now covered by") | XS |
| 3 | Decision list: titles, bars and stamps stay; a writer once per row; drop "T 0.80" chips | S |
| 4 | Name the run-bar phases: Read, Decide, Buy, Check | S |
| 5 | Plan card: bigger, "starts in 5 s", shows the budget | S |
| 6 | Clarify: auto-skip after 3 s, or clarify=never on stage | XS |
| 7 | Say "simulated" in words on the money (gate 5; re-run AB3) | XS |
| 8 | UC3 beats: refund banner, "track record 0.80 → 0.40", BLOCKED banner, net spent | M |
| 9 | Writers tab: name, trust bar, status; fit at 1280 | S |
| 10 | Stop: say what it can no longer stop; keep it visible in every phase | S |
| 11 | Stale "Answer ready" toasts | XS |
| 12 | Stage pace: interim text contradicts the server | S |
| 13 | UC4 "found free" wording after a paid purchase | XS |
| 14 | N focuses the box; hint for "." | XS |
| 15 | Out-of-scope line for questions no writer covers | M |
| 16 | Show work: full height, plain verdict words, a "Pay · code" row under Models | S |
| 17 | Budget popover: a click on "Free" fell through (seen once, check by hand) | XS |

Alternatives for 1, 3, 4, 5, 6, 7, 8 and 9 are drawn in the walkthrough's Review tab.
