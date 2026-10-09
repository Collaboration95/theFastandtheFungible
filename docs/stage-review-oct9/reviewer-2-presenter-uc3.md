# Presenter rehearsal: UC3 on 127.0.0.1:5100 (1440x900 and 1280x720, own tab)

Verified live: 4 runs (off-topic, UC3 x2, one Stop run) plus a UC1 run. Times are seconds from the Ask click, from a DOM logger plus screenshots. Not verified: "Real" pace in the Presenter menu (I left it alone, the setting is shared across tabs); server-side timing of the Stop run; the Ledger tab for the refund run. Header chips: none on any screen (home, run, Writers, Settings, Show work). The only "simulated" marker is an icon-only yellow "!" beside the budget (aria-label "XRPL TESTNET · no real value", no hover tooltip).

## A. UC3 beat-by-beat (run 1, S$2.00, full story, 69 s total)

| t | On screen | Legible from the back? |
|---|---|---|
| 0 | Ask button turns "Starting…" | Yes, but it is nothing |
| 1-6 | Plan card "Searching every listed writer for: …" with Edit / Cancel / Go now and a thin progress bar | No: tiny, 5 s, reads as a loading blip |
| 6-13 | Run page, "reading free sources", grey skeleton, bottom bar "Search → Read free sources 8 free · 8 paywalled" | Bar text: no. Skeleton: yes |
| 13.7 | v1 answer "No operator filing cited in the record gives customer lead times…", OPEN GAP, CHALLENGES 1 | Yes (big serif) |
| 21 | Right rail "Worth buying · OpenAI Decisions · gpt-6-luna": bars per writer, AlphaLeak S$0.30 and The Fab Floor S$0.40 both BUY | No: 11px rows |
| 25.7 | Strip chip "A AlphaLeak buying…", card "Buying · AlphaLeak Quoted S$0.30" | Chip no, card marginal |
| 28.7-29.7 | Budget counts S$2.00 → S$1.70, "holding S$0.30", "Paid S$0.30 · delivered · checking" | The big S$ number yes; the rest no |
| 33.2 | Red card "Proof failed · AlphaLeak … ✗ claim failed"; chip "proof failed · quarantined"; bottom bar "lead-times-dated · source quarantined, never cited" | Red helps; wording is small. This is the money beat and it is the smallest thing on screen |
| 35 | Chip "challenged", bottom bar "POST /w/alphaleak/challenge · claim lead-times-dated" | No (and raw HTTP path) |
| 37.2 | "Refunded S$0.30 · The writer paid it back · tx A23F20…2918E ↗ XRPL TESTNET"; chip "refunded"; budget "spent S$0.30 refunded S$0.30" | Green "Refunded" yes, rest no. S$ left stays 1.70: refund is not credited, never explained |
| 39-45 | Dead air: "Check again / Choose what to buy", Stop button gone, nothing moves | Dead time, ~6 s |
| 45 | "Round 2" card: AlphaLeak BLOCKED, "T 0.03 · quarantined" | Tiny, below the fold at 720p |
| 49.5-58.7 | Buying The Fab Floor S$0.40; S$1.30; "Proof verified · 6 claims recomputed" | Same as above |
| 63.7 | v2 answer highlighted yellow, "Qualifies the free answer", GAP CLOSED (green), "Compare v1 → v2" | Yes, the best moment |
| 69.2 | "Done S$0.70 of S$2.00 spent" | Yes |

No toast fires during the run. Run 2 (same question, 46 s): AlphaLeak shows BLOCKED in "Worth buying" at 21.5 s, buys The Fab Floor only (S$0.40), v2 at 40 s.

