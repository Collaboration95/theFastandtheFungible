# UI critique: "would a real company ship this?" (7 Oct)

A Sonnet reviewer read the UI code on `v1.2-tweaks` and the screenshots of the current app. Line numbers are in `src/` and refer to the tree at that time. Nothing here is applied yet; tick items off as they land.

## Top 10 to fix first

1. **Home "how it works" cards** (`components/Ask.tsx:61-65`): "An LLM writes", "A decision model chooses", "Code pays", "Text in an article can't spend". They name internals, not benefits; the last line answers a prompt-injection question no visitor asked. **Remove all three**; the hero subline already says it.
2. **Budget picker two-liner** (`Ask.tsx:8-11, 53, 57`): "Up to S$2.00, at most S$1.00 per source." / "It buys only sources that clear the bar." / "Your budget is the only spending authorisation." Repeats the coin, jargon ("clear the bar"), a security principle as copy. **Replaced by the budget slider** (7 Oct).
3. **Run-bar clock** (`components/RunTape.tsx:94`): shows "00:00.3" after a ~30 s replay (server timestamps), so it looks broken. **Remove.**
4. **Disabled "Run finished" button** (`RunTape.tsx:95`): one control with four labels ("Run finished", "Skip to the end", "Stop buying", "Stopped · no new purchases"). **Nothing once the run is over; "Stop" while live; "Skip to the end" moves to Presenter.**
5. **Decision rows** (`components/DecisionPanel.tsx:28-35`): name, price, bar, "covers 90% · original 90% · cred 1.0 · value 0.47", a reason line, a rotated stamp, a WriterChip, and the formula under the list. **Row = name, price, stamp**; probabilities, formula, chip and reason go to Show work → Policy.
6. **Purchase card** (`components/Purchase.tsx:47-68`, `ProofBadge.tsx:10`): "402 / Pay / 200 / Proof" HTTP diagram, scrambling "manifest root e0bd… ✓ match", "POST /challenge with the passage and its salt", a "✗ lead-times-dated" slug pill. **One line: "Paid S$0.25 · delivered · verified"**; "✗ claim failed"; "Challenged"; the hash to Show work.
7. **Toasts repeating the screen** (`App.tsx:157, 163, 174`): "Bought NotFinancialTimes / S$0.90 · proof verified · …", "Your answer is ready" on the run itself. **No toast for events already on screen**; keep the off-screen "Go back to chat", the failure with Retry, and the fallback toast.
8. **Writers tab** (`components/ReputationPanel.tsx:55-57`): a three-sentence explainer and 8 columns in a 372 px panel (clipped). **Publisher, trust bar + number, status**; delete the paragraph; one "Synthetic writers" label instead of a SYNTHETIC chip per row.
9. **Sources strip** (`components/Sources.tsx:63-72`): avatar stack + "+10" duplicating the named pill, an amber "search · keyword only (embeddings unavailable)" chip. **Delete the stack and the search chip** (Show work → Models; the header chip covers real fallbacks). Keep "Synthetic corpus · fictional".
10. **Budget card numbers** (`components/Budget.tsx:40`): "S$1.45 left of S$2.00" over "spent S$0.55 · held S$0.00 · left S$1.45 · refunded S$0.30 · net S$0.25" (left repeats, held is usually 0, 1.45 next to net 0.25 doesn't add up). **"Spent S$0.25" plus "S$0.30 refunded" only when non-zero**; the headline restores refunds.

## Everything else

**Home**
- `Ask.tsx:45` "UC1 · What did the Bank of Japan change at its l…": internal id, mid-word cut, two rows. Use "Bank of Japan decision", "Kestrel–TSMC outlook", "Malaysia packaging lead times".
- `Ask.tsx:57` + `styles.css:50`: hazard-stripe settlement chip. Same text, plain outlined chip.
- `Ask.tsx:54` "Ask ↵": drop the ↵ key hint.
- `Ask.tsx:58` "Tell me when it's done" sits in the composer permanently. Show it only once a run is live.
- `ActionModal.tsx:43, 49` "I'll search 5 writers for:" + "Starts in 5 s. Enter = go · Esc = cancel" repeat the drain bar and buttons. "Searching 5 writers for: …", a "Start · 5s" button, no hint line.
- `App.tsx:216, 237` "The API is unavailable. Start the demo processes, then ask again." is a dev instruction. "Can't reach the server. Try again."

**Run screen: header and question**
- `App.tsx:290` "Question · Budget S$2.00 · asked 09:58 pm": labels the heading, repeats the budget card. Remove.
- `Layout.tsx:10` crumb "Run | <question>" repeats the h1 and the sidebar. Remove.

**Run screen: sources**
- `Sources.tsx:68` "8 read 7 skipped" → "7 not bought".
- `Sources.tsx:80` + `WriterChip.tsx:37-43`: each card repeats name ↗, domain, SYNTHETIC, "PAID S$0.30", "T new". Keep SYNTHETIC only.
- `Sources.tsx:62` and `RunTape.tsx:36` both say "Searching publisher profiles…". "Searching…" once.

**Run screen: answer**
- `Answer.tsx:69, 75, 79`: version shown three times. Drop the label chip.
- `Answer.tsx:78` + `styles.css:240`: rotated "QUALIFIES / impact of 1 purchase" stamp plus an explanation line. Flat tag "Qualifies the free answer".
- `Answer.tsx:79` "DeepSeek · deepseek-chat · synthetic corpus": third "synthetic", a model name. Remove; show the provider only on a fixture fallback.
- `Answer.tsx:113-119`: "Next: a decision model prices sources…", "Pricing paywalled sources that might close it →", "Bought X. Rewriting the answer with it →", "Settled. Checking the delivery…" narrate what the run bar says. Keep outcomes only: "Nothing paywalled was worth buying. The free answer stands."
- `Answer.tsx:108` "new citations 5, 6": drop.
- `ReportButton.tsx:11` "Writing report · findings, changes, receipts" → "Preparing PDF…"; line 13 drops the ↓.

**Run screen: right panel**
- `Budget.tsx:39` "Free-only run · no purchases authorized. Decisions are still shown." / "nothing can be bought" → "Free sources only."
- `Budget.tsx:42` "Budget invariant violated: spent plus reserved exceeds authorization." → "Spending went over budget."
- `DecisionPanel.tsx:20-23` "Round 1 · what's worth buying" → "Worth buying"; drop "90% material" and the "bar 0.20 … value 0.8" axis.
- `DecisionPanel.tsx:57, 63` "Round 2 · anything else?" (quip); "Nothing clears the bar, so the run stops. S$1.45 stays unspent." → "Nothing else worth buying. S$1.45 unspent."
- `format.tsx:14-26`: eight rotated stamps with reasons like "failed a proof check (honesty 0.18, under 0.50): quarantined, never bought or cited". Collapse to Buy / Skip / Blocked, flat, reason in a tooltip.
- `Purchase.tsx:49` "S$0.90 · simulated" under Pay: delete (the budget chip carries it).
- `Purchase.tsx:68`: SIMULATED twice in one row. Keep one.
- `Purchase.tsx:70` "Paid, but the delivery failed. Your receipt is kept. Retrying fetches the same paid copy and can't charge you again." → "Paid, but delivery failed. Retrying won't charge you again."
- `Purchase.tsx:72` "Receipt x402-7…48EC8 · charged once · tx ↗ · View" → "Receipt · View".
- `Ledger.tsx` (side panel, Testnet only): "S$0.01 = 1,000 drops (fixed demo rate)", "Received from ResearchAgent", a wallet table; also in Show work. Remove it from the side panel.

**Run screen: run bar**
- `RunTape.tsx:92` "Stage pace · …": internal term. "Replaying · ".
- `RunTape.tsx:93`: step labels truncate ("Answ…", "Rewr…") when the sidebar is wide. Show the current step name only, or don't truncate.
- `RunTape.tsx:36-68`: "402 → quote S$0.90", "Holding S$0.90", "1 of 8 clears the bar", plus "Reputation" and "Manifest dropped" as the current step. "Quoted S$0.90", "1 of 8 worth buying"; keep trust and manifest steps out of the now-line.

**Sidebar**
- `Sidebar.tsx:44` "Remove from history? Its receipts stay in the ledger." → "Delete this question?"
- `Sidebar.tsx:50` tooltip "Available when the run ends, or after Stop buying" → "Finish or stop the run first."

**Toasts and error banners**
- `App.tsx:75` "Connection interrupted. The server preserves the run and reconnects automatically." → "Connection lost. Reconnecting…"
- `App.tsx:132-133` "Report ready" repeats the download that just happened; fallback "The PDF engine wasn't available. Use your browser's Print…" → "Opened for printing. Use Print → Save as PDF."
- `App.tsx:134, 140` "Report generation failed. Your last answer and receipts remain available; try again." → "Couldn't create the report. Try again."; "Delivery could not be retried. The charge remains recorded; no new purchase was made." → "Retry failed. You weren't charged again."
- `App.tsx:166` "Showing a labelled fixture answer built from the same verified passages." → "Showing a fixture answer instead." (stays visible).

**Writers tab**
- `ReputationPanel.tsx:41` "claimed 0.90 · Brier 0.12 (n 4)": to Show work.
- `ReputationPanel.tsx:56` "Newcomers start at H 0.80" → "No history yet."
- `WriterChip.tsx:29` "T 0.80 · active" on every chip: status only when not active; drop the "starts at H 0.80" tooltip.

**Passage drawer**
- `Passage.tsx:29` "NotFinancialTimes · v1": drop the version. "Verified delivery · full source" → "Purchased"; "Free source · full text" → "Free".
- `Passage.tsx:31` "Locked. Premium text stays with the publisher until this run has a verified delivery grant. These bars are placeholders, not the article." → "Locked · S$0.30 to read" (no placeholder bars). "Not read yet. Full text has not been retrieved yet." → "Not read yet." "This citation could not be verified. No substitute passage is highlighted." → "Couldn't verify this citation."
- `Passage.tsx:32` trailing "synthetic corpus": remove. `Passage.tsx:27` "Esc ×" → "×".
- `Receipt.tsx:20-23` "Delivered: manifest root a1b2… ✓" → "Verified ✓"; "Charges 1 (retries can't add more)" → "Charges 1".

## Patterns to stop

1. **Narrating the mechanism.** Each hard gate became a user-visible sentence ("the budget authorises", "text can't spend", "retries can't charge"). A sentence that proves a gate to a reviewer belongs in Show work.
2. **Explaining a control under the control.** The budget consequence line, the plan-card key hints, the Writers explainer. The label must stand alone; if it can't, use a tooltip.
3. **One event, four surfaces.** A purchase is a toast, a panel, a run-bar line, a gap-card line and a sources pill. One surface per event; a toast only when the event is off screen.
4. **Code vocabulary in user text.** bar, cap, material, H/C/T, Brier, manifest root, 402, quarantined, UC1, claim slugs, "v1". If a customer wouldn't say it, it doesn't ship.
5. **Labels per item instead of per list.** SYNTHETIC ×16, "T 0.80 · active" ×8, SIMULATED ×3. Label the container once; badge only the exceptions.
6. **Theatre as chrome.** Rotated stamps, hazard-stripe chips and a scrambling hash are all equally loud, so nothing reads as important. Keep motion for the one event that matters: the purchase.

## Constraints kept

The settlement label, the fictional-content label and a visible fixture fallback stay on screen (hard gate 5); the critique only quiets their presentation. Show work (`W`) and the Presenter menu (`.`) are back-office views and were judged leniently.

## Applied / held back (8 Oct)

Applied: every item above except the ones below. Where an item was applied in part, the rest is listed here too.

| Item | Status | Why |
|---|---|---|
| Decision rows: drop the writer chip | Kept, trust only (`T 0.80`; status when not active) | FINAL-PUSH §7: each writer gets a chip on its search hits and decision rows |
| Decision rows: drop the value bar | Kept | v1 motion language (§6, D13); the axis text and threshold labels are gone |
| Stamps → Buy / Skip / Blocked | Buy, Would buy, Rewrite, Skip, Blocked; flat, reason in tooltip | UC2 shows the rewrite skip and UC3 the low-trust block (§11); Would buy is the S$0 label |
| Sources: delete the search chip | Hidden when hybrid; amber chip stays on keyword-only | Gate 5 / D2: search shows `hybrid` or `keyword only` |
| Source cards: SYNTHETIC only | SYNTHETIC, the writer link (when the writer differs from the publisher) and trust stay | D17/D21 attribution; §7 chips on hits |
| Writers tab: publisher, trust, status only | Paragraph, per-row SYNTHETIC chip and `(n 4)` removed; the proofs / challenges / relevance / H / C columns stay | D6 and §7 specify the matrix columns and say trust is public |
| Passage drawer: drop "synthetic corpus" | Kept | Gate 5: the article text itself is the synthetic content |
| Budget: headline restores refunds | Not done: shows `spent` (gross) and `refunded` | The refund doesn't restore the budget (gate 2: the budget is the only authorisation) |
| Action modal: no hint line, "Start · 5s" | Hint line gone, copy "Searching N writers for:"; the button stays "Go now" | D8 names Go now / Edit / Cancel; the e2e and a11y specs click it |
| "Tell me when it's done" only while live | Moved to Settings → Notifications | Needed before the run starts |
| Stop button | Only while live; Skip to the end is in Presenter | |
| Run-bar step labels | Removed (title tooltip + now-line) | Truncated at any width |
| Ledger in the side panel | Removed; still in Show work → Ledger | |
| Toasts | "Bought…" gone; run toasts show only off the run's screen | Delivery-failed (Retry) and fallback toasts kept |

Not run: Playwright e2e/a11y (orchestrator only); `tests/e2e.spec.ts` and `tests/a11y.spec.ts` still click "Go now", which is unchanged.
