# U1 · UX polish: a first-time judge's walk through the app

Criterion: **UX & design (10%)**. Date: 7 Nov 2026. Lane: U1 (design sub-agent).

**How it was captured.** The fixture app ran offline (`npm run demo` with `LLM_PROVIDER=fixture`, `DECISION_PROVIDER=fixture`, `SETTLEMENT_RAIL=simulated`, ephemeral ports, isolated ledgers under `.playwright/u1/`, no keys and no spend). The recorded XRPL Testnet key-reveal run came from the browser replay build (`vite --config vite.demo.config.ts --mode browser-demo`). It is the same React UI, replaying a recorded Testnet trace. Playwright drove both at 1280×800, 1440×900 and 390×844 with reduced motion: [`scripts/capture-u1-ux.ts`](../../../scripts/capture-u1-ux.ts) `<app-url> <out-dir> <replay-url>`.

**Not observed:** a live Testnet run from this machine. Its payment card was taken from the recorded replay, and the live payment card looks the same.

Screens are numbered the same way in [`before/`](before/) and [`after/`](after/), one folder per viewport:

`01` first screen with "What's real here" · `02` home · `03` asking (clarify) · `04` plan · `05a` live run, searching · `05` live run, paying/checking · `06`/`06b` completed answer · `07` export · `08` receipt · `09` refund path (UC3) · `10`/`10b` declined run and "Why ▸" · `11` Writers · `12` Settings · `13` onboarding (`?onboarding=1`) · `15` Testnet key-reveal payment card (escrow → key → anchor).

## Ranked critique (by effect on a judge's 30-second impression)

| # | Issue | Where | Why it costs the judge | Status |
|---|---|---|---|---|
| 1 | **Activity marks steps that have not happened as done.** While the run is still "Searching free sources…", the list shows `✓ Searched writers · 0 sources`, `✓ Paying the article`, `✓ Check the article…` and `✓ Updated the answer…`. Upcoming (`todo`) rows were rendered with the same ✓ as finished ones. | `05a`, `05` | It contradicts the money story in the first seconds of every run: a payment shows as done while Payments says "No purchases yet". It is the single most damaging trust signal on screen. | **Fixed** |
| 2 | **The declined state reads like a debug dump.** "Why" shows a double marker (`▶ Why ▸`), raw policy enums (`SKIP_LOW_VALUE`, `SKIP_LOW_TRUST`) in `·`-joined bullet sentences, and the same decline sentence three times. The Payments copy runs two sentences together with no full stop: "…(best 0.08 vs 0.20) 2 paid articles considered; none selected." | `10`, `10b` | Round 5 judges asked for exactly this screen ("tells me exactly why not"). It is the abstention proof, and it looked unfinished. | **Fixed** |
| 3 | **"0.0 s" and "0.1 s" durations.** The run status says `· 0.1 s` and every Activity row says `0.0 s` in fixture mode. | `05`, `06`, `10` | It reads as broken instrumentation. The round 5 report lists "the duration reads 0.0 s" as an open UX item. | **Fixed** |
| 4 | **Citation numbers break the lead finding's line rhythm.** The superscript button stretches its line box, so the last line of the 20 px lead finding drops about 8 px. On mobile, the 44 px tap-target rule makes the drop about 16 px. | `06` at all sizes | The lead finding is the largest text on the page; an uneven baseline there is the first typographic flaw a designer sees. | **Fixed** |
| 5 | **The Testnet payment card tells the story backwards.** The outcome comes first ("Refund · writer-signed…", "Trust score drops", "Fraud proof"), then a floating caption, then a browser-default `<ol>` of the escrow steps, with a tx link wrapping onto its own line. | `15` | "How payments and on-chain transactions are communicated" is the UX criterion's own wording, and escrow → key → verify → refund is the product's best mechanism. | **Fixed** (labels stay in the first viewport) |
| 6 | **The Export menu looks like a form.** It stacks full-width bordered buttons with one black primary. The `researchagent verify receipts.json --ledger` hint wraps mid-command in a 12 px mono run, and "See what changed after the purchase" wraps to two lines. | `07` | Export is how a judge gets the receipts to verify, so it should look like a deliberate product menu. | **Fixed** |
| 7 | **Heavy native disclosure triangles everywhere.** Activity, "Updated with paid evidence", "2 of 2 answered", "Checked against the writer's promises", "Why this article" and "Export" all use `▶`, and they render at different weights. | `06`, `09`, `15` | They are the loudest glyphs on a calm page and make it look like an unstyled prototype. | **Fixed** (one thin chevron; Export becomes a button) |
| 8 | **Settings and onboarding show engine identifiers.** `DEEPSEEK_API_KEY` appears in the Provider select, `LLM API KEY` in the key list, and `simulated` / `xrpl-testnet` / `key-reveal` in the selects. Inputs for 3-digit cents run 1,300 px wide. The first-run primary action ("Confirm caps and start") is styled as a secondary button, and the uppercase eyebrows plus a 28 px panel title compete with the page H1. | `12`, `13` | This is the owner surface #386 just landed, and it reads as a config file rather than a product. | **Fixed** (display names only; stored values unchanged) |
| 9 | **The answer's loading state is blank.** Before the first draft, the page shows only an "Answer" caption above empty space, because the skeleton bars matched the paper colour. | `05a` | For the first 1–3 s of every run the main column looks frozen. | **Fixed** (static bars, no shimmer) |
| 10 | **The first-run "What's real here" card is large and detached.** It no longer covers Ask (fixed earlier), but its 20 px title and loose rows make it 385 px tall. At 1280×800 it covers most of the example rows, and it floats far from the chip that opens it. | `01` | It is the first thing a judge reads, and it hides the examples they would click. | **Improved** (compact: 330 px; placement logic unchanged) |