## B. Beats not visible without digging
1. **Trust 0.8 → 0.4.** Never shown as that. Run page says "T 0.03"; Writers shows "H 0.40 C 0.08 T 0.03" but those columns sit off-screen (see E). Fix: before/after pill on the AlphaLeak card, "Track record 0.80 → 0.40" (and show one number).
2. **Why AlphaLeak won round 1** (inflated claim 0.96, cheap). Fix: one line in the Worth buying card: "AlphaLeak claims 0.96, S$0.30".
3. **Quarantine** in round 2: a 9px "T 0.03 · quarantined" tag. Fix: red banner "AlphaLeak blocked: failed a proof last run".
4. **The refund as money back.** Budget left stays S$1.70. Fix: "Net spent S$0.40".
5. **Run 2 has no AlphaLeak chip at all** in the sources strip, so the "asking again" payoff is only a BLOCKED row.

## C. Talk track (10 min)
**0:00 Live proof (30-40 s).** Click the box, shout-in prompt. Say: "This is live: real model calls, no replay. Pick anything." Point at the plan card: "It tells me its plan and gives me 5 seconds to cancel before it can spend anything."
- If the answer is nonsense (it will be: "what are you" returned "The evidence set covers AI accelerator rack power draw…" with an OPEN GAP "No evidence states what the responding system is"): point at OPEN GAP and say "It refuses to invent. Free layer found nothing relevant, spent S$0.00, and says so." Never read the short answer aloud. 27 s; then Nothing paywalled worth buying.

**1:00 Setup.** Press N, then click the box (N does NOT focus it; typing without a click is lost). Click "Malaysia packaging lead times" (it only fills the box), Ask. Say: "S$2 budget. That is the only authority to spend. The model cannot move it."

**1:30-2:15 Dead time (0-21 s).** Point at the answer v1: "Free sources only. Note it says no lead-time data exists." Then the OPEN GAP: "That gap is what we might pay to close."

**2:15 Decision.** Point at "Worth buying": "A decision model, not the writer-LLM, scores every paywalled article. Two look good: AlphaLeak at S$0.30 and The Fab Floor at S$0.40." (Say "decision model"; the screen says OpenAI Decisions, see D.)

**2:40 Pay.** Point at big budget number: "Plain code pays, over x402 on XRPL Testnet. Watch the number."

**3:10 Fail.** Point at red "Proof failed · AlphaLeak": "The agent checks the writer's promise. This one lied." Then "Refunded S$0.30 … XRPL TESTNET": "Challenge issued, money back on-chain, trust drops."
- Say aloud "track record dropped from 0.8 to 0.4"; the screen won't.

**4:00 Round 2 (dead 6 s).** "Second pass. AlphaLeak is blocked." Point at Round 2 card BLOCKED row, scroll the rail first.

**5:00 v2.** Point at yellow v2 answer + GAP CLOSED + "Qualifies the free answer". "S$0.70 spent, S$0.30 came back."

**5:30 Again.** N, click box, same question. "Same question: AlphaLeak never gets bought." Point at BLOCKED in Worth buying (~21 s). 46 s total.

**7:00 Proof of work.** W: Policy tab: "SKIP_LOW_TRUST, Publisher quarantined: never bought or cited"; Ledger tab: "S$0.40 = 0.04 XRP, tesSUCCESS, link to the explorer". Esc. Skip Wire (broken layout).

**8:30 Q&A bridge.** "LLMs write, a decision model chooses, code pays."

**Recovery lines.** Slow (>30 s with no purchase): "The buying decision is the slow part, a real model call." Fallback/chip appears: "That's the labelled fallback, it says so on screen." Run takes >75 s: press N and use the pre-recorded run in the sidebar (the earlier finished UC3 is in History; click it).

