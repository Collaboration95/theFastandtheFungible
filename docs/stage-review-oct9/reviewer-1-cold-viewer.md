> **Setup caveat.** This reviewer ran before `CF_BACKUP=1` was set. The primary Cloudflare account's daily free quota was spent, so search was keyword-only and the header showed "Fixture fallback · Search". Anything about that chip is a setup artifact, not a product defect. The other findings stand; reviewers 2 and 3 ran on the backup account and saw no chip.

# Cold-viewer audit of ResearchAgent (live, 127.0.0.1:5100)

Run at 1440x900, with a glance at 1280x720. Screenshots were taken about every 3 s, so timestamps are good to about +/-2 s. I could not verify native `title` tooltips (they do not render in the pane). That includes the yellow "!" info dot, whose DOM title is "XRPL TESTNET · no real value". I did not test S$0, Stop, challenge/quarantine, or a clarify chip.

## Run 1: off-topic ("What time is it right now, and what are you?")

- **0 s:** Submit. The button says "Starting…" and nothing else changes.
- **~4 s:** A small plan card appears above the composer: "Searching every listed writer for: current time now, what is an AI assistant", with a drain bar, Edit, Cancel and "Go now". No clarify step appeared this time.
- **~9 s:** The run page opens with skeleton lines.
- **~15 s:** An answer streams in: "The Malaysian packaging record is dated 30 September 2026 and likewise provides no current time or timezone." The word "likewise" has nothing to refer to. The page also lists 6 "CHALLENGES" (each saying some irrelevant record has no current time) and "OPEN GAP: The current time… is not stated anywhere in the evidence."
- **~25 s:** "Done · S$0.00 of S$2.00 spent".

It does not refuse, clarify or say "I'm an AI assistant", and it never answers "what are you?". It does not look broken, and it did not error. It does look strange.

Strong "it's live" signals:
- The plan query is rewritten from my own words.
- The answer text is visibly unscripted.
- The page shows 28 sources, then a "Considered 12 paywalled sources" panel full of irrelevant articles.

Weak "it's live" signals:
- A permanent amber "Fixture fallback · Search" chip sits top-right on every screen, including home.
- A second amber chip says "search · keyword only (embeddings unavailable)".
- A skeptical engineer reads both as "canned".

## Run 2: UC2 (Kestrel/TSMC), clicked from the "Try one" row

Clicking the row only fills the box; you still press Ask.

**Timeline (t=0 is the Ask click):**
- 0-5 s: Dead. "Starting…" with no motion.
- ~5 s: A clarify card appears: "Which angle matters most to you?" with chips "capacity allocation / pricing & margins / delivery timeline" and a Skip link. The composer jumps down about 60 px when it appears.
- ~9 s: I clicked Skip, and the plan card appeared: "Searching every listed writer for: Kestrel Semiconductor TSMC deal analyst outlook, Kestrel Semiconductor TSMC deal capacity pricing timing".
  - It has a 5 s drain bar and Edit / Cancel / Go now.
  - A stale "Your answer is ready / Go back to chat" toast from run 1 sat at the bottom the whole time and competed with it.
- ~14 s: Run page, skeleton lines, step "Search · 16 sources found".
- ~19 s: The free answer v1 streams in with a blur-in. The step reads "Write answer v1 · 8 cited claims".
- ~22 s: "Search again · 6 new free sources".
- ~25 s: "Choose what to buy · 1 of 12 worth buying". The "Worth buying" decision panel appears, with a filled bar on NotFinancialTimes.
- ~28 s: Buy. A "NotFinancialTimes · buying…" pill appears, the budget drops to S$1.10, and the card reads "Bought · NotFinancialTimes S$0.90". The decision list collapses into a flat price list.
- ~31 s: "Paid S$0.90 · delivered · verified". Step: "Proof check · 14 claims recomputed".
- ~34 s: Answer v2 appears with yellow highlight, a "Qualifies the free answer" tag, v1/v2 toggle, "Compare v1 → v2", and a green "GAP CLOSED … Bought for S$0.90" card.
- ~38 s: "Done · S$0.90 of S$2.00 spent".

Total is about 38 s from the Ask click, or about 24 s from the run page opening.

**Dead moments:** 0-5 s (the "Starting…" button), and the 5 s modal if the presenter does not talk over it. The 5 s modal is not an "action modal". It is a small card above the composer with the plan text, and it never mentions the budget.

## A. Clutter audit (final-answer moment, 1440x900)

I count about 60 distinct things on screen:
- sidebar: New question, 2 history rows with "…" menus, Settings
- header: the "Fixture fallback" chip
- Run/Writers tabs
- budget card: headline, "cap S$1.00 / source", bar, "spent S$0.90", the yellow "!"
- Bought card, with a receipt link
- decision list: 12 rows, each with a name, price, stamp and "T 0.80"
- sources strip: "26 sources / 14 read / 11 not bought", a purchase pill, the amber chip, "View all", and "Synthetic corpus · fictional"
- answer card: v1/v2 toggle, tag, 2 buttons
- gap card
- 8 SUPPORTS rows with NEW badges and citation chips
- bottom bar: 9-segment stepper, Show work

**A cold viewer cannot parse:**
- "T 0.80" on every decision row.
- "Worth buying · OpenAI Decisions · gpt-6-luna".
- The decision list has no article titles. Kopi Contrarian appears 3 times, NotFinancialTimes 2 times, MarketPulse Digest 2 times, AlphaLeak 2 times. It looks like a duplicate-row bug.
- The 9-segment stepper has no labels.
- The yellow "!" does nothing visible on click.
- The citation chips "9, 10, 11…" skip numbers (they start at 9 after 1).
- The "SYNTHETIC writers" chip and "claimed 0.96 / H C T" columns on the Writers tab.