### Also noted, not changed in this PR

- **The lead finding repeats the only "Unclear" claim word for word** (`06`). Hiding it would hide that the lead's stance is Unclear, which is an honesty problem. The fix belongs in answer selection (Lane K / `shared/lead-finding.ts`), not styling.
- **The receipt uses an ambiguous locale date**, `07/11/2026, 4:36:59 pm` (`08`). It should be `7 Nov 2026, 16:36:59`. This is small, but receipts are evidence.
- **Writers table** (`11`): the `Articles` column is all `—`, and trust shows as raw decimals with no scale. It needs data, not styling.
- **"Why this article" still shows in the side column on a declined or not-yet-bought run** (`05a`, `10`). Its copy should follow the run state.
- **The header "Run" tab stayed highlighted on Settings** (`12`). Fixed with a one-line `aria-selected` change.
- **Mobile header:** the 44 px environment pill and the `⌕` command glyph read as two heavy buttons (`390x844/01`).
- **"1 payments ›" on mobile** (`390x844/06`). Fixed.

## What changed (all presentation; no spending, policy, decision, anchor, verifier or payment code)

| Item | Files | Guard |
|---|---|---|
| Activity: upcoming steps get a `·` mark, muted text, an SR-only "Next:" prefix and plan wording ("Pay the writer, only if an article helps"). The step in progress uses the present tense until its result exists. ✓ appears only after the event. | `src/components/RunActivity.tsx` | `tests/u1-ux.test.tsx` |
| Durations: the run total reads "under 1 s" for sub-second runs; step timings under 0.1 s are omitted. | `RunActivity.tsx` | `tests/u1-ux.test.tsx`; `tests/r5-k.test.tsx` keeps the `5.0 s` case |
| Decline: one summary line, then "Why ▸" opens rows of article · plain-word verdict · `value 0.08 vs 0.20` · reason. The enum codes stay in Show work → Policy. The Payments copy says it once: "Nothing bought. 2 paid articles considered; none selected." | `src/components/Answer.tsx`, `SpendPanel.tsx` | `tests/u1-ux.test.tsx`; `tests/e2e.spec.ts` now asserts "Below the value bar" instead of `SKIP_LOW_VALUE` |
| Key-reveal card order: status → escrow steps (numbered, tx links right-aligned) → writer-signed refund and fraud proof → promise checks. Every label is kept, and the "key-reveal escrow · no real value" caption moves *up*. | `src/components/PaymentRow.tsx`, CSS | `tests/u1-ux.test.tsx` (order); `15` before/after at 1280×800 shows the labels in the first viewport |
| Citations: superscript offset without stretching the line. Mobile keeps a 44 px invisible hit area. | CSS | `06` before/after |
| Disclosures: one thin chevron for every `details`. Export is a bordered button that opens a menu of rows, with a wrapped copyable verify command. | CSS | `07` before/after |
| Settings and onboarding: human option and key names (`value` attributes unchanged), fields max 420 px, one primary action, sentence-case eyebrow, 20 px section titles. | `src/components/OwnerSettings.tsx`, CSS | `tests/u1-ux.test.tsx`; `tests/owner-settings-ui.test.tsx` unchanged and green |
| Loading skeleton visible (static). Compact "What's real here" card. | CSS | `05a`, `01` before/after |
| Header tab not selected on Settings; "1 payment ›" plural on mobile. | `src/App.tsx`, `MobileSpend.tsx` | `tests/u1-ux.test.tsx` |

All CSS sits in one block at the end of `src/styles.css`, headed "U1 polish (7 Nov)". Deleting that block reverts the styling.

## Before / after

| Screen | Before | After |
|---|---|---|
| Live run, searching (1440) | ![](before/1440x900/05a-live-search.jpg) | ![](after/1440x900/05a-live-search.jpg) |
| Live run, paying (1440) | ![](before/1440x900/05-live-run.jpg) | ![](after/1440x900/05-live-run.jpg) |
| Declined · Why (1440) | ![](before/1440x900/10b-declined-why.jpg) | ![](after/1440x900/10b-declined-why.jpg) |
| Completed answer (1280) | ![](before/1280x800/06-answer.jpg) | ![](after/1280x800/06-answer.jpg) |
| Export (1440) | ![](before/1440x900/07-export.jpg) | ![](after/1440x900/07-export.jpg) |
| Testnet key-reveal card (1280) | ![](before/1280x800/15-testnet-key-reveal-done.jpg) | ![](after/1280x800/15-testnet-key-reveal-done.jpg) |
| Settings (1440) | ![](before/1440x900/12-settings.jpg) | ![](after/1440x900/12-settings.jpg) |
| Onboarding (1440) | ![](before/1440x900/13-onboarding.jpg) | ![](after/1440x900/13-onboarding.jpg) |
| First screen (1280) | ![](before/1280x800/01-first-screen.jpg) | ![](after/1280x800/01-first-screen.jpg) |
| Mobile answer (390) | ![](before/390x844/06-answer.jpg) | ![](after/390x844/06-answer.jpg) |
| Mobile decline (390) | ![](before/390x844/10b-declined-why.jpg) | ![](after/390x844/10b-declined-why.jpg) |

Every other screen and viewport sits beside these in `before/` and `after/`. The before and after runs use the same fixture questions and the same seeded app, so the run histories in the sidebar differ only by order.
