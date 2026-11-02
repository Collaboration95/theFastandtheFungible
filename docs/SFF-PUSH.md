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
| Product | Nightly scorecard + hard-gate audit | #256 | planned · 3–4 Nov |
| Product | MCP server: any agent searches and buys within a human-set cap | #255 | done · fixture proof + Claude Code transcript |
| Product | macOS app (Electron DMG): local engine, Keychain seed, local or remote backend | #259 | planned · 5–7 Nov |
| Product | Hill-climb: one shipped improvement per day that moves a scorecard number | #260 first | planned · from 5 Nov |
| Product | Surprise bet 1: proof-or-refund escrow on XRPL | #261 spike | planned · 6–9 Nov |
| Product | Surprise bet 2: hire the agent (agent-to-agent x402 with citation royalties) | plan only | planned · 10 Nov |
| UI/UX | The cast (sprites) + motion pass: the money visibly moves | #258, #262 | planned · 4–7 Nov |
| Submission | Short description · demo video · pitch deck · public repo | plan only | planned · 8–11 Nov |
| Builder feedback | Living log from building + mainnet-readiness checklist | #257 | planned · 3 Nov |
| Story | Daily posts + SFF chapter on the [evolution page](https://collaboration95.github.io/theFastandtheFungible/evolution/) | #257 | planned · 3 Nov, then daily |
| Presentation | 2-minute pitch, rehearsed | plan only | planned · 14–18 Nov |

## Hill-climb scorecard

Baselines are from the 9 Oct live runs (see `eval/REPORT-decisions.md`,
`eval/REPORT-coverage.md`). From #256, `make scorecard` writes
`eval/scorecard/history.jsonl`; paste "before → after" here when a number moves.

| Metric | Baseline (9 Oct) | Latest | Target 12 Nov |
|---|---|---|---|
| Wasted spend (purchases adding no supported fact) | 39.5% | — | ≤ 20% |
| Purchase-selection F1 | 0.24 (flow) / 0.41 (sweep) | — | ≥ 0.5 (flow) |
| Supported-fact uplift from paying | +9.5 pts | — | ≥ +20 pts |
| False-complete rate | 1.9% | — | ≤ 2% |
| p95 time to first answer | not measured | — | set after baseline |
| Cost per query (model US$ + XRP spent) | not measured | — | set after baseline |
| Cold start (launch → ready; app and engine) | not measured | — | < 5 s |
| MCP e2e pass (fixture stdio) | 0 | 1 | 1 nightly |
| MCP: question → paid, cited answer from Claude Code | not possible | PASS · fresh fixture session, 23.3 s including retry | passes nightly |
| Hard-gate violations (`scripts/gate-audit.ts`) | 0 expected, not re-verified | — | 0, audited nightly |

## Plan

Written 2 Nov by the planning agent. Lanes run in parallel; one Sol agent per
issue; at most three PRs in flight. Wave 1 (3–7 Nov) is filed as issues; later
waves live here until the lane reaches them, then the lane's agent files the
issue with the same shape (criterion, checklist, files, acceptance, post angle).

### What we build, ranked by criterion weight per day

| # | Idea | Serves | Why |
|---|---|---|---|
| 1 | **MCP server** (#255) | Reachability 25% | Any agent becomes a customer in one `claude mcp add`. Two days. |
| 2 | **Nightly scorecard + gate audit** (#256) | Feasibility, Technical depth | Every other claim needs numbers; turns the five gates into a nightly 0. |
| 3 | **Fact menu** (#260) | Technical depth, Creativity | Attacks the measured cause of under-buying (teaser abstracts): F1 0.24, 39.5% waste. |
| 4 | **macOS app** (#259) | Reachability, Feasibility | The owner's gold standard; runs offline for judges; seed in the Keychain. |
| 5 | **Builder-feedback log** (#257) | Builder feedback 10% | Cheapest 10% on the sheet; every lane feeds it. |
| 6 | **The cast + motion** (#258, #262) | UX & design 10% | "How payments are communicated" is the UX criterion's own wording. |
| 7 | **Escrow** (#261) | Technical depth, Creativity | Surprise bet 1 (below). |
| 8 | **Hire the agent** | Creativity, Reachability | Surprise bet 2 (below). |

**Why Electron for the app:** the engine is Node (`node:sqlite`, `xrpl`, Orama,
Express). Electron runs it unchanged in a `utilityProcess`; Tauri needs a
bundled Node sidecar and a Rust shell. ~120 MB download, zero rewrite (#259).

### Surprise bets

1. **Proof-or-refund escrow** (#261, spike 6 Nov, build 8–9 Nov). The buyer pays
   into an XRPL Escrow; the article's proof releases it, a broken promise lets
   it cancel back. Refunds stop depending on the writer's goodwill. Native XRPL
   (Escrow + crypto-conditions, no contract deploy) and new ground for x402.
   *Could win because* it is the one feature only XRPL makes cheap, and it turns
   our UC3 refund scene from "the liar cooperated" into "the ledger enforced it".
2. **Hire the agent** (10 Nov). ResearchAgent sells its own answers over x402:
   an outside agent (through the MCP server or any x402 client) pays it, it pays
   the writers it buys from, then forwards a small **citation royalty** to every
   writer it cited, free ones included. One question becomes a visible money
   chain on Testnet: agent → agent → writers. Gates hold: the outside caller's
   payment is its budget, our policy code still makes every purchase, royalties
   are deterministic from the citation list. *Could win because* it is an
   AI-native business model (agents as customers *and* sellers), which is the
   Creativity criterion verbatim, and it pays writers for being cited, not only
   for being bought.
3. *Stretch, after 12 Nov:* **publish in one command**: `npx` turns a folder of
   Markdown into a writer site with search, signed manifests, an x402
   facilitator and a funded Testnet wallet (the supply side of Reachability).

### Lanes

- **Lane A · Reach** (Sol): engine boot → MCP → Mac app → escrow → hire the agent.
- **Lane B · Hill-climb** (Opus designs, Sol builds): scorecard → one lever a day.
- **Lane C · Story & design** (Sonnet writes, Opus art-directs, Sol builds UI):
  feedback log and timeline → cast → motion → deck → video.

Dependencies: #255's `server/engine.ts` → #259 (app) and #256 (latency, cold
start). #258 (cast) → #262 (motion) → video. #256 → every hill-climb "before →
after" and the deck's numbers. #261 spike → escrow build. #255 → hire the agent.

### Day by day

| Day | Lane A · Reach | Lane B · Hill-climb | Lane C · Story & design | Post angle |
|---|---|---|---|---|
| Tue 3 | #255 engine boot + MCP tools | #256 scorecard + gate audit | #257 feedback log; timeline chapter | "We're finalists. 10 days, 3 agent lanes, building in public." |
| Wed 4 | #255 ships: Claude Code buys via MCP (Reachability) | #256 ships: first full report card (Feasibility) | #258 cast v1 | "Claude Code just bought its first article on XRPL, inside a budget I set." |
| Thu 5 | #259 app shell, engine in `utilityProcess` | #260 fact menu: schema, signing, prompts | #258 ships: QA sheet + post cards (UX) | "Meet the cast: Scout, Purse, eight writers and one liar." |
| Fri 6 | #259 Keychain seed, backend switch | #260 ships: F1 and wasted spend move (Technical depth) · #261 spike (Opus) | #262 motion: money flight, ledger close | "Writers now sign what they know. Our agent stopped buying teasers." |
| Sat 7 | #259 ships: DMG (Reachability, Feasibility) | B3 value-of-information rule: buy only when expected supported facts × trust beat the price; budget-aware stop (wasted spend) | #262 ships + #225–#231 (UX) | "ResearchAgent is a Mac app. Your seed never leaves the Keychain." |
| Sun 8 | A3 escrow build from the #261 decision | B4 learn from receipts: nightly refit of calibration from verified/refunded purchases (F1, Brier) | C4 pitch deck v1: extend `gh-pages:slides/` into a 2-minute SFF deck + PDF | "You can now watch the money move." |
| Mon 9 | A3 ships: UC3 refund via escrow cancel (Technical depth) | B5 latency: stream the free answer before purchases, parallel decision rounds (p95 TTFA) | C5 video storyboard + scripted Playwright capture of app, MCP terminal and explorer | "Refunds no longer depend on the writer's goodwill." |
| Tue 10 | A4 hire the agent: x402 `ask` endpoint + citation royalties, via MCP (Creativity) | B6 reliability and cost: provider-failure chaos test, 12 h local soak, cost per query (Feasibility) | C6 video cut v1 (captions, ffmpeg) + short description draft | "The agent got better at spending overnight, by itself." |
| Wed 11 | Freeze. App v1.0 on GitHub Releases; clean-account install test | Final live scorecard; numbers into deck and README | Final video with the human's voice; deck v2; feedback writeup final | "One question, three wallets: an agent hired an agent that paid the writers it cited." |
| **Thu 12** | **Submit** (human): description, deck, repo, video | — | — | "Submitted. Here's everything we shipped in 10 days." (timeline link) |

Polish to the pitch (no new features; fixes and rehearsal only):

| Day | Work |
|---|---|
| Fri 13 | Buffer (official deadline 23:59 SGT). Fix anything the submission run-through found. |
| Sat 14 – Sun 15 | Stage kit: app runs fully offline (fixture) as the venue fallback; `make preflight` covers the app; 2-minute script timed; Q&A sheet with the scorecard numbers (Opus). |
| Mon 16 | Recorded run-throughs, fix what stumbles; final post card set. |
| Tue 17 | Dress rehearsal on a phone hotspot; freeze `main`. |
| Wed 18 | Pitch, 11:30 SGT. |

### How the loops run

- Each lane agent takes the next item in its lane, ships it with
  `.claude/skills/ship-pr/SKILL.md`, adds one changelog line here, and fills the
  PR's **Story** section (one-line post + an image from the post-card template
  once #258 lands).
- Every hill-climb PR pastes `make scorecard -- --compare <previous>` output.
  Ship it only if no gate metric regresses.
- Friction with XRPL, x402, the Starter Kit or Testnet goes into the builder
  feedback log the day it happens.
- Live calls use `EVAL_*` keys within `EVAL_SPEND_CAP_USD`; Testnet only; never
  real money, never cloud resources, never a printed key or seed.

### Needs the human

- Confirm the team name and the submission form fields; submit on Thu 12 Nov.
- Record the video voice-over on Wed 11 (or approve a text-to-speech track).
- Post on LinkedIn daily (drafts arrive in each PR's Story section).
- Decide on an Apple Developer ID (US$99/yr) for a signed, notarized DMG.
  Without it the DMG is unsigned and judges right-click → Open.
- Optional: add `EVAL_*` repository secrets if the nightly live scorecard
  should run in CI; otherwise it runs on the owner's Mac.
- Rehearse and deliver the 2-minute pitch (14–18 Nov).

## Changelog

### Tue 3 Nov
- Lane A #255: reusable isolated engine + four stdio MCP tools; human caps and durable retries; fixture search → simulated purchase → delivered citations proven end to end.

### Mon 2 Nov
- Planned the next 10 days: three lanes, two surprise bets, wave-1 issues #255–#262 ([Plan](#plan)).
- Audit cleanup: patched production dependencies, synchronized Stop scoring, isolated browser-test ports/ledgers, corrected preflight and docs, and aligned the search eval with production ([#254](https://github.com/Collaboration95/theFastandtheFungible/pull/254)).
- Resumed after the 10–11 Oct demo. Audits: CI green, 478 tests pass, fixture demo runs end to end.
- Judging criteria and PR template: every PR opens with the criterion it serves (#251).
- Filed the cleanup as #248–#250 (one PR). Started the CI-cost work. Started planning the next feature set.
- Closed stale draft PRs #245, #246. Cloud Run kept in reserve (code at `ce77f59`).