**Tiny or low contrast:** the mono 9-10 px labels ("spent S$0.90", "cap S$1.00 / source", "T 0.80", "OpenAI Decisions"). They will not survive a projector.

**Distracting:**
- The decision panel re-lays out when the buy happens: the bars and stamps vanish and the list collapses.
- The sources strip reflows to two lines.
- Blur-in streaming text.
- The "Nothing paywalled was worth buying. The free answer stands." line is visible under the gap at ~25 s, while the same screen shows a BUY bar filling. It disappears once the buy lands.

**Cut off at 1280x720:**
- The Writers table clips the H/C/T/Status columns.
- The GAP CLOSED card is below the fold, but the v2 answer and Compare button are above it.
- The decision list needs an inner scroll.

## B. See timeline above.

## C. High points (presenter order)

1. **Budget slider and "Try one" chips on home** (0 s). It is clean and states the product ("Ask a question. Give it a budget.").
2. **The decision list at ~25 s.** One filled bar on NotFinancialTimes against grey SKIPs is the "model judged what is worth buying" moment. Point at it before the buy collapses it (about 3 s window).
3. **The Budget card ticking S$2.00 to S$1.10** with "Paid S$0.90 · delivered · verified". Money visibly moves.
4. **Receipt "View".** The paper receipt (Item, Publisher, Invoice, Settled, "Delivered Verified ✓", a ledger tx link, "Charges 1", Total S$0.90, and a hazard stripe reading "XRPL TESTNET · no real value") is the best proof object in the app.
5. **v2 with yellow highlight and "GAP CLOSED … Bought for S$0.90"**, then toggle v1/v2. This is the payoff, and it reads without narration.

## D. Do not point at

- **The "Fixture fallback · Search" chip, the "keyword only (embeddings unavailable)" chip, and the Models tab.** They undermine the "live" claim. The Decide model reads "OpenAI Decisions · gpt-6-luna", not Cloudflare Clef, which contradicts the Clef/calibration pitch. Do not open Show work → Models on stage.
- **The Writers tab.** It is clipped, shows 0/0 stats and "claimed 0.96" for AlphaLeak with no explanation, and has no visible trust story yet.
- **The decision list's duplicate names.**
- **The v2 headline.** It says "…and no margin guidance" and does not state the analyst outlook (margins cut to 55.2%, target price cut). The paid insight is only in the SUPPORTS list below the fold.
- **The "GAP CLOSED" sentence.** It reads "No analyst ratings… appear in the evidence. is now covered by NotFinancialTimes." The old gap text is spliced with a fragment, which is grammatically broken.
- **Show work → Policy.** It has the real reasoning (probabilities, credibility, SKIP_LOW_VALUE), but the formula text is dense and shows "Credibility 0.91 / 2".
- **The stale toast** and the yellow "!".

## E. Did the random prompt prove "live"?

Partly. The off-topic answer proves it is not a replay, but it also proves the system hallucinates relevance: a non-answer built from irrelevant records with 6 challenge rows. It never says "I'm an assistant".

To make it stronger and safer:
- Add an audience-supplied question that is still in-domain, such as a different Kestrel angle ("what do analysts say about Kestrel's K2 timing?"). Better: a topic the writers cover that is not on the "Try one" list.
- Gate off-topic with a one-line refusal ("No paywalled expertise covers this").
- Show a live provider line (model name and latency) on the run header, and do not show the fixture chip during the live proof.
- Add a visible timestamp or run ID.
- Never use a question whose honest answer is "nothing found" as the opener.

## F. Top 8 changes (ranked)

1. Remove or hide the "Fixture fallback · Search" header chip and the "keyword only" chip when live; if fallbacks are real, fix the embeddings so they are not on screen.
2. Decision list: show the article title (not just the writer) and drop the "T 0.80" column. Do not collapse it on purchase, and keep BUY/SKIP stamps frozen for the whole run.
3. Put the analyst outlook (margin cut, target price) in the v2 headline; the short answer currently carries none of what was bought.
4. Fix the "GAP CLOSED" sentence composition.
5. Remove the contradictory "Nothing paywalled was worth buying" line while a buy is pending.
6. Plan card: label it "Plan · starts in 5 s", include the S$2.00 budget, and make it larger. Suppress stale "Your answer is ready" toasts.
7. Fill the 0-5 s dead time after Ask ("Understanding your question…" or a progress label), and don't shift the composer when the clarify card appears.
8. Writers tab: reduce it to name, a trust bar and a status, and fix the 1280px clipping. Show a bold text label on the 9-segment stepper.

## G. Bugs, contradictions, console

- Console: no errors, only Vite and React debug lines.
- Source counts shift during a run (16 to 26, and 16 to 28 on run 1), which is OK but unexplained.
- On run 1, "28 sources / 16 read / 12 not bought" (28 = 16 + 12) is consistent, but "Considered 12 paywalled sources" with duplicate names is not self-explanatory. On run 2, "26 sources / 14 read / 11 not bought" does not sum, and the panel says "Considered 12". That is a discrepancy of 1 (the bought one) between "11 not bought" and 12 considered, which is fine, but 14 + 11 + 1 = 26 is only implied.
- The NotFT price (S$0.90) is the same as the per-source cap minus S$0.10, so a lower budget quietly makes UC2 impossible.
- Re-opening a past run flashes a blank answer card for about 1 s.
- "Credibility: 0.91 / 2" in Policy uses an unexplained "/ 2" scale.
