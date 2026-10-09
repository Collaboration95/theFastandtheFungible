# Skeptic review, live app, 8 Oct (system clock), 1440x900, Stage 1x pace unless stated

Method: browser pane + API run records (`GET /runs/:id`). Server event timestamps are authoritative. My tool round-trips add 1-3 s to every click, so UI-side times are approximate.

## A. Tasks 1-4

**UC1 (BoJ, S$2).** Ask 20:07:53 -> PLAN 20:07:59 (the 5 s plan card) -> DONE 20:08:03.6. Server time about 10 s. Title read "Answer ready" by about 20 s.
- Result: 7 cited supports, S$0.00 of S$2.00 spent, 16 sources / 8 read / 8 not bought. Spend was S$0 as expected.
- Legibility: the only "nothing happened for a reason" signals are a collapsed 11 px line "2 of 2 answered · nothing bought" and a "Considered 8 paywalled sources" list of SKIP/REWRITE chips. Nothing says in words "free sources were enough, no gap worth paying for". Someone at the back of the room would see a long answer and a full budget bar and ask why the wallet did nothing. Verdict: legible only if the presenter says it.

**UC4 (Penang).** Ask 20:08:42 -> DONE 20:09:08 (26 s server). Under Stage 1x the UI finished about 20 s later.
- **Expectation failed: it spent S$0.60.**
  - Coverage after the free follow-up was still "2 of 3". The model then BOUGHT Load Factor `lf-kestrel-penang-phase2-power-deep-dive` (BUY 20:08:58.8, receipt, proof ok).
  - Coverage then became 3/3. `spentMinor` was 60.
  - This is the S$0 case's opposite. The free follow-up reported `helped: ["r3"]` but coverage v2 stayed 2/3.
- Requested-facts feature: it exists only as a collapsed 11 px disclosure under the answer ("▸ 2 of 3 answered · found free on a focused search"). Expanded, it lists Answered / Answered / Answered rows. It is easy to miss and has no heading.
- UI contradictions:
  1. After the purchase the disclosure still read "found free on a focused search". Expanded it said "3 of 3 answered · found free on a focused search", with S$0.60 spent. That is false.
  2. The highlighted v2 headline answers only the first of three questions (commission date). Grid size (45 MW) and renewables (about 17%) sit in the supports list below the fold.
  3. GAP CLOSED card reads "Share of ... renewables is not stated in any cited evidence. is now covered by Load Factor." It quotes the gap sentence with a trailing "is now covered", which is a garbled double negative.

**S$0 budget, UC2 question.** Setting the budget by mouse click on the popover failed in my harness. The click fell through to the suggestion row under the popover. I set the slider through its input instead, so I could not check mouse drag.
- Ask 20:10:25. A clarify card ("Which angle matters most to you?") appeared about 8 s later and waited for me until 20:10:51. That is a 26 s dead stop in a live demo. PLAN 20:10:56, DONE 20:11:03.
- Result: S$0 spent. Header chip "NotFinancialTimes would buy · S$0.90". Open-gap card: "NotFinancialTimes (S$0.90) would close it. Budget is S$0." Stamp "WOULD BUY" in the decision list. Bottom bar "Would buy 1 · S$0 budget".
- Clear in meaning, but small. The stamp is 10 px, the header chip 11 px, the gap card caption is small blue text. The budget card does say "S$0.00 free sources only". Not legible from the third row.

**UC2 re-check, S$2.** Ask 20:11:45, clarify card again (skipped 20:11:54), PLAN 20:11:59.6, BUY 20:12:05.1, delivered 20:12:11, DONE 20:12:16.5.
- Spent S$0.90 on NotFinancialTimes, verified. It is NotFinancialTimes (not Load Factor), as expected.
- Decision panel at about 25 s under Stage 1x:
  - Duplicate writer names, no titles: Kopi Contrarian x2, NotFinancialTimes x3 (one BUY, two SKIP, all S$0.90), The Fab Floor x2, MarketPulse Digest x2, Load Factor, AlphaLeak x2, Basis Points. You cannot tell which Kopi row is the op-ed. Titles and credibility ("Kopi ... Credibility 0.04 / 2", "Another 'deal of the decade'") only appear in Show work -> Policy.
  - No fallback / fixture / keyword-only chip. Header chips are only "Synthetic corpus · fictional" and the purchase chip. Good.
