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

| Track | Deliverable | Status |
|---|---|---|
| Product | Cleanup: security deps, test safety, dead code, docs truth (#248–#250) | in progress |
| Product | Cheaper CI: docs-only changes skip tests, no duplicate runs | in progress |
| Product | Hill-climb scorecard (wasted spend, selection F1, fact uplift…) run nightly | planned |
| Product | Next big features (local-first desktop app, MCP server, …) | being planned |
| UI/UX | Redesign / polish of the end-to-end flow (payments and on-chain steps legible) | planned |
| Submission | Short description · demo video · pitch deck · public repo | planned |
| Builder feedback | Running log of XRPL / Starter Kit / x402 friction, written up for judges | planned |
| Story | Daily build-in-public posts + public timeline page | planned |
| Presentation | 2-minute pitch (plan for 2, Tenity says 2 or 3), rehearsed | planned |

## Hill-climb scorecard

Baselines are from the 9 Oct live runs (see `eval/REPORT-decisions.md`,
`eval/REPORT-coverage.md`). Add a row when a number moves.

| Metric | Baseline | Latest |
|---|---|---|
| Wasted spend (purchases adding no supported fact) | 39.5% | — |
| Purchase-selection F1 | 0.24 (flow) / 0.41 (sweep) | — |
| Supported-fact uplift from paying | +9.5 pts | — |
| False-complete rate | 1.9% | — |
| p95 time to first answer | not measured | — |
| Hard-gate violations | 0 expected, not re-verified | — |

## Changelog

### Mon 2 Nov
- Resumed after the 10–11 Oct demo. Audits: CI green, 478 tests pass, fixture demo runs end to end.
- Judging criteria and PR template: every PR opens with the criterion it serves (#251).
- Filed the cleanup as #248–#250 (one PR). Started the CI-cost work. Started planning the next feature set.
- Closed stale draft PRs #245, #246. Cloud Run kept in reserve (code at `ce77f59`).
