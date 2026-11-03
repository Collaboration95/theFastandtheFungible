# SFF push: tracker and changelog

The single running record for the SingHacks finals push: submit by **Thu 12 Nov**
(official deadline 13 Nov, 23:59 SGT), pitch at SFF on **Wed 18 Nov, 11:30 SGT**.
How we're scored: [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md). The October design
record stays in [FINAL-PUSH.md](FINAL-PUSH.md).

**Agents:** read this first if you need a starting point. Update it when you ship
something significant: a feature, a metric move, a finished deliverable. Don't
add an entry for every small fix. One line per item, newest day first; link the
PR or issue.

## Deliverables

| Track | Deliverable | Issue | Status |
|---|---|---|---|
| Product | Cleanup: security deps, test safety, dead code, docs truth | #248–#250 | done ([#254](https://github.com/Collaboration95/theFastandtheFungible/pull/254)) |
| Product | Cheaper CI: docs-only changes skip tests, no duplicate runs | #252 | done |
| Product | Nightly scorecard + hard-gate audit | #256 | local-only · live pre/post-menu and fixture scores, 3 Nov |
| Product | MCP server: any agent searches and buys within a human-set cap | #255 | done · fixture proof + Claude Code transcript |
| Product | Feature-a-day run: 9 notable features, one release each, Thu 5 → Fri 13 ([calendar](#feature-a-day-5-13-nov)) | #270, #260, #259, #262, #273–#277; slack #278–#281 | planned · 5–13 Nov |
| Product | Day 1: the local app done properly (keyboard-first, state model, record mode) | #270 | done · keyboard-first app, unified state and record mode (Lane A) |
| Product | macOS app (Electron DMG): Keychain seed, signing pipeline ready for the Developer ID | #259 | planned · Sat 7 |
| Product | Hill-climb: fact menu, then value-of-information buying + nightly refit | #260, #276 | #260 implemented · both live targets missed; #276 next |
| Product | Surprise bet 1: proof-or-refund escrow on XRPL | #261 spike, #273 build | spike complete · bounded Testnet hybrid recommended; build Mon 9 |
| Product | Pay writers in RLUSD on Testnet | #275 | planned · Wed 11 |
| Product | Surprise bet 2: hire the agent (agent-to-agent x402 with citation royalties) | #274 | planned · Tue 10 |
| Product | Publish in one command: a Markdown folder becomes a paid writer | #277 | implemented · 18.90 s Testnet paid read, 3 Nov |
| UI/UX | The cast (restrained, on one grid with the brand) + motion: the money visibly moves | #258, #262 | cast v1 done (#258); motion planned Sun 8 (#262) |
| Repo | Front door: settings, topics, community files, hygiene check, a release per feature day | #269 | done · social preview upload on #265 |
| Repo | Brand kit: wordmark, mark, favicon, app icon, social preview, naming audit | #271 | done · reproducible exports + app/site source integration |
| Repo | README overhaul + one header across the explainers site | #272 | pass 1 done (3 Nov) · app GIF, Mac download link, final numbers in pass 2 (Wed 11) |
| Submission | Short description · demo video · pitch deck · public repo | plan only | planned · 8–11 Nov |
| Builder feedback | [Living log from building + mainnet-readiness checklist](BUILDER-FEEDBACK.md) | #257 | done (15 implementation findings + 15 historical submissions) |
| Story | Daily posts (two on weekends, [post calendar](#post-calendar)) + SFF chapter on the [evolution page](https://collaboration95.github.io/theFastandtheFungible/evolution/) | #257 | daily log ready; SFF chapter publishes after main merge |
| Presentation | 2-minute pitch, rehearsed | plan only | planned · 14–18 Nov |

## Hill-climb scorecard

Baselines are from the 9 Oct live runs (see `eval/REPORT-decisions.md`,
`eval/REPORT-coverage.md`). From #256, `make scorecard` writes
`eval/scorecard/history.jsonl`; paste "before → after" here when a number moves.

| Metric | Live baseline (9 Oct) | live, pre-fact-menu · 3 Nov SGT | live, post-fact-menu + #301 · 3 Nov SGT | Target 12 Nov |
|---|---|---|---|---|
| Wasted spend | 39.5% | 36.19% | 47.19% (target missed; +11.00 pts) | ≤ 20% |
| Purchase-selection F1 | 0.24 flow / 0.41 sweep | 0.235 flow / 0.400 sweep | 0.419 flow / 0.513 sweep (0.45 lane target missed) | ≥ 0.5 flow |
| Supported-fact uplift from paying | +9.5 pts | +11.32 pts | +16.98 pts | ≥ +20 pts |
| False-complete rate | 1.9% | 1.89% | 1.89% | ≤ 2% |
| p95 time to first answer | not measured | 132.7 ms (p50 77.9) | 131.2 ms (p50 73.1; final p95 3709.2) | set after baseline |
| Cost per timed query (model US$ + XRP spent) | not measured | US$0.00236 + 0 XRP drops | US$0.00254 + 0 XRP drops | set after baseline |
| Cold start (launch → ready; app and engine) | not measured | 761.5 ms (booted demo) | 533.7 ms (booted demo; engine/app unmeasured) | < 5 s |
| MCP e2e pass (fixture stdio) | 0 | 1 | 1 (separate fixture evidence) | 1 nightly locally |
| MCP: question → paid, cited answer from Claude Code | not possible | PASS · fixture, 23.3 s including retry | unchanged separate fixture evidence | passes nightly locally |
| Hard-gate violations (six rules) | 0 expected, not re-verified | 0 / 10 runs | 0 / 10 runs | 0, audited locally |

The valid pre-menu run at `2026-11-02T16:30:12.474Z` was recovered, not repeated.
Latest: `2026-11-03T01:49:48.288Z`, prompt v3, after integrating #300 and #301.
**Both #260 targets are missed:** F1 ≥ 0.45 and waste ≤ 25%. Waste regressed
**11.00 percentage points** from the fresh baseline. No threshold or test was
relaxed. The explicit lane request says to ship and report missed targets;
this does not meet the issue's original no-regression acceptance condition.
These are live decision/coverage models, synthetic articles, fixture planner/writer,
keyword search and **SIMULATED payments** (zero XRP transferred). Flow fact support
uses scripted bank needles; false-complete uses live coverage-model judgments.
Timing is Mac wall clock, not full-product/XRPL latency. #301 changed the public
input context too, so this is an integrated before/after, not an isolated menu effect.

Fixture before → after: F1 **0.310 / 0.222 → 0.310 / 0.222**, waste
**67.93% → 67.93%**, uplift **+28.30 → +28.30 pts**, false-complete
**37.74% → 37.74%** (overlap fixture), **0 → 0 gate violations**.
Same-input `--check --compare 2026-11-03` passed with zero quality deltas.
Bank, prose and coverage snapshots are unchanged; treatment hashes differ.

Total task model cost **US$1.2739735**, including every recovered failure/probe
and completion attempt; latest **US$0.1180476**, 260 calls. Usage-derived estimates
at dated harness rates, not invoices: `eval/scorecard/lane-b-spend.json`.
The final calibration fit was rejected by its own rule; calibration stays off.
See the dated section in `eval/REPORT-decisions.md`. Next: #276 marginal-fact value
buying, precise measure/period menus, and held-out evaluation of the hardened prompts.

## Plan

### Feature-a-day: 5-13 Nov

Written 3 Nov by the second planning pass. **Public commitment: one notable
feature a day for nine days, Thu 5 → Fri 13 Nov,** each with its own tagged
release, then polish to the pitch. Owner rules: every day's feature must make an
engineer stop scrolling, nothing gets padded out to fill a day, and nothing
bloats the product. If a feature slips, a slack feature (F10–F13) takes its
day; the streak doesn't break. Day 0 (Wed 4) is the announcement: MCP (#255,
shipped 3 Nov) and the first scorecard (#256).

**Design bar (owner, 3 Nov):** a YC-style startup product: clean, fast, it
works (Linear, Vercel, Stripe docs). No childish or hyper-interactive gimmicks.
Motion only where it carries meaning (money moving, a state changing). This
applies to the app, README, logo, site and the cast (#258).

| Day | Date | Feature | Criterion | Post angle (feature · visual · number · takeaway) | Issue | Release |
|---|---|---|---|---|---|---|
| 0 | Wed 4 | MCP server + first scorecard | Reachability · Feasibility | Claude Code bought an article on XRPL inside a cap I set · terminal clip · `claude mcp add` → paid answer in 23 s · the calling LLM never authorizes spend; the cap lives in env | #255, #256 | `v0.1.0` |
| **1** | **Thu 5** | **The local app done properly:** keyboard-first (⌘1…, ⌘K), one state model, empty/loading states, record mode, stage-review bugs | UX & design (base for every clip) | ⌘K → ask → paid, cited answer, no mouse · 15 s clip · view switch p95 ms, 0 layout shift · design the state model before the motion | #270 | `v0.2.0` |
| 2 | Fri 6 | **Fact menu:** writers sign what each article answers | Technical depth · Creativity | our agent stopped buying teasers · before → after chart · selection F1 0.24 → N, wasted spend 39.5% → N · signed metadata beat prompt tweaks | #260 | `v0.3.0` |
| 3 | Sat 7 | **Mac app** (DMG, Keychain seed, signing pipeline) on Day 1's UI | Reachability · Feasibility | install → first paid answer · 20 s clip from DMG to receipt · cold start N s · Electron's `utilityProcess` ran our Node engine unchanged | #259 | `v0.4.0` |
| 4 | Sun 8 | **Watch the money move:** coin flight, ledger close, refund | UX & design | animate the money, nothing else · UC3 clip · ledger close → receipt in N s · motion should carry state, not decoration | #262 | `v0.5.0` |
| 5 | Mon 9 | **Proof-or-refund escrow** on XRPL | Technical depth · Creativity | the ledger, not the writer, enforces refunds · explorer EscrowCreate → EscrowCancel · +N s, N drops per purchase · a native ledger primitive beat deploying a contract | #273 (spike #261) | `v0.6.0` |
| 6 | Tue 10 | **Hire the agent:** x402 answers for other agents, citation royalties | Creativity · Reachability | one question, three+ wallets · money-chain diagram with tx hashes · split of one S$2 question · the citation list is a payment instruction | #274 | `v0.7.0` |
| 7 | Wed 11 | **Pay in RLUSD** on Testnet | Reachability · Technical depth · Feasibility | agents pay writers in a stablecoin · receipt + explorer · settle time and fee · check `delivered_amount`, never `Amount` | #275 | `v0.8.0` |
| 8 | Thu 12 | **Learns from its receipts:** value-of-information buying + nightly refit | Feasibility · Technical depth | it got better at spending by itself · wasted spend by night, 9 Oct → 12 Nov · 39.5% → N% · your purchase log is free ground truth | #276 | `v0.9.0` |
| 9 | Fri 13 | **Publish in one command:** Markdown folder → paid writer | Reachability (supply side) | any expert, one command · 20 s terminal clip · folder → paid by an agent in N s · agent commerce supply side = static site + signed manifest + wallet | #277 | `v0.10.0` |

**Slack (fills a slipped day, or extends the streak into Sat 14 / Sun 15):**

| # | Feature | Criterion | Post angle | Issue |
|---|---|---|---|---|
| F10 | **Verify any answer:** receipt bundle + `npm run verify` + browser verifier | Technical depth | don't trust our agent, verify it · all-green table, then one red after a byte flips | #278 |
| F11 | **Chaos test + 12 h soak** | Feasibility | 500 injected failures, 0 double charges | #279 |
| F12 | **One wallet, many agents:** per-agent keys and allowances | Reachability · Technical depth | give each AI agent its own allowance; revoke in a click | #280 |
| F13 | **Answers in seconds:** stream the free draft, upgrade with paid evidence | Feasibility | p95 time to first answer N s → N s | #281 |

**Ranked by judging impact** (weights in [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md)):
1 hire the agent (#274) · 2 Mac app (#259) · 3 escrow (#273) · 4 RLUSD (#275) ·
5 fact menu (#260) · 6 publish (#277) · 7 many agents (#280) · 8 verify (#278) ·
9 learns from receipts (#276) · 10 chaos (#279) · 11 streaming (#281) ·
12 app foundation (#270) · 13 motion (#262). The app foundation ranks low on
weight but goes first: every later clip, the Mac app and the video are recorded
on it.

**Dependencies:** #270 → #259, #262, #273, #274, #275 (state model and rail
label) and every clip. #258 → #271 (brand) → #259 (icon), #272 (README).
#261 spike → #273 (no-go: F10 takes Day 5). #163 price units → #275.
#255 → #274, #277, #280. #256 → #260, #276, #279, #281 (before → after).
#260 → #276, #277 (fact menu). #273 → #275 only for RLUSD escrow.

**Why Electron for the app:** the engine is Node (`node:sqlite`, `xrpl`, Orama,
Express). Electron runs it unchanged in a `utilityProcess`; Tauri needs a
bundled Node sidecar and a Rust shell. ~120 MB download, zero rewrite (#259).

### Repo identity (the timeline will get traffic; make it look funded)

| Issue | What | When | Who |
|---|---|---|---|
| #269 | **Repo front door:** description, topics, homepage (`gh repo edit`); LICENSE, CONTRIBUTING, SECURITY, CoC, issue templates; hygiene check in `check:fast`; **one tagged release per feature day** | Wed 4 – Thu 5 | Sonnet + small Sol pass |
| #271 | **Brand kit:** wordmark and mark generated in SVG on #258's grid, favicon set, app icon (`.icns` for #259), social preview, OG images, naming audit ("ResearchAgent" everywhere) | Thu 5 – Fri 6 | Opus directs, Sol builds |
| #272 | **README overhaul + one site header:** hero, real badges, 15 s demo, 3-command quick start, "try it in Claude Code", Mac download, generated architecture SVG and scorecard table; shared header across gh-pages | Sat 7, numbers refreshed Wed 11 | Sonnet writes, Sol builds |

### Surprise bets

1. **Proof-or-refund escrow** (#261 spike Fri 6, build #273 Sat 7 – Mon 9). The
   buyer pays into an XRPL Escrow; the article's proof releases it, a broken
   promise lets it cancel back. Refunds stop depending on the writer's goodwill.
   Native XRPL (Escrow + crypto-conditions, no contract deploy) and new ground
   for x402. *Could win because* it is the one feature only XRPL makes cheap,
   and it turns our UC3 refund scene from "the liar cooperated" into "the
   ledger enforced it".
2. **Hire the agent** (#274, Tue 10). ResearchAgent sells its own answers over
   x402: an outside agent pays it, it pays the writers it buys from, then
   forwards a **citation royalty** to every writer it cited, free ones
   included, and returns the change. Gates hold: the caller's payment is the
   budget, our policy code makes every purchase, royalties are deterministic
   from the citation list. *Could win because* it is an AI-native business
   model (agents as customers *and* sellers), the Creativity criterion
   verbatim.
3. **Publish in one command** (#277, Fri 13): promoted from stretch to Day 9.

### Lanes

At most three coding lanes; the light lane (Sonnet/Opus docs, config, deck,
video, post drafts) runs beside them and touches no product code.

| Lane | Now (3 Nov) | Next |
|---|---|---|
| A · Reach (Sol) | #255 shipped | #270 app foundation (Wed 4 → Thu 5) → #259 Mac app (→ Sat 7) → #274 hire the agent (Sun 8 → Tue 10) → #277 publish (Wed 11 → Fri 13) → slack #280 |
| B · Engine (Sol; Opus designs) | #256 scorecard | #260 fact menu (Wed 4 → Fri 6) · Opus #261 spike Fri 6 → #273 escrow (Sat 7 → Mon 9) → #276 learns from receipts (Tue 10 → Thu 12) → slack #279, #281 |
| C · Design (Sol; Opus directs) | #257 + #258 | #271 brand kit (Thu 5 → Fri 6) → #262 motion (Sat 7 → Sun 8) → #275 RLUSD (Mon 9 → Wed 11) → slack #278 |
| Light (Sonnet, Opus) | — | #269 repo front door (Wed 4 → Thu 5) · #272 README (Sat 7, Wed 11) · deck v1 Sun 8, v2 Wed 11 · video storyboard Mon 9, cut Wed 11 · short description Tue 10 · daily post drafts |

### Polish to the pitch (no new features unless the streak runs into the weekend)

| Day | Work |
|---|---|
| Thu 12 | **Submit** (owner): description, deck, repo, video. Day 8 ships the same day; nothing in the video depends on it. |
| Fri 13 | Day 9 ships. Buffer for the official deadline (23:59 SGT). |
| Sat 14 – Sun 15 | Slack features if one slipped. Stage kit: the app runs fully offline (fixture) as the venue fallback; `make preflight` covers the app; 2-minute script timed; Q&A sheet with the scorecard numbers (Opus). |
| Mon 16 | Recorded run-throughs; fix what stumbles. |
| Tue 17 | Dress rehearsal on a phone hotspot; freeze `main`; release `v1.0.0`. |
| Wed 18 | Pitch, 11:30 SGT. |

### Post calendar

About one LinkedIn post a day, two on Saturdays and Sundays. Drafts come from
the li-bot skill (Sonnet); each feature post uses that day's issue **Post**
section (feature, visual, number, takeaway) and a clip from `make clip`
(#270).

| Date | Post | Visual | Number | Takeaway for engineers |
|---|---|---|---|---|
| Tue 3 | We're SFF finalists; publicly committing to one feature a day, 5–13 Nov | the calendar as a card | 9 days, 9 releases | how three agent lanes ship hands-off, merge on green |
| Wed 4 | Day 0: Claude Code bought an article over MCP | terminal clip | 23 s to a paid, cited answer | the LLM caller never holds spending authority |
| Thu 5 | Day 1: the app (#270) | 15 s keyboard-only clip | view switch ms, CLS 0 | one derived state model |
| Fri 6 | Day 2: fact menu (#260) | before → after chart | F1, wasted spend | signed metadata > prompt tweaks |
| Sat 7 a | Day 3: Mac app (#259) | DMG → receipt clip | cold start s | Electron `utilityProcess` ran the Node engine unchanged |
| Sat 7 b | Design: the README and brand, before / after (#271, #272) | README hero before/after | — | treat the README as a landing page with tests |
| Sun 8 a | Day 4: watch the money move (#262) | UC3 clip | ledger close → receipt s | animate the money, nothing else |
| Sun 8 b | Builder feedback: 5 things we'd fix on XRPL / x402 (#257) | the Top-5 table | N items from building | concrete repros beat wishlists |
| Mon 9 | Day 5: escrow (#273) | explorer create → cancel | +s, drops per purchase | native primitives over contracts |
| Tue 10 | Day 6: hire the agent (#274) | money-chain diagram | split of one S$2 question | citations as payment instructions |
| Wed 11 | Day 7: RLUSD (#275) | receipt + explorer | settle time, fee | `delivered_amount`, never `Amount` |
| Thu 12 | Day 8: learns from receipts (#276), and we submitted | wasted-spend-by-night chart | 39.5% → N% | your purchase log is ground truth |
| Fri 13 | Day 9: publish in one command (#277) | terminal clip | folder → paid in N s | supply side in one command |
| Sat 14 a | Build story: 9 features in 9 days | Releases page / evolution timeline | PRs, releases, agent-hours | a release a day forces "done" to mean shipped |
| Sat 14 b | Numbers: the 10-day scorecard, every metric before → after | scorecard table | all rows | measure nightly or you are guessing |
| Sun 15 a | Design: one grid for brand, icon and cast (#271, #258) | brand sheet | — | generate the brand from code |
| Sun 15 b | How the agents built it: Sol / Opus / Sonnet split | evolution charts | tokens, PRs per model | which work went to which model, and why |
| Mon 16 | Five hard gates: how we test that an LLM can't spend | gate-audit output | 0 violations over N runs | put the money rules in code and audit them nightly |
| Tue 17 | Two minutes: what we cut from the pitch | script draft | 120 s | — |
| Wed 18 | Pitch day at SFF | stage photo | — | — |

### How the loops run

- Each lane agent takes the next item in its lane, ships it with
  `.claude/skills/ship-pr/SKILL.md`, adds one changelog line here, fills the
  PR's **Story** section (post line, visual, number) and, on a feature day,
  cuts that day's release: from a clean, current `main`,
  `node scripts/release.mjs <day> "<title>" --push` (Day N is `v0.(N+1).0`; add
  `--dry-run` to preview the notes). Pushing the tag publishes the GitHub release.
- Every hill-climb PR pastes `make scorecard -- --compare <previous>` output.
  Ship it only if no gate metric regresses.
- Friction with XRPL, x402, the Starter Kit or Testnet goes into the builder
  feedback log the day it happens.
- Live calls use `EVAL_*` keys within `EVAL_SPEND_CAP_USD`; Testnet only; never
  real money, never cloud resources, never a printed key or seed. The live
  nightly scorecard runs on the owner's Mac, not in CI (decided).

### Needs a human

Everything only the owner can do lives in **[pinned issue #265](https://github.com/Collaboration95/theFastandtheFungible/issues/265)** (pinned, `needs-human`).
Agents add items there and keep working around them.

## Decisions log

- 3 Nov: #260 reuses #300’s signed manifest-v2 `covers` format; bounded untrusted promises are checked on the bound passage, never treated as coverage. Scorecards run locally; final calibration fit rejected; stays off, raw threshold unchanged.
- 3 Nov: #274 hire-v1 receives Testnet funds, reserves budget plus fee through the shared admission, pays a fixed 25% fee royalty equally by distinct cited writer, and returns gross unspent budget; API/SDK/CLI money chain precedes the queued UX work.

- 3 Nov: #261 recommends buyer-held hashlock + CancelAfter for opted-in Testnet writers; ledger enforces cancellation, buyer verifies proof; no fair-exchange or RLUSD claim ([spike](spikes/escrow.md), #273).
- 3 Nov: #287 retains serialized signing and releases payer sequencing on ledger proof, independent of writer delivery; uncertain sequences refuse new signing after a bounded wait. Live recovery reuses the journal blob every 15 s; no Tickets/local sequence allocator before SFF. Scorecard fingerprint v3 retains all exact hashes and prior history for telemetry-only source changes.

- 3 Nov: #277 uses the canonical #260 manifest v2 schema and passage-bound menu verifier; carry its shared protocol files until Lane B lands so the publishing command works from a clean clone.

- 3 Nov: #277 publishes locally with a private `.env.writer`, deterministic public topics, unverified identity and the operator payee denylist; npm distribution stays an owner choice on #265.
- 3 Nov: #286 uses one operator bearer token plus exact Host/Origin checks; local launchers generate and privately forward a token so the demo needs no extra setup.
- 3 Nov: #286 defaults: S$5/run, S$1/source, S$20 gross/wallet/UTC day, MCP caps zero; refunds never restore authority and pause is durable.

Significant product, design and process decisions, newest first. One line each: date, decision, why, link.


- 3 Nov: Logo direction chosen: open index, because source boundaries and a route to evidence read at 16 px on the cast’s 24-unit grid; Ink/Paper with sparse Salmon layout accents. Explainers source moves into `site/` for one reviewable app/site identity kit (#271).
- 3 Nov: Added a 4th lane (Architecture) for #285–#288 because #286 auth must land before the Mac app #259 and hire-the-agent #274.
- 3 Nov: SDK: TypeScript in-repo now, Python stdlib example, npm publish pending owner (#265).

- 3 Nov: Overnight autonomous run: Opus orchestrates, Sol/Terra/Sonnet code, auto-merge on green (owner request).
- 3 Nov: Design bar: YC-style clean (Linear/Vercel/Stripe), no childish or hyper-interactive UI; motion only for meaning.
- 3 Nov: Day 1 of the feature run is the local app foundation (#270), because every later post needs a recordable clip.
- 3 Nov: Electron chosen over Tauri for the Mac app (#259): the backend is Node and runs unchanged.
- 3 Nov: Apple Developer ID: yes, owner sets it up later (#265). Until then the app is unsigned with a signing pipeline ready.
- 3 Nov: Nightly scorecard runs locally on the owner's Mac, not in CI.
- 3 Nov: Owner-only tasks live in pinned issue #265.
- 3 Nov: Cloud Run held in reserve; local-first.

## Changelog

- 3 Nov: Lane D #287 live payment reconciliation, reserve precheck, protected deep health/metrics, JSON money logs and ops runbook; synthetic queued-payment p95 307.91→6.24 ms under 300 ms writer delay; one verified 0.06 XRP Testnet payment ([evidence](evidence/payment-ops-287.md)).
- 3 Nov: #274 adds x402 hired answers, generic `sdk/x402` buyer, optional remote MCP hire, durable capped royalties/change and a separate caller demo; fixture and live chain evidence in `docs/evidence/hire-274.md`.

- 2026-11-03: #286 shared admission, wallet cap/pause, bearer and rebinding guards, capped decision inputs and adversarial injection pack; native token contract posted on #259.
- 3 Nov: Lane C #261 standalone Testnet escrow spike: clean release 14.492 s / 435 drops, cancel 54.871 s / 24 normal-path drops, nine validated txs including negative probes; #273 build contract and live builder feedback ([evidence](spikes/escrow.md)).

- 2026-11-03: Reused test search indexes and optimized leak-oracle comparisons to shorten hard-gate runs without changing coverage.
- 3 Nov: #277 Markdown publishing command, three starter articles, signed x402 writer and local registration; Testnet folder → verified paid read **18.90 s**, one **0.01 XRP** payment ([proof](evidence/publish-site-277.md)).

- MCP Testnet proof: stdio purchase settled on XRPL Testnet with delivered citations and a ledger-checked idempotent retry.

### Tue 3 Nov
- Lane B #260: signed corpus fact menus, both decision providers and local scorecards; live F1 0.235 → 0.419, waste 36.19% → 47.19% (both targets missed), zero gate violations; README regenerated, fixture quality unchanged.
- Published the branded explainers and shared header to Pages, preserving the evolution dataset and branch-only content; added a manual publish script.
- UI polish: use the brand palette's purse icon in the budget card and correct singular count labels.
- Lane light #272 (pass 1): startup-style README (hero, Claude Code MCP in one command, local run, how a run works, Testnet proof, fixture-labelled scorecard table generated by `scripts/readme-scorecard.mjs`); MCP and make-target detail moved to [mcp.md](mcp.md) and [running.md](running.md); one header across the explainers pages via `scripts/site-header.mjs` (checked in `npm run hygiene`; slides and notes keep their own presentation chrome). App GIF and Mac download link wait for pass 2.
- Lane C #271: shipped the open-index brand kit, deterministic SVG/PNG/ICO/ICNS exports, app and explainers-source favicons/OG cards, naming audit, and two restrained cast refinements.
- Lane D #285: typed TypeScript SDK, SDK-backed MCP tools, validated config and mechanical API routers; fixture delivery/idempotency, route parity and unchanged MCP e2e verified.
- Architecture review ([REVIEW-NOV-2026.md](contracts/REVIEW-NOV-2026.md)): four do-now seams filed as #285 (SDK v0, config, route split), #286 (one spend gate, auth, injection hardening), #287 (live reconciler, health, metrics), #288 (audit trail, export, COMPLIANCE.md); fold-ins commented on #259, #273–#275, #277–#281.
- Lane light #269: repo front door. Description, topics and homepage set; MIT licence (revertible until the owner's veto on #265), CONTRIBUTING, SECURITY, Code of Conduct, issue templates, CODEOWNERS; `npm run hygiene` in `check:fast`; `scripts/release.mjs` and a release workflow for one tag per feature day.
- Lane A #270: keyboard-first Run/Writers, one event-derived state model, visible simulation rails, stage-review fixes #225–#231 and isolated recording/18 s clips; 11 production-browser checks pass, UC2 CLS 0.0138.
- Planned the feature-a-day run (9 days, 5–13 Nov, slack of 4), repo identity and the post calendar; filed #269–#281; owner-only items moved to #265 ([calendar](#feature-a-day-5-13-nov)).
- Lane A #255: reusable isolated engine + four stdio MCP tools; human caps and durable retries; fixture search → simulated purchase → delivered citations proven end to end.

### Mon 2 Nov
- Lane B: nightly scorecard + six-rule read-only gate audit (#256); 48 questions, 116 coverage snapshots, 10 timed API queries, zero provider calls and zero gate violations. Live unavailable without EVAL credentials.
- Lane C: added 15 implementation-backed feedback items plus the 15 September submissions, a mainnet gap checklist, and a restrained 48-state SVG system (including 16/24 px marks) with accessible React marks and reusable post cards (#257, #258); SFF timeline chapter follows the main merge.
- Planned the next 10 days: three lanes, two surprise bets, wave-1 issues #255–#262 ([Plan](#plan)).
- Audit cleanup: patched production dependencies, synchronized Stop scoring, isolated browser-test ports/ledgers, corrected preflight and docs, and aligned the search eval with production ([#254](https://github.com/Collaboration95/theFastandtheFungible/pull/254)).
- Resumed after the 10–11 Oct demo. Audits: CI green, 478 tests pass, fixture demo runs end to end.
- Judging criteria and PR template: every PR opens with the criterion it serves (#251).
- Filed the cleanup as #248–#250 (one PR). Started the CI-cost work. Started planning the next feature set.
- Closed stale draft PRs #245, #246. Cloud Run kept in reserve (code at `ce77f59`).