- Headline versus what was bought: the v2 headline is "...five-year agreement with TSMC for N3P wafer capacity of 24,000 wafers a month from Q3 2027, plus advanced-packaging slots, with a US$1.1 billion prepayment." It does not mention the margin cut. The margin cut appears three cards down under CHALLENGES: "gross margin estimate ... fell to 55.2% from 58.5%" and "cut his target price to NT$410 from NT$520". The money was spent to get that, and the first screen does not show it. The v1/v2 toggle and "Qualifies the free answer" badge hint at it.
- At about 25 s the UI had not yet replayed the buy (it was done at +5 s server time). Right then the open-gap card said "Nothing paywalled was worth buying. The free answer stands.", while the bottom bar said "1 of 12 worth buying" and the budget showed S$0.00 spent. This is false for about 10 s on stage.

## B. Stop-gate verification: **RACE-BUT-SAFE** (new purchases are blocked; the purchase already underway is not cancelled)

| Run | Pace | PLAN | BUY (RESERVED) | STOPPED | Delivered (WIRE 200) / GRANT | Final |
|---|---|---|---|---|---|---|
| 43066797 | Stage 1x | 20:13:38.997 | 20:13:45.195 (+6.2 s) / .209 | 20:13:48.140 (+9.1 s) | 51.498 / 51.988 | spent 40, reserved 0 |
| 9d08c581 | Real | 20:14:43.031 | none | 20:14:47.926 (+4.9 s) | none | spent 0 |
| aee21718 | Real | 20:15:29.935 | 20:15:36.497 (+6.6 s) / .506 | 20:15:40.631 (+10.7 s) | 42.737 / 43.190 | spent 40, reserved 0 |

- Immediately after Stop on run 1 and 3: `spentMinor 0, reservedMinor 40`, intent SUBMITTING. About 6 s later the intent was VERIFIED and `spentMinor 40`. At 20 s the record was unchanged (only SNAPSHOT/TRACE events).
- No BUY, PURCHASE (new) or READ_PAID event was timestamped after any STOPPED event. In both purchase runs the BUY/RESERVED came 3 to 4 s before the Stop request.
- No new purchase was started after Stop was accepted. I did not find a gate violation. A stop at +4.9 s (about 10 s after Ask) was clean: S$0, no purchase.
- Code consistent with this (`server/store.ts`): reserving refuses when `run.stopped` ("Run stopped"), and `claimSubmitting` skips a RESERVED intent if stopped. My run's intent had already passed the claim. I inferred that from the final VERIFIED status. I did not see a claim timestamp.
- **The reviewer's claim is reproducible in effect, not in cause.** The clean-stop window is only about 6 s after the plan card closes (about 11 s after Ask). After that the buy is committed. Clicking at 12 s after Ask hits the purchase already in flight.
- What the UI showed versus the server:
  - Stage 1x: the UI trails the server. At the click the tab title flipped to "Buying S$0.40" after the click. Real pace was not instantaneous either.
  - UI after Stop says "Stopped by you · No new purchases will start" (accurate) but also "Bought · The Fab Floor S$0.40 · Paid · delivered · verified" and "0 of 3 answered · stopped by you".
  - The receipt says "Settled 20:15:43", after the Stop at 20:15:40.
- **Product problem (not a gate violation):** the purchased article was delivered and paid (GRANT, proof ok) but never read. No READ_PAID, no ANSWER v2. The user paid S$0.40 for nothing used. The words "stopped by you" and the paid receipt coexist with no explanation ("purchase was already in flight; article not applied").
- Not verified: whether a Stop landing between RESERVED and the claim ever cancels the intent (I never hit that window; every Stop was after the claim).
- UC3 coverage requirement count changed between runs of the same question (2 requirements, then 3). The question set is nondeterministic. UC3 was not carried to the "caught and refunded" ending (I stopped it by design).
- Pace restored to Stage 1x (`researchagent.pace = stage`). Trust reset after the last run.

## C. Skeptic's list (8 pokes)

