# UX direction: the sledgehammer redesign

Status: direction and spec, 3 Nov 2026. No product code changed in this PR. Build work is filed as two `ux` issues (see [§12](#12-build-plan)).
Criterion served: **UX & design (10%)**: "clarity, usability and polish end to end, especially how agent actions, payments and on-chain transactions are communicated" ([JUDGING-CRITERIA](../JUDGING-CRITERIA.md)).
Supersedes the visual parts of [contracts/DESIGN.md](../contracts/DESIGN.md) where they disagree (that file is updated to point here). Hard gates are untouched.

The owner's verdict: "SIMULATED everywhere, too many anti-patterns, and stuff a 24-year-old who just learnt motion graphics with Claude would think is cool." The standard is a sleek YC company. We take Linear's density, Vercel's calm status pages, Stripe's payment detail and test-mode pill, Mercury's tabular money, Ramp's receipts-as-rows, Raycast's palette and Arc's restraint.

**How this was gathered.** The app was run offline (`make run OFFSET=1500`, fixture mode, simulated settlement, no keys sent anywhere, no spend) and driven with Playwright at 1440×900 and 390 wide. Screens captured: home, clarify, 5 s plan, running (search → decide → pay → verify), done for UC1, UC2 and UC3 (refund), receipt, writers, Show work, ⌘K palette, settings, budget popover, an injected API error, a fault-injected delivery failure, mobile, the 50-page PDF, record mode, the explainers site and the README. **Not observed:** live Testnet mode and live-model fallbacks (no keys, no spend). Those states are specified from the code (`src/components/Modes.tsx`, `Purchase.tsx`, `Sources.tsx`). Screenshots live in [`before/`](before/).

---

## 0. The verdict in five lines

1. **One environment indicator, in the header.** "Demo · simulated payments" or "XRPL Testnet · test funds". Everything else that says SIMULATED, fixture or synthetic is deleted from the working screens and kept only on receipts, exports and where a judge could be misled.
2. **The money is the hero, and it is plain.** One Spend panel with a net amount, a two-tone bar and a ledger-style Payments list. Pay → verify → refund read as rows changing status in place.
3. **One neutral system.** Ink on paper, Geist only, one accent (ink), semantic colours for state only. One radius scale, one type scale of seven sizes, no pills except the environment indicator.
4. **Motion has an allowlist of ten entries, all ≤ 240 ms** (plus the 5 s plan countdown). 30 keyframes become four. #262's flying coin is not built.
5. **Plain English.** No `extractive-fixture`, `scope-fixture`, `UC2`, `GAP CLOSED`, `InvoiceID = original tx`. Engine vocabulary lives in Show work only.

---

## 1. Anti-pattern audit

Screenshot refs are files in [`before/`](before/). Counts come from the live DOM and `src/styles.css` (753 lines).

### 1.1 Label spam

| # | Instance | Evidence |
|---|---|---|
| L1 | **8 environment labels on one finished-run screen** (`simulated`×5, `fixture`×3); **10 with the receipt open**; 3 on the empty home. Measured with a text scan of the visible DOM. | [12](before/12-uc3-done.jpg), [14](before/14-receipt-refunded.jpg), [01](before/01-home.jpg) |
| L2 | Header: yellow `SIMULATED` pill **and** `Fixture research` pill, permanently, next to the nav. | [01](before/01-home.jpg) |
| L3 | Composer: a second `SIMULATED` pill beside the budget picker, before anything has happened. | [01](before/01-home.jpg) |
| L4 | Budget card carries a third `SIMULATED`; each payment card header carries a fourth (`S$0.90 · SIMULATED`); a refund adds a fifth chip. | [11](before/11-uc3-refund.jpg), [12](before/12-uc3-done.jpg) |
| L5 | Receipt says simulated four times: stamp icon, `Total S$0.30 · SIMULATED`, a hazard-striped band `SIMULATED SGD · no real funds`, plus the page behind. | [14](before/14-receipt-refunded.jpg) |
| L6 | Under every answer: `fixture · extractive-fixture`; over the decisions: `fixture · metadata-fixture`; in sources: `Synthetic corpus · fictional` and `search · keyword only (embeddings unavailable)`; in writers: `SYNTHETIC writers`; settings slider: another `SIMULATED`. | [07](before/07-done-uc2.jpg), [08](before/08-decisions-open.jpg), [09](before/09-sources-open.jpg), [15](before/15-writers.jpg), [18](before/18-settings.jpg) |
| L7 | The run bar says `Refunded S$0.30 · InvoiceID = original tx · SIMULATED SGD · no real funds` in a 9 px strip. | [11](before/11-uc3-refund.jpg) |
| L8 | The explainers site walkthrough has a pill reading `LIVE RUN` beside `REPLAYED FROM ITS EVENT LOG`. These contradict each other, which is a gate-5 problem, not a style one. | [29](before/29-site-walkthrough.jpg) |

### 1.2 Decorative motion

`src/styles.css` defines **30 keyframes**, **15 uses of a spring easing with overshoot** (`cubic-bezier(.34, 1.56, .64, 1)`), **6 infinite animations**, and staggered choreography via `animation-delay: calc(var(--i) * …)`.

| # | Instance |
|---|---|
| M1 | `pop` (scale .94 with overshoot) on nodes, pills, citations, cards, the popover and the modal; the modal also has a blue `rgba(31, 47, 208, .4)` glow. |
| M2 | `stamp` / `stampbig` (rotate-and-slam) on BUY / SKIP stamps, delayed `calc(var(--s) * 480ms + 1.5s)`: the decision table reveals row by row for several seconds. |
| M3 | `deal` (cards dealt with 70 ms stagger), `word` (per-word text reveal), `draw` (pen path draw), `sweep` (yellow highlighter sweep, delayed 1.2 s), `rise`, `slideup`, `slidein` on every panel and claim. |
| M4 | `ra-shake`, `shake`, `ra-wiggle-out`, `ra-tilt`, `ra-hop`, `flash`, `dropflash`, `drain`: character animation with no state meaning. |
| M5 | `Roll.tsx`: odometer digits on amounts. |
| M6 | Six `infinite` loops (pulse, shimmer, spin, …) running at once during a run. |
| M7 | A purse and receipt "cast" icon whose pose changes with state ([budget card](before/05-running-buying.jpg)). |

### 1.3 Badge and pill overuse

About ten pill species with different radii, weights and colours: `.ra-chip` (7 variants), `.ra-stamp` (7), `.ra-tag` (5), `.ra-impact` (4), `.ra-pill` (3), `.ra-delta`, the v1/v2 toggle, `NEW`, `OPEN GAP` / `GAP CLOSED`, numbered citation chips, status words in boxes (`active`), `BUY` / `SKIP` / `REWRITE` stamps. Examples: `Strengthens the free answer` outlined mono pill ([07](before/07-done-uc2.jpg)); `NEW` on 4 of 7 claims; `holding S$0.40` pill on the budget card ([11](before/11-uc3-refund.jpg)).

### 1.4 Monospace misuse

50 `mono` declarations. Geist Mono is used for **prices** (`S$1.10` at 40 px), the header status word (`Idle`, `Searching`), every pill, `cap S$1.00 / source`, `spent S$0.00`, `Receipt`, `fixture · extractive-fixture`, citation numbers, section eyebrows. Mono should mean "copy this exactly" (hashes, ids, logs), not "this is data".

### 1.5 Colour noise

Three palettes. The design contract says warm Paper `#FBF8F2` / Ink `#24211E` / Salmon (`docs/contracts/DESIGN.md`); the runtime uses cool grey `#F6F7F9`, electric blue `#2F45FF`, highlighter yellow `#FFE45C`, orange `#FF5A1F`, plus a green, an ochre and a red; the explainers site adds cream, yellow, and blue / orange / green card accents. The runtime palette is the generic "AI product" look the brief rejects. The progress strip alone uses blue, black, green, red and light-blue segments with no legend ([11](before/11-uc3-refund.jpg)).

### 1.6 Redundant chrome

| # | Instance |
|---|---|
| C1 | Run phase is shown in **four places** at once: header status word, bottom run bar, budget card, sidebar dot. |
| C2 | A 9-segment stepper along the bottom encodes nothing a viewer can read (UC3 has more). |
| C3 | Keyboard hints everywhere: `⌘1`, `⌘2`, `⌘N`, `⌘K`, `W`, `Esc`: a header with 7 controls, three of which are keycaps. |
| C4 | `Download report` is rendered disabled during the run, then again beside `Compare v1 → v2`, which is also a toggle (`v1 | v2`) and a text link. Three controls for one action. |
| C5 | Panel-in-panel: budget card → purchase card → challenge list → receipt row; disclosures inside disclosures. |
| C6 | The sidebar repeats the question that is the page title. Record mode collapses it into three unlabeled green dots ([23](before/23-record-home.jpg)). |
| C7 | Palette header has both `Close` and `Esc` ([17](before/17-palette.jpg)). |

### 1.7 Weak hierarchy

| # | Instance |
|---|---|
| H1 | Before any money moves, the largest thing on screen is a 40 px `S$2.00` mono budget card. During the run, the payment, the product's point, is a small card. In UC3 the refund is 13 px text in a right rail ([11](before/11-uc3-refund.jpg)). |
| H2 | **The "Short answer" is not an answer**: it is the first extracted sentence. UC3's reads "I run procurement for a mid-size fabless shop, and I have spent most of 2026 staring at…" ([12](before/12-uc3-done.jpg)). UC2's v2 headline is a margin story that doesn't answer the question ([07](before/07-done-uc2.jpg)). |
| H3 | Uppercase micro-labels (`SHORT ANSWER`, `CHALLENGES 1`, `UNCERTAIN 7`, `OPEN GAP`, `TODAY`) compete with content; glyph markers `▼ ◆` carry stance. |
| H4 | **22 distinct font sizes** (9 px … 40 px) and four typefaces (Geist, Geist Mono, Newsreader, Bricolage Grotesque). |
| H5 | **Money maths is unreadable.** After UC3: `S$1.30 left of S$2.00`, `spent S$0.70`, `refunded S$0.30`, and the receipt total reads `S$0.30`. Net cost is S$0.40; budget used is S$0.70 (refunds don't restore authority by design); nothing says either. ([12](before/12-uc3-done.jpg)) |
| H6 | The decision list truncates article titles at 3 lines and shows `SKIP` / `BUY` stamps with the reason in a tooltip ([08](before/08-decisions-open.jpg)). |

### 1.8 Jargon in user-facing copy

`fixture`, `extractive-fixture`, `metadata-fixture`, `scope-fixture`, `Fixture fallback · …`, `Policy code checks each source against your cap.`, `Searching every listed writer for: …`, `Proof failed · lead-times-dated`, `claim failed`, `Challenged`, `InvoiceID = original tx`, `Qualifies the free answer`, `GAP CLOSED`, `OPEN GAP`, writers table columns `H`, `C`, `T` and `claimed 0.42`, `UC1 · …` in the palette, `READ_FREE`, `FOLLOW_UP` (Show work, acceptable there), `Stage 1×`, `clarify=never` (Presenter, hidden in record mode).

### 1.9 Layout density

| # | Instance |
|---|---|
| D1 | ~100 px empty bands between the answer and "2 of 2 answered" and between the budget card and "Purchase decisions" ([07](before/07-done-uc2.jpg)). |
| D2 | A 770 px reading column in a 1440 px window, with a rail that is mostly empty until money moves. |
| D3 | **Mobile hides the money.** At 390 px the budget card and payments sit below a full-page claim list; above the fold there is a 28 px answer, three disclosure rows, and a run bar ([25](before/25-mobile-running.jpg), [26](before/26-mobile-done.jpg)). |
| D4 | The PDF is **50 pages** for UC3, repeating every claim in "Executive answer", "Findings" and per-version sections ([27](before/27-report-page1.jpg)). |

### 1.10 Empty, loading and error states

| # | Instance |
|---|---|
| E1 | Composer button reads `Starting…` (disabled) through both clarify and the 5 s plan; suggestions stay visible beneath ([02](before/02-clarify.jpg), [03](before/03-plan-confirm.jpg)). |
| E2 | **One failure, two messages**: a 500 from `/api/scope` shows `Can't reach the server. Try again. Retry connection` at the top **and** `Couldn't send the question. Try again.` in the composer ([20](before/20-error-duplicate.jpg)). |
| E3 | **Contradictory failed state**: header `Failed`, red sidebar dot, `Failed` run bar, while the payment card reads `Bought · … Paid S$0.90 · delivered · verified` and the answer is v1 with an open gap. No sentence says what happened or what to do ([21](before/21-failed-run.jpg)). The run snapshot says `Delivery incomplete. Retry delivery to verify and re-answer.`, and the trace shows a reconcile retry that verified the proof afterwards, so the UI never recovered. (Possible product bug in the #305 recovery path; flagged to the orchestrator, not fixed here.) |
| E4 | Empty rail text: "Purchase activity will appear here. Policy code checks each source against your cap." |
| E5 | Skeleton shimmer (infinite) while "reading free sources" ([04](before/04-running-search.jpg)). |
| E6 | `Backend unreachable.` renders over a normal-looking home that still offers to Ask ([20](before/20-error-duplicate.jpg)). |

### 1.11 Inconsistent components

| # | Instance |
|---|---|
| I1 | Amounts render four ways: 40 px mono hero, mono pill, bold green sentence (`Paid S$0.90 · delivered · verified`), plain 13 px. |
| I2 | Actions render as filled blue buttons, outlined buttons, underlined text links (`View`, `Why these?`, `Retry connection`), and a dark segmented toggle, all doing the same kind of thing. |
| I3 | Receipt is a perforated paper skeuomorph with a hazard stripe; nothing else in the app is. |
| I4 | Radii in use: 15+ distinct values (1–24 px, 50 %, 999 px). Borders: solid 1 px, 1.5 px, **dashed** (`.ra-gap`). |
| I5 | Status colour differs per component: the payment line is black, then green, then red; the run bar blue, black, red; the sidebar dot purple, green, red. |
| I6 | Writers table has inline-link names with `↗`, coloured `active` boxes, `H 0.80`, `C 1.00`, `T 0.80` (bar + number) in one row ([15](before/15-writers.jpg)). |

### 1.12 Top 10, ranked by judge impact

1. **Label spam** (L1–L8): 8–10 env labels per screen; reads as a wall of disclaimers, undermines every number.
2. **The money moments are buried and unreadable** (H1, H5): refund is a footnote; budget maths contradicts itself.
3. **A contradictory failed state** (E3): a paid-and-verified card under a red `Failed`.
4. **Decorative motion** (M1–M7): springs, stamps, shakes, odometers, highlighter sweeps, a cast mascot.
5. **Three palettes, drift from the design contract** (1.5): electric blue + yellow + orange.
6. **Jargon** (1.8): `extractive-fixture`, `InvoiceID = original tx`, `GAP CLOSED`.
7. **Pill species** (1.3): ten kinds of badge.
8. **Monospace for everything that is a number or a label** (1.4).
9. **Redundant chrome** (C1–C7): run state four times, a meaningless stepper, three controls for one action.
10. **Mobile hides the money, the PDF is 50 pages, and the "short answer" isn't an answer** (D3, D4, H2).

---

## 2. Principles

1. **The money is the story.** Amounts, status and proof get the largest type and the most whitespace on the run screen. Everything else supports them.
2. **Say it once.** One environment indicator, one run status, one place for every fact. Repetition is a bug.
3. **State, not spectacle.** Motion, colour and icons exist only to show that something changed. A still frame must tell the same story as the animation.
4. **Typography leads.** Hierarchy comes from size, weight and space, not boxes, pills or colour. Seven sizes. Sentence case. No uppercase eyebrows.
5. **Plain words.** The user's vocabulary: question, article, writer, budget, paid, refunded. Engine vocabulary stays in Show work.
6. **Show proof, not claims.** A payment row opens to its receipt; a verification shows what was promised and what was found; a refund shows the amount returned and why.
7. **Dense and calm.** Linear-grade density at rest (tables, rows, 4 px grid), and calm because there is little to look at, not because it is padded.

---

## 3. Labelling policy (simulated, Testnet, substituted)

The hard gate is unchanged: *everything simulated or substituted is labelled* (AGENTS.md; FINAL-PUSH §12.5). This policy relocates labels so that each is seen once, calmly, where it matters. It does not remove any.

### 3.1 The environment indicator

One control in the header, right side, left of ⌘K. On every screen, including record mode and clips. Never hidden by a setting.

| Mode | Text | Dot |
|---|---|---|
| Offline fixture (`make run`, `make record`, `make clip`) | **Demo · simulated payments** | ochre |
| Live providers, XRPL Testnet | **XRPL Testnet · test funds** | neutral ink |

- Sentence case, Geist Sans 12/16 medium, 24 px high, neutral surface, 1 px rule, 6 px dot, radius 12. Same pattern as Stripe's "Test mode". It is the **only** pill in the product.
- Click or Enter opens a popover, "What's real here", a four-row table, the same wording as the API `labels`:
  - **Writers:** Fictional (synthetic corpus).
  - **Payments:** Simulated, no ledger entry / XRPL Testnet, test funds with no value.
  - **Search:** Hybrid / Keyword only (embeddings unavailable).
  - **Models:** the research model, and the decision round named as itself (`OpenAI Decisions · gpt-6-luna`, `Cloudflare · …`, or `Offline rules`).
- A first-visit auto-open of this popover (one line: "Writers are fictional and payments are simulated. No real money moves."), dismissed with Esc or a click, stored in local preferences. Not shown in record mode (the pill is).
- Mobile: the pill shortens to the dot plus `Demo` or `Testnet`; the popover is a bottom sheet.

### 3.2 Where labels remain, and why

| Surface | What it shows | Why a judge could be misled without it |
|---|---|---|
| Header pill (all screens) | Mode, as above. | The one persistent statement of what is real. |
| First-run popover (once) | The four rows. | A fresh viewer sees what's real before anything happens. |
| **Receipt sheet** | One footer line (`Simulated payment · no ledger entry` or `XRPL Testnet · test funds, no value`) and a **Transaction** row: a hash with `View on XRPL Testnet ↗` on Testnet, or `None (simulated)` in demo mode. No hash is shown in demo mode outside Show work. | A receipt is the artefact people screenshot and forward. A simulated hash must never look like a real one. |
| **Refund line** in the Payments list and on the receipt | `Refunded S$0.30` followed by `· XRPL Testnet` or `· simulated` as quiet text, no pill. Required by FINAL-PUSH §12.5 ("refunds are labelled XRPL TESTNET"). | A refund is the claim most likely to be read as real money. |
| **Report PDF** | A 2-line note box on page 1 and a footer on every page: `Demo data · simulated payments` / `XRPL Testnet · test funds`. | Exported artefacts leave the app and lose the header. |
| **Exports and social cards** (`design/cards`, `make clip` stills, README GIF) | The same footer line baked in. Record mode keeps the header pill visible. | Same reason. |
| **OS notifications and copied text** | `(demo)` or `(Testnet)` suffix, e.g. "Answer ready (demo)". | They have no chrome. |
| **Answer-level substitution notice** (only when it happens) | A single neutral note above the answer with an ochre left rule: "Written from offline extracts: the model was unavailable." / "Keyword search only: embeddings were unavailable." | A substituted model or search changes the answer's quality; this is gate 5's "LLM fallbacks keep their labels". Absent when nothing is substituted. |
| **Writers view** | One sentence under the title: "All writers and articles are fictional." | Gate 5: writers are labelled SYNTHETIC. |
| **Decisions table caption** | `Decided by OpenAI Decisions · gpt-6-luna` or `Offline rules`. | Gate 5: every decision round names its provider as itself. |
| **Show work** (Trace, Wire, Policy, Receipts, Models) | Verbatim engine labels in mono (`SIMULATED SGD · no real funds`, `fixture · …`). | The audit surface; nothing is softened here. |
| API, MCP and SDK payloads | `labels` fields unchanged. | Agents and tests consume them. |
| README and site | One sentence at the top (already present). | Public entry points. The `LIVE RUN` pill on the walkthrough becomes `Replay of a real run · 9 Oct`. |

### 3.3 Where labels are removed

Composer pill; budget-card pill; payment-card header pill (`S$0.90 · SIMULATED`); refund chip; receipt icon text, hazard stripe and `· SIMULATED` on the total; settings slider pill; `Fixture research`, `Fixture fallback` chips; `fixture · extractive-fixture` under answers; `fixture · metadata-fixture` over decisions; `SYNTHETIC writers` pill; `Synthetic corpus · fictional`; the `search · …` chip when search is hybrid; the cast `simulated` stamp pose. On a finished UC3 screen: **8 labels → 1** (the pill). With the receipt open: **10 → 2** (pill + receipt footer).

### 3.4 The accepted trade-off

In-app amounts carry no suffix. A screenshot cropped to the Spend panel loses the header pill. Mitigations: the Spend panel sits directly under the pill on desktop; mobile shows the pill in the top bar above the spend row; receipts and exports are self-labelled. The owner asked for exactly this ("ONE clear, calm environment indicator… plus precise markers only where a judge could be misled: receipts, exports, amounts"). Issue #228's older wording ("a visible SIMULATED stamp on every amount and receipt") is superseded by this section.

### 3.5 Wording rules for labels

Never all caps. Never mono. Never yellow-filled. Name what is substituted, not the implementation: "offline extracts", not `extractive-fixture`; "offline rules", not `metadata-fixture`.

---

## 4. Motion policy

**Rule:** motion appears only when a value or state changes, never on entry, and never loops, except a spinner during a pending request. Any motion must have an identical still-frame meaning and a `prefers-reduced-motion` equivalent that is instant. No spring, overshoot, bounce, scale-in, stagger, shimmer, parallax, confetti or looping pulse.

### 4.1 Allowlist (exactly these)

| # | Transition | Duration | Easing | Notes |
|---|---|---|---|---|
| 1 | Popover, palette, sheet, modal and toast **enter**: opacity 0→1 and translateY 4 px→0. **Exit**: opacity only | 140 ms / 100 ms | ease-out | No scale. The modal loses its glow. |
| 2 | **Budget bar**: width and tone change as money is reserved, spent, refunded | 240 ms | ease-out | The money movement. See 4.2. |
| 3 | **Status change in place** on a payment or verification row: label and icon cross-fade | 160 ms | ease-in-out | Quoted → Paying → Paid → Verified / Refunded |
| 4 | **New content block** inserted by the stream (answer sections, claim groups): opacity 0→1 | 120 ms | ease-out | No translate, no per-word reveal. |
| 5 | **Disclosure** open/close: height; chevron rotate | 160 ms / 120 ms | ease-out | |
| 6 | **Hover, focus, pressed** colour and border | 80–120 ms | linear | Focus ring appears instantly. |
| 7 | **Plan countdown**: the 2 px fill under the plan sheet runs 0→100 % | 5000 ms | linear | Functional: it is the timer. |
| 8 | **Pending spinner**: one 14 px ring, shown only while a request is in flight for > 400 ms | 800 ms loop | linear | The only infinite animation. Reduced motion: static `…`. |
| 9 | **Sidebar collapse** width | 160 ms | ease-out | |
| 10 | **Amount text change** in the Spend panel: cross-fade old→new | 120 ms | ease-out | No counting, no odometer. |

Everything else is static. Keyframes drop from 30 to **four** (`fade-in`, `rise-4`, `spin`, `countdown`).

### 4.2 The money moments in motion

- **Reserve → pay:** the bar gains a lighter segment (reserved), then it turns solid when paid (#2, 240 ms). The amount in the payments row changes status text in place (#3).
- **Refund:** the solid segment *retreats* into the light "refunded" tone (#2, 240 ms in reverse) and the row's status cross-fades to `Refunded S$0.30` (#3). That reversal is the refund. Nothing flies.
- **Settlement time** is a measured text value (`Settled in 3.2 s`), not an animation.

### 4.3 Deleted

`pop`, `stamp`, `stampbig`, `shake`, `ra-shake`, `ra-wiggle-out`, `ra-tilt`, `ra-hop`, `flash`, `dropflash`, `drain`, `deal`, `word`, `draw`, `sweep`, `rise` (as staged), `slidein`, `slideup`, `toastin`, `ra-typing`, `shimmer`, `pulse` (all), `Roll.tsx`, every `animation-delay: calc(var(--i) …)`, `--ease-spring`.

---

## 5. Visual system

Replaces the runtime tokens. The runtime is brought into line with the brand kit ([design/brand](../../design/brand/README.md)): Ink `#24211E` on Paper `#FBF8F2`.

### 5.1 Type (Geist Sans only in the product)

| Role | Size / line | Weight | Use |
|---|---|---|---|
| Display | 28 / 34 | 600, −0.02 em | Home heading only |
| Title | 20 / 28 | 600 | Question (page title), sheet titles, answer headline |
| Reading | 15 / 24 | 400 | Answer body, claims (max 68 ch) |
| Body | 14 / 20 | 400, 500 for emphasis | Default UI |
| Small | 13 / 18 | 400 | Meta, secondary text, table cells |
| Caption | 12 / 16 | 500 | Group headings (sentence case, muted), kbd hints |
| Amount | 32 / 36 | 600 tabular | Spend panel net amount only |

Seven sizes (12, 13, 14, 15, 20, 28, 32). Weights 400, 500, 600 only. Amounts everywhere use `font-variant-numeric: tabular-nums` in Geist Sans (as Stripe and Mercury do). **Geist Mono only for**: transaction hashes, invoice and run ids, Show work logs, code. This amends the brand README's "Geist Mono is for prices and metadata". Newsreader and Bricolage Grotesque are removed from the product.

### 5.2 Spacing, radius, elevation

4 px base: **4, 8, 12, 16, 24, 32, 48**. Radius: **6** (controls, inputs, buttons), **10** (cards, sheets, popovers), **12** (the environment pill). Borders 1 px, solid. One shadow (popover/sheet): `0 8px 24px rgba(36,33,30,.12)`. No dashed borders, no glows, no gradients.

### 5.3 Colour

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FBF8F2` | App canvas |
| `--surface` | `#FFFFFF` | Spend panel, sheets, popovers, inputs |
| `--ink` | `#24211E` | Text, primary button, focus ring |
| `--muted` | `#655D55` | Secondary text |
| `--rule` | `#E8E2D8` | Hairlines; `#C9BFB2` for strong borders |
| `--hover` | `#F3EEE4` | Row hover, selected row |
| `--ok` | `#2F6B4F` | Verified, settled, money back |
| `--bad` | `#9B3E35` | Broken promise, failed delivery |
| `--warn` | `#9A6B20` | Environment dot, substitution notice rule |

Primary button: ink fill, paper text. Links: ink with underline on hover. No blue, no yellow highlighter, no orange, no purple. Salmon `#D9A28F` stays a brand layout accent (marks, social cards), not a UI colour. Colour never carries state alone: every state has a word and an icon.

### 5.4 Icons

One 16 px line set, 1.5 px stroke, on the brand grid: check, return-arrow, cross, chevron, search, plus, settings, external-link. No cast marks in the working product ([§7](#7-component-inventory)). Status uses a 6–8 px dot or a 16 px icon, not an illustration.

### 5.5 Layout

- Desktop ≥ 1100: sidebar 240 (collapsible to 56), content column 680, rail 320, 24 px gutter, centred in a 1040 max. Answer column and rail scroll with the page (document scroll), rail sticky.
- Tablet 780–1100: rail drops below the answer header as a full-width Spend row.
- Mobile < 780: one column; see [§8.14](#814-mobile).
- Header 48 px: `☰ · mark · ResearchAgent · [Run] [Writers] ········ [env pill] [⌘K]`. The status word leaves the header.

---

## 6. Copy rules

1. Plain English, second person where addressing, otherwise neutral. Sentence case everywhere.
2. Say what happened and what's next: "Paid S$0.40. Checking the article against the writer's promises." Never "Proof failed · lead-times-dated".
3. No engine words in the working UI: *fixture, extractive, scope-fixture, policy code, intent, invoiceId, manifest, grant, quarantine, challenge (as a noun for the user), UC1…UC4*. They stay in Show work.
4. Amounts: `S$0.40`, two decimals, tabular. Time: `3.2 s`. Never `S$0.4`.
5. Errors: what failed, why if known, one action. One message per failure. Never `HTTP 500`.
6. No exclamation marks, emoji or hype. No "AI-powered".

| Now | Becomes |
|---|---|
| `SHORT ANSWER` | `Answer` (demo mode: `Lead finding` when the headline is an extract) |
| `CHALLENGES 2` / `UNCERTAIN 7` | `Disputes (2)` / `Unclear (7)`; `Supports (n)` |
| `GAP CLOSED · The earlier evidence gap is now covered by X.` | `Bought 1 article from X (S$0.90). It fills the gap the free sources left.` |
| `OPEN GAP · No accessible analyst estimates…` | `Not found: analyst estimates on capacity allocation.` |
| `Strengthens / Qualifies the free answer` | `The paid article strengthens / qualifies the free answer.` (one plain sentence) |
| `Proof failed · lead-times-dated … source quarantined, never cited` | `AlphaLeak's article didn't contain what it promised ("dated lead times"). Refunded S$0.30. Not used in the answer.` |
| `Paid S$0.90 · delivered · verified` | `Verified` (row status) |
| `Challenged · Refunded S$0.30 · The writer paid it back; never cited.` | `Refunded S$0.30` + reason line |
| `Refunded S$0.30 · InvoiceID = original tx · SIMULATED SGD · no real funds` | `Refunded S$0.30 · simulated` |
| `Searching every listed writer for: …` | `Search 8 writers for "analyst outlook Kestrel TSMC deal"` |
| `Purchase decisions · 1 round` | `Why this article` |
| `Considered 12 paywalled sources` / `BUY` / `SKIP` stamps | `12 paid articles considered` and a table with a `Decision` column: `Bought`, `Too expensive`, `Not relevant`, `Duplicate`, `Writer blocked` |
| `Wallet`, `Budget for this question`, `left of S$2.00` | `Spend`, `S$2.00 budget` |
| `Starting…` (disabled Ask) | Button disabled with its label unchanged; the plan sheet is the feedback |
| `UC2 · What's the analyst outlook…` (palette) | `Try: Kestrel–TSMC outlook` |
| `Universal budget per query` / `Home hides the slider.` | `Always use this budget` / `Skip the budget picker on the home screen.` |
| Writers `H 0.80 · C 1.00 · T 0.80` | `Trust 0.80` in the row; honesty and coverage in the row detail |
| `Backend unreachable.` | `Can't reach the ResearchAgent server. [Try again]` |

---

## 7. Component inventory

Files under `src/components/`.

| Component | Verdict | Notes |
|---|---|---|
| `Layout`, `Sidebar` | **Keep, restyle** | 48 px header, new right group (env pill, ⌘K). Remove the status word. Record mode keeps a collapsed rail with `+` only, no dots. |
| `Ask`, `ClarifyChips` | **Keep, restyle** | Composer: textarea, budget select, Ask. No pill. Clarify becomes a card with numbered options and key hints 1–3. |
| `ActionModal` | **Keep → `PlanSheet`** | Centred 480 px sheet. See [§8.3](#83-plan-confirm-the-5-second-sheet). |
| `BudgetPopover`, `BudgetSlider`, `Budget` (card) | **Merge → `BudgetSelect` + `SpendPanel`** | Segmented choice: Free · S$1 · S$2 · S$3 · S$5 (+ custom). The slider with dots goes. The big budget card becomes the Spend panel. |
| `Purchase`, `Receipt`, `Ledger` (as payment UI) | **Merge → `PaymentRow` + `ReceiptSheet`** | One row per payment, one side sheet per receipt. |
| `RunTape`, `Activity`, `runState` stepper | **Merge → `RunActivity`** | Vertical timeline during the run; collapses to a one-line summary when done. The bottom run bar and 9-segment stepper are deleted. Raw trace stays in Show work. |
| `Answer`, `Passage` | **Keep, restyle** | Remove `GAP`, `impact` pill, uppercase labels, `NEW` pills (default view). Citation chips become plain superscript numbers. |
| `DecisionPanel`, `DecisionTable` | **Merge → `WhyThisArticle`** | One table inside a disclosure under the payment (or in the "No purchase" note). |
| `Sources` | **Keep, simplify** | One-line summary: `27 sources · 15 read · 1 bought`, `View all` opens a table sheet. No chips. |
| `ReputationPanel`, `WriterChip` | **Keep, simplify** | Writers table: Name · Articles · Trust · Checked / failed · Status (plain text). No pill, no bar. |
| `ShowWork`, `Wire`, `Ledger` (raw) | **Keep** | The audit surface; mono allowed; real labels verbatim. |
| `CommandPalette` | **Keep, polish** | Group headings (Actions, Examples, Recent), no duplicate Close/Esc, no `UC#`. |
| `Settings` | **Keep, simplify** | Two settings, sentence-case labels. |
| `Toasts` | **Keep, restyle** | Single line, bottom centre, 140 ms fade, 4 s. |
| `ReportButton` | **Keep, move** | Appears only when the run is done; lives in the answer header's `⋯` menu with `Compare`. |
| `PendingTime` | **Keep** | `Waiting 2.1 s` as text. |
| `Presenter` | **Keep** | Hidden in record mode. |
| `ChatThread` | **Audit in build** | Delete if unreferenced once the new shell lands. |
| `Modes` (chips) | **Delete** | Replaced by `EnvIndicator` and the answer-level notice. |
| `InfoDot` | **Delete** | Tooltip-only "i"; its text moves to the env popover. |
| `Roll` | **Delete** | Odometer. |
| `Cast` and `src/assets/cast/*` in the app | **Delete from the product** | Keep `design/cast` for social cards, README and site only. A purse and receipt illustration that repeats the adjacent word is decoration. |
| New | `EnvIndicator`, `SpendPanel`, `PaymentRow`, `ReceiptSheet`, `PlanSheet`, `RunActivity`, `Notice` (single inline message/error/substitution component) | |

---

## 8. Screen specs

Emphasis key: **bold** = the visually dominant element on that screen.

### 8.1 Shell

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ☰  ⟋ ResearchAgent    Run   Writers                    ● Demo · simulated payments  ⌘K │  48
├────────────┬─────────────────────────────────────────────────────────────────────┤
│ + New  ⌘N  │                                                                     │
│ Today      │                       (content)                                     │
│  Kestrel…  │                                                                     │
│  Bank of…  │                                                                     │
│ Settings   │                                                                     │
└────────────┴─────────────────────────────────────────────────────────────────────┘
```

Sidebar rows: 28 px, a 6 px status dot (running ink, done none, failed red), title truncated. No `Today` uppercase (`Today` in caption style). ⌘1/⌘2/⌘N hints appear on hover only.

### 8.2 Home and clarify

```
                 Ask a question. Give it a budget.            ← 28/34
      Answers from free sources first; buys one article only if it helps.  ← 14 muted
 ┌───────────────────────────────────────────────────────────────┐
 │ Ask about a company, a market or a claim…                      │
 │                                                                │
 │ ─────────────────────────────────────────────────────────────  │
 │ Budget  S$2.00 ▾                                      [ Ask ⌘↵ ]│
 └───────────────────────────────────────────────────────────────┘
 Try an example
 Bank of Japan decision        What did the Bank of Japan change at its last…
 Kestrel–TSMC outlook          What's the analyst outlook on Kestrel…
 Malaysia packaging lead times Are Kestrel's advanced-packaging lead times…
```

- Subhead replaces "Policy code buys sources within your budget." The point is stated as a user benefit, not an architecture.
- No pill; the header carries the environment.
- **Clarify:** the examples disappear and the composer collapses to a read-only question line. Below it one card: "Which angle matters most?", three numbered rows (`1 Capacity allocation`, `2 Pricing & margins`, `3 Delivery timeline`) and `Skip ⌫`. Same width as the composer. The Ask button is not shown. Keyboard 1–3.

### 8.3 Plan confirm: the 5-second sheet

The only confirmation before spending (no per-purchase modal). Centred sheet, 480 px, scrim `rgba(36,33,30,.24)`.

```
┌──────────────────────────────────────────────────┐
│ Ready to start                                   │ 20/28
│ What's the analyst outlook on Kestrel's latest…  │ 14 muted
│                                                  │
│ Plan                                             │ 12 caption
│  1  Search 8 writers for                         │
│     "analyst outlook Kestrel TSMC deal"          │
│  2  Read free sources and draft an answer        │
│  3  Buy at most one article if it fills a gap    │
│  4  Check it against the writer's promises;      │
│     refund if one is broken                      │
│                                                  │
│ Budget       **S$2.00**   up to S$1.00 per article│ 14, amount 600
│ Nothing is spent until step 3.                   │ 13 muted
│                                                  │
│ ▬▬▬▬▬▬▬▬▬▬░░░░░░  Starting in 3 s                │ 2px fill
│                       Edit   Cancel   [Start now]│
└──────────────────────────────────────────────────┘
```

- Order of emphasis: title → plan steps → **budget** (the authorization) → buttons. The budget line is the only bold amount.
- Countdown is the thin fill (allowlist #7). `Esc` cancels; `⌘↵` or `Enter` starts now; `E` edits. Focus lands on **Start now**.
- Copy states the gate in a sentence: "Nothing is spent until step 3, and never more than S$2.00." The 5 s covers the plan, not each purchase.

### 8.4 Running: search → decide → pay → verify

The page title is the question (20/28, max 2 lines). Directly beneath: one status line `Searching free sources…` with the spinner (allowlist #8), and on the right `Stop buying ⌘.` (text button, visible only while a purchase could still start).

```
 What's the analyst outlook on Kestrel's latest deal with TSMC?
 ◌ Paying NotFinancialTimes…                                  Stop buying ⌘.

 Activity                                                          Spend
 ✓ Searched 8 writers · 27 sources                    0.2 s      ┌──────────────────────┐
 ✓ Read 15 free sources and drafted an answer         1.1 s      │ Spent        S$0.00  │
 ✓ Chose 1 of 12 paid articles to buy           Why  0.4 s      │ ▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱    │
 ◌ Paying NotFinancialTimes · S$0.90                  2.1 s      │ S$2.00 budget        │
 ○ Check the article against the writer's promises               │──────────────────────│
 ○ Update the answer                                             │ Payments             │
                                                                 │ ◌ NotFinancialTimes  │
 Draft answer (free sources only)                                │   Paying S$0.90      │
 On 29 September 2026 Kestrel announced a five-year agreement…  └──────────────────────┘
```

- **Activity** is the DESIGN.md "research path": numbered vertical steps, each one line, with plain outcomes and measured durations. One row in progress at a time. Completed rows are static text; the in-progress row has the spinner. This replaces the bottom run bar, the stepper, the header status word and the sidebar-dot-as-status.
- The draft answer appears when v1 is ready, captioned `Draft · free sources only`. `Export` is absent until done.
- Search, decide and write steps are ≤ 4 s each in real time; the "stage pace" replay is a presenter setting (`.`) and, when active, adds one quiet text control `Demo speed · Skip` to the Activity header.

### 8.5 Spend panel and the payment row (the money component)

```
┌─────────────────────────────────────┐
│ Spent                               │ 13 muted
│ S$0.40                              │ 32/36 tabular
│ ██████▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░  │ 8 px bar: ink = net, rule = refunded
│ S$2.00 budget · S$1.30 left         │ 13
│ Paid S$0.70 · Refunded S$0.30       │ 13 muted
├─────────────────────────────────────┤
│ Payments                            │ 12 caption
│ ✓ The Fab Floor              S$0.40 │
│   Penang packaging lead times…      │ 13 muted
│   Verified · 3.2 s       Receipt ›  │
│ ↩ AlphaLeak                  S$0.30 │
│   Kestrel's Penang packaging…       │
│   Refunded S$0.30 · XRPL Testnet    │
│   Promise broken: "dated lead times"│ --bad
│                          Receipt ›  │
└─────────────────────────────────────┘
```

- **Headline number = net cost** (what actually left the wallet). The bar's solid part is net spent; a lighter part is refunded money that still counts against the budget (refunds never restore authority, SECURITY.md). Two lines below say so in plain numbers. This fixes H5.
- Status vocabulary (one per row, cross-faded in place, allowlist #3): `Quoted S$0.90` · `Paying…` · `Paid · checking` · `Verified` · `Refunded` · `Delivery failed · Retry`. Icon: ring (pending), check in `--ok` (verified), return-arrow in ink (refunded), cross in `--bad` (failed).
- A payment row is one 56–72 px block. No nested cards.
- While running, the panel header holds `Stop buying`; it disappears when no purchase can start.
- If delivery fails after payment: `Paid S$0.90 · delivery failed. You won't be charged again.` with a primary `Retry delivery`; if automatic recovery is running: `Recovering delivery · retry 1 of 3` (status, no button). The run header must not say `Failed` while a payment is verified and recovery is pending; it says `Recovering`.
- No purchase (UC1, `S$0` budget): the panel shows `S$0.00` and one line: `Answered from free sources. 12 paid articles considered; none would change the answer.` plus `Why` (the decisions disclosure). At `S$0` the line reads `Would have bought 1 article (S$0.90). Raise the budget to allow it.`

### 8.6 Verification

The verification step is a visible check of the writer's promises, as an expandable inline block under the payment row (open by default for 4 s on completion, then collapsed unless a promise failed):

```
 Checked against the writer's promises
 ✓ Covers: analyst margin estimates after the TSMC deal      found in ¶3
 ✓ Covers: the date of the prepayment                        found in ¶5
```
or, when broken:
```
 ✕ Covers: dated lead times in weeks                         not found
   The article doesn't contain this. Refund started.
```
Plain labels from the manifest's promises. No hashes, no `claims recomputed`. Duration as `Checked in 0.4 s`.

### 8.7 Refund

Sequence in the Payments list (all in place, ≤ 240 ms each):

1. Row status → `Paid · checking`.
2. Verification block shows the failed promise (cross, `--bad`).
3. Row status → `Refunding…`, bar tone shifts (allowlist #2).
4. Row status → **`Refunded S$0.30`** + `· XRPL Testnet` / `· simulated`. On Testnet the row gets a `Refund tx a1b2c3… ↗` link; in demo mode no hash.
5. Spend panel: net `S$0.40`; `Paid S$0.70 · Refunded S$0.30`.
6. The answer notes it once, in one sentence above the claims: `AlphaLeak's article didn't contain what it promised, so it was refunded and not used.`

This is the strongest demo moment: it gets the clearest copy and the one red line in the product, and no animation beyond the bar.

### 8.8 Done: answer first

```
 What's the analyst outlook on Kestrel's latest deal with TSMC?
 Done · 1 article bought for S$0.90 · 11 s                       Export ⋯

 Answer                                                       ← 12 caption
 Kestrel Semiconductor signed a five-year, 24,000 wafers-a-month N3P agreement  ← 20/28
 with TSMC, paid for by a US$1.1 billion prepayment.
 The paid article from NotFinancialTimes strengthens this: analysts cut margin estimates.

 Supports (3)
   …claim text 15/24… ¹ ²
 Disputes (1)
 Unclear (7)
```

- Headline: a one-to-two-sentence **answer**, not the first extract. (H2: in fixture mode, label it `Lead finding`; a research-lane task is to choose the best-supported claim or synthesise.)
- One status line under the title (`Done · 1 article bought for S$0.90 · 11 s`). The rail holds Spend and Payments (§8.5).
- `Export ⋯` menu: `Download report (PDF)`, `See what changed after the purchase` (the v1 → v2 diff; replaces the `v1 | v2` toggle and the separate Compare button), `Copy link`.
- Claims grouped by stance with sentence-case headings and counts. Citations are superscript numbers; clicking opens the `Passage` side sheet. No `NEW` markers in the default view; the "what changed" view lists added and dropped claims.
- **UC1 (no purchase):** same layout; the status line reads `Done · answered from free sources · S$0.00`.
- **UC2 (one purchase):** status line names the purchase; one plain sentence says how it changed the answer.
- **UC3 (refund + second buy):** status line `Done · 2 articles bought · 1 refunded · net S$0.40`; the refund sentence from §8.7 sits above the claims; Payments lists both.

### 8.9 Receipt: a side sheet, not a paper prop

Opens from `Receipt ›`. Right-hand sheet, 400 px, enter per allowlist #1; on mobile a bottom sheet.

```
┌──────────────────────────────────────┐
│ Receipt                          ✕   │
│ S$0.30                               │ 32 tabular
│ Refunded · 3 Nov 2026, 02:16:55      │ 14
│                                      │
│ Writer          AlphaLeak            │
│ Article         Kestrel's Penang…    │
│ Paid            S$0.30               │
│ Refunded        S$0.30               │
│ Net cost        S$0.00               │
│ Charges         1                    │
│ Invoice         565BF9…3CCBF  ⧉      │ mono
│ Transaction     None (simulated)     │ or: a1b2c3…  View on XRPL Testnet ↗
│ Refund tx       None (simulated)     │
│                                      │
│ Checked promises                     │
│ ✕ Dated lead times in weeks          │
│                                      │
│ Simulated payment · no ledger entry  │ 12 muted (the receipt's marker)
└──────────────────────────────────────┘
```

- No perforation, icon, hazard stripe or caps. The one environment marker is the footer line.
- Hashes full on copy (⧉), middle-truncated on screen. On Testnet the explorer link is the only link.
- A paid-and-verified receipt has the same shape with `Verified` and no refund rows.

### 8.10 Writers

Title `Writers`, one sentence: "All writers and articles are fictional." Table, 36 px rows, tabular numbers:

| Writer | Articles | Trust | Checked / failed | Status |
|---|---|---|---|---|
| Kopi Contrarian | 12 | 0.80 | 0 / 0 | Active |

Row click expands: honesty, coverage, last checks, bylines. Names are text, not `↗` links; the external link sits in the expanded row. Presenter-only reset stays hidden outside presenter mode. `Delisted` is a red text status.

### 8.11 Show work

Keep as a bottom drawer (`W`). Tabs: Trace, Wire, Policy, Receipts, Models (Ledger on Testnet). Mono and engine vocabulary allowed here and only here. Add a one-line plain caption under the tabs per tab ("What the agent did, in order."). Real labels verbatim (§3.2).

### 8.12 ⌘K palette

Centred 560 px, no title row (placeholder `Search actions, runs and examples`). Groups with caption headings: **Actions** (New question, Run, Writers, Set budget, Settings, Show work, Connect an agent (MCP)), **Examples** (the three, by name), **Recent runs**. Key hints right-aligned in caption style. Esc closes; no visible Close button. Keep the existing keyboard map and the `make clip` flow (it relies on a combobox, the `Control+k` shortcut, a first option matching `UC2 ·`/`New question`, and `Go now`; see §11).

### 8.13 Errors, empty and loading

One component, `Notice`, in three tones: error (`--bad` left rule), substitution/warn (`--warn`), info (neutral). A single line plus one action, placed above the content column.

- Failure → **one** notice: `Couldn't start the run. The planner didn't respond. [Try again]`. The composer shows no second message.
- No server: `Can't reach the ResearchAgent server. [Try again]`; the composer is disabled with its normal label, with a neutral tooltip.
- Run failed: header status `Failed`; a notice states the cause and the action (`Delivery incomplete. [Retry delivery]`); the payment row shows its real state; the answer is labelled `Draft · free sources only`.
- Empty sidebar: `No runs yet.` Empty Payments: `No purchases yet.` while running; the UC1 line (§8.5) when done.
- Loading: static grey bars (no shimmer) for the answer area; a spinner only for a pending request > 400 ms.

### 8.14 Mobile

At 390 px the **money comes first**: directly under the question a tappable row `Spent S$0.40 of S$2.00 · 2 payments ›` opens the Spend and Payments sheet. Header: `☰ · mark · [dot + Demo] · ⌘K→search icon`; Run and Writers live in the ☰ drawer. Run activity is a vertical list under the spend row; the answer follows. Receipt and Passage open as bottom sheets. Tap targets ≥ 44 px. Verify at 360, 390, 768, 1024, 1440 px and 200 % zoom.

### 8.15 Report (PDF)

Target: **2 pages of content** plus an appendix.

1. Page 1: question; answer (the same headline); spend table (paid, refunded, net, budget); payments table (writer, article, amount, status, tx or `none (simulated)`); the environment note box; "How to read this" one line.
2. Page 2: claims by stance with citation numbers.
3. Appendix: the cited passages, once, each with source and writer. No repeated "Executive answer / Findings / version" copies. Footer on every page: `Demo data · simulated payments` / `XRPL Testnet · test funds`.

### 8.16 Record mode and `make clip`

Record mode keeps its behaviour (fixture, fixed dwell, presenter and notifications hidden, scrollbars hidden) and the header environment pill. The collapsed sidebar shows `+` only. The `make clip` driver (`scripts/record.mjs`) keeps working: `Control+k`, `combobox` fill, `Enter`, `textarea` fill, `Control+Enter`, the `pricing & margins` clarify button, the `Go now` button, and a `document.title` containing `Answer ready`. If the new copy changes any of those, update `scripts/record.mjs` and `docs/RECORDING.md` in the same PR, and run `make clip UC=UC3` as proof. Stills from `make clip` carry the footer line baked in.

### 8.17 README and explainers site

- Align `site/` to the same tokens: one header, no coloured card accent bars, no letter-spaced mono eyebrows, no yellow highlighter, the replay pill reads `Replay of a real run`. Keep the walkthrough's content: it is the best explanation of the product.
- README: keep the first screen as is; add the hero 15–20 s refund clip (`make clip UC=UC3`) when #262's replacement lands. The existing `TODO(pass 2)` stays with the README lane (#272).

---

## 9. Verdict on #262 ("watch the money move")

**Do not build the money flight, the ledger-close tick or the decision weigh-in animation.** Close #262 as superseded by Issue A below.

Why: a coin travelling from a Purse to a writer chip is the "motion graphics" signal the owner rejected, and it adds more labelled surface (cast poses, stamps) to a screen that is already over-labelled. The judged value in "especially how… payments and on-chain transactions are communicated" is *clarity of state*, and that comes from §8.5–8.7.

**The minimal form that stays:** the budget bar's 240 ms width/tone transition (reserve → paid; refund as its reverse) and the 160 ms in-place status cross-fade on the payment row. That is "watching the money move" in two transitions, still readable as a still frame, instant under reduced motion. The #262 bugs (#225–#231) already moved to #270 and shipped; the remaining one (#228, a visible simulated stamp) is superseded by §3.

Settlement time is shown as text (`Settled in 3.2 s`), which gives the post "ledger close to receipt in N s" without an animation.

---

## 10. Cut list

Everything below is deleted, not hidden.

**Labels:** composer pill; budget-card pill; payment-header `· SIMULATED`; refund chip; receipt icon caption, hazard stripe and total suffix; settings pill; `Fixture research`; `Fixture fallback · …`; `fixture · extractive-fixture` (answer); `fixture · metadata-fixture` (decisions); `SYNTHETIC writers`; `Synthetic corpus · fictional`; hybrid search chip; run-bar `SIMULATED SGD · no real funds`; `InvoiceID = original tx`.
**Components:** `Modes`, `InfoDot`, `Roll`, `Cast` (in-app), `BudgetSlider`, the bottom `RunTape` bar and 9-segment stepper, the Budget card, the `ra-impact` pill, `ra-stamp` BUY/SKIP stamps, the `GAP CLOSED` / `OPEN GAP` boxes, the `v1 | v2` toggle, the standalone `Compare v1 → v2` button and the footer link, citation chips, the `NEW` pill, the disabled `Download report` during runs, the `ra-delta` pill, the cast purse/receipt icons, `Close` button in the palette.
**Motion:** the 26 keyframes not on the allowlist (§4.3), `--ease-spring`, staggered delays, the modal glow, shimmer.
**Style:** Newsreader and Bricolage Grotesque; the blue `--pen`, yellow `--hi`, orange `--pay` tokens; the cool-grey canvas; dashed borders; gradients; every radius outside 6, 10, 12; font sizes outside the 7; uppercase eyebrows; mono on non-technical values.
**Copy:** every row of the §6 table's left column.
**Layout:** the right-rail "Purchase activity will appear here…" text, nested panel-in-panel, empty vertical bands, the `Starting…` dead state.
**Docs:** the "Quiet Evidence Terminal… compact mono treatment for prices" paragraph in DESIGN.md (replaced by this file).

---

## 11. Acceptance for the build (summary; full lists in the issues)

- A fresh viewer sees the environment label once (the header indicator) and never doubts what's real: writers fictional, payments simulated or Testnet, models named, refunds labelled.
- Every FINAL-PUSH §12.5 clause still has a visible surface (§3.2).
- Record mode and `make clip UC=UC2`/`UC3` still work end to end.
- Allowlisted motion only; reduced-motion renders the same states with no transitions.
- Seven font sizes, one accent (ink), no pills other than the indicator, no mono outside hashes, ids and Show work.
- axe clean; keyboard map unchanged; 360–1440 px with no horizontal overflow.

## 12. Build plan

Two issues, each one PR for one Sol agent. Issue A lands first (it owns shell, tokens and the money components); Issue B builds on it.

- **Issue A: Redesign the shell, labels and money moments.** Tokens and type, header and environment indicator, label removals, plan sheet, run Activity, Spend panel, payment rows, verification, refund, receipt sheet, errors, `make clip` / record mode.
- **Issue B: Redesign the answer, supporting screens, motion allowlist, mobile, PDF and site.** Answer layout and copy, Sources, decisions, writers, palette, settings, motion deletion, mobile, report, README and site alignment.

Test impact to plan for (state it in the PR description; do not loosen silently): `tests/e2e.spec.ts`, `tests/a11y.spec.ts` and `src/runState.test.tsx` assert visible strings and structure; `tests/__snapshots__` may change; `gate-audit.test.ts` and the contract tests assert API `labels` and must stay unchanged.

*Observations not fixed here:* the failed-then-reconciled run that stays `FAILED` with a verified payment (E3) may be a product bug in the #305 recovery path; the "short answer" selection (H2) is a research-lane question.