## D. DO / DO NOT
DO point at: the big S$ budget number (counts down); "Proof failed · AlphaLeak" red card; "Refunded S$0.30 … XRPL TESTNET" and its tx link; GAP CLOSED / "Qualifies the free answer" / yellow highlighting; "Compare v1 → v2"; BLOCKED rows; Policy tab verdict "SKIP_LOW_TRUST"; Ledger "tesSUCCESS".
DO NOT point at: Writers tab (trust column clipped; headings H/C/T); Wire tab (overlapping layout); Receipts tab (one line of mono hash); Settings (nothing relevant, budget slider disabled); bottom stepper (tiny); the "T 0.03" tag.
**Contradictions with the pitch:**
- Screens say "OpenAI Decisions · gpt-6-luna" (Worth buying, Considered, Policy, Models tab "Decide · OpenAI Decisions"). Docs say the demo moved off Clef. "Lead with Clef/calibration" is false on screen; lead with the decision model and its probabilities (Policy: "Addresses gap 65.0%, Original 98.0%").
- Trust 0.8 → 0.4 is not what the UI shows (T 0.03; 0.40 is "honesty" only).
- Show work text uses "H/C/T", "SKIP_LOW_TRUST", "SKIP_REWRITE": code names the QA pack says never to say.
- Models tab: "Plan · client plan", "Publisher · local". Honest, but implies a local stub.
- Short answer to the UC3 question: run 1's v2 reads "26 weeks on 1 June 2026" which does not answer "getting shorter?" (the 26 → 22 → 18, 31% fall is buried in Supports). Run 2 shows the full series. Variance between runs.
- GAP CLOSED sentence is broken: "...trend. is now covered by The Fab Floor."

## E. Failure risks on stage
1. **Stop does not stop the money.** Clicked Stop at 11.9 s (Read free sources). The UI fast-forwarded to Buy within 1.5 s, paid S$0.40, proof verified, and ended "0 of 2 answered · stopped by you" with no v2: money spent, no answer. Title says Stopped, bottom bar still says "Proof check ✓" (not "Stopped"). Stop is absent in the writing, refund and Check-again phases (e.g. the UC1 run at ~13 s "Write answer v1").
2. **Stale toast** on every exit from a finished run (N, Settings): "Your answer is ready · Go back to chat" (3x), "Run stopped" after Stop. It sits on the home page 10+ s over the box.
3. **N leaves focus on body**: typed text is lost, so you must click the box first.
4. **Writers table clipped** at both 1440x900 and 1280x720: H, C, T and Status columns need horizontal page scroll (scrolling drags the page). Hiding the sidebar does not help. Proofs/Challenges "0 / 1 · 1 / 0" are cryptic.
5. **Off-topic prompt** gets an unrelated, confident short answer; "Gap: Can you tell me what you are" in the buy card.
6. **Pace**: Presenter menu is on "Stage 1×" by default. UC3 69 s (not 10-40); dead time at 39-45 s with nothing moving.
7. **Show work drawer**: translucent bottom sheet with blur, only ~half the screen; Wire tab layout is broken (text overlaps); Ledger "Loading Testnet balances…" for ~5 s.
8. Receipt timestamps say 2026-10-08 (today is Oct 9).
Presenter menu (".") works: Pace Real / Stage 1× / Stage 0.5×, "Skip them (clarify=never)", "Reset reputation" button (no need for curl), and "Fail next paid delivery: start the demo with PUBLISHER_FAULTS=1" (not a toggle). No on-screen hint that "." exists.

## F. Top 8 UI changes
1. `RunPage` bottom stepper / `Budget` rail: make the refund beat a full-width banner ("AlphaLeak failed proof → S$0.30 refunded on XRPL Testnet") for 4 s at 24px+.
2. `Writers` tab: fit the table in the rail (drop H/C columns) and show one "Track record 0.80 → 0.40" cell with a status pill.
3. Stop control: make it real (hold purchases when pressed), keep it visible through all phases, show "Stopped, S$0.40 spent" in the bottom bar.
4. Toast component: suppress "answer ready" for the run being viewed or just left by the user; auto-dismiss in 4 s.
5. `Worth buying` card: bigger rows, show claimed relevance and price, name the winner and why; add "BLOCKED: failed a proof last run" banner in round 2 and in the strip.
6. Composer: autofocus after N; add a visible hint for ".".
7. `Ask` home: replace the icon-only "!" with a visible "XRPL Testnet · simulated S$" label; add an off-topic guard ("I answer from the corpus").
8. `Show work` drawer: full height, fix Wire layout, hide enum names (SKIP_LOW_TRUST), use "track record" wording, fix the "GAP CLOSED … trend. is now covered" sentence.