1. **"!" info dot** next to the budget. Popover text is "No real money. Simulated on the XRPL Testnet." On a run page with a receipt card it opens BEHIND the "Bought" card and is mostly clipped. Does not hold up.
2. **Receipt "View"**. A clean modal: Item, Publisher, Invoice, Settled 20:15:43, Delivered "Verified ✓", Ledger tx link, Charges 1, Total S$0.40, hatched "XRPL TESTNET · no real value". Holds up. Did not follow the ledger link.
3. **Show work -> Policy.** Formula `value = gap material x addresses gap x P(original) x (0.5 + 0.25 x credibility)`, "Only code purchases", every candidate with title, probabilities, value and verdict. This is the best screen in the product. "Credibility: 0.99 / 2" is an odd scale.
4. **Show work -> Models.** Lists Research · DeepSeek · deepseek-flash; Decide · OpenAI Decisions · gpt-6-luna; Plan · client plan; Search · hybrid; Publisher · local; XRPL TESTNET. There is no "Pay · deterministic code" row, so the Models tab omits the "code pays" half of the pitch.
5. **Citation chip** in the short answer opens an "EXACT PASSAGE" drawer with the sentence highlighted and "SYNTHETIC · Open Records · open on the writer's site · synthetic corpus". Holds up. But the cited passage for UC3's headline repeats "No operator filing cited in this record gives..." three times, which looks scripted.
6. **Writers tab.** At 1440 wide the matrix is cut off: the H / C / T trust columns start at x = 1385 / 1428 / 1469, past the viewport edge (the table scrolls inside its panel). The trust score, the showpiece, is not visible without scrolling. Rows are fine (Proofs 1/0, Challenges, Relevance "claimed 1.00").
7. **Stop button.** See B. "Stopped by you · No new purchases will start" is the right sentence. It leaves out "one purchase already in flight completed".
8. **Budget popover.** Mouse clicks on its labels and track did not select anything and dismissed the popover; clicks fell through to rows underneath (in my harness at least). The budget also stays on the last value (Free) for the next question.

## D. Claims the UI makes that it cannot back

- "found free on a focused search" after a S$0.60 purchase (UC4, both the 2 of 3 and 3 of 3 lines).
- "Nothing paywalled was worth buying. The free answer stands." shown while the server had already bought S$0.90 (UC2, stage-pace lag).
- "0 of 3 answered · stopped by you" next to "Paid · delivered · verified" with no v2: paid evidence delivered and unused.
- "GAP CLOSED ... is now covered by Load Factor" while the v2 headline still answers one of three questions.
- "Proof verified · 6 claims recomputed" matches the PROOF event (`claims: 6, ok: true`); not contradicted. Receipt "Verified" is the same event.
- Pitch positioning: "decision model chooses" is supported (Policy tab, gpt-6-luna labelled). "Code pays" is only stated inside Show work -> Policy. The first screen never says it, and Models omits it. `/health` labels still say "(pending)" for research and decision; run labels do not.
- "WOULD BUY" for S$0 is labelled, but a BUY verdict can sit on a stopped run (AlphaLeak shows BUY with no purchase) with no "not executed" mark.

## E. Top 8 changes by stage impact

1. `Ask.tsx` clarify card: auto-skip after 3 s or default to clarify=never. It cost 26 s of dead air twice.
2. Short-answer card (component file not checked): put the purchased fact (margin cut 55.2% from 58.5%, NT$410) in the v2 headline, and answer all three requested facts.
3. Requested-facts line: make it a visible chip row ("Date ✓  Grid ✓  Renewables ✓ (bought S$0.60)") and fix the "found free" label when money was spent.
4. `Budget.tsx` / `BudgetPopover.tsx`: render "WOULD BUY" and the "$0 budget" state at 14 px+ in the header, and fix mouse selection and z-order of the "!" popover (`InfoDot.tsx`).
5. Run status bar: after Stop, say "1 purchase already in flight, delivered, not applied" and offer to apply it or refund note; the Stop window (about 6 s) should be shown on the plan card.
6. Decision panel: show article title (not just writer) per row, and collapse duplicates; mark the op-ed.
7. `ReputationPanel.tsx`: fit H/C/T columns at 1440 so the trust matrix shows without scrolling.
8. UC1: add a plain sentence on the answer, "Free sources were enough. Nothing worth paying for."; hide or fix the "Nothing paywalled was worth buying" interim text during stage replay.

## Could not verify
- Whether Stop between RESERVED and the claim cancels the intent.
- Mouse drag on the budget slider (only keyboard/input worked).
- UC3 ending, ledger link and "open on the writer's site" targets.
- Exact UI-versus-server lag at Real pace (my tool latency confounds it).
