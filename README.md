ResearchAgent is a search engine for agent-readable expertise, with a wallet. **The Fast and the Fungible** is our team and repository name.

<p align="center"><img src="design/brand/lockup.svg" alt="ResearchAgent" height="48"></p>
<h3 align="center">Paid on delivery. Proven on the ledger.</h3>

Ask a question and set a budget. ResearchAgent searches free sources, then policy
rules decide purchases that could fill the gaps. The key that unlocks the article
is the same key that releases the writer’s payment. Your browser checks the match.

**XRPL Testnet demo · 13–19 Nov 2026.**

<p align="center"><img src="docs/assets/payment-stepper.gif" width="712" alt="A recorded payment locks in escrow; the writer publishes its key and the article unlocks."></p>
<p align="center"><sub><a href="https://collaboration95.github.io/theFastandtheFungible/demo/">Recorded replay</a>, fictional writers: locked → key published → article unlocked (waiting shortened).</sub></p>

[**Try it in your browser →**](https://collaboration95.github.io/theFastandtheFungible/try/) ·
[Check a recorded run without asking a question](https://ra-front-651013803640.asia-southeast1.run.app) ·
[Watch a recorded run](https://collaboration95.github.io/theFastandtheFungible/demo/)

<p align="center">
<a href="https://github.com/Collaboration95/theFastandtheFungible/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/Collaboration95/theFastandtheFungible?style=flat-square&label=release&color=24211E"></a>
<a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-24211E?style=flat-square"></a>
<a href="docs/key-reveal-escrow.md"><img alt="Key-reveal escrow" src="https://img.shields.io/badge/delivery-key%20reveal-2F6B4F?style=flat-square"></a>
</p>

<p align="center"><img src="docs/media/readme-answer.png" width="900" alt="ResearchAgent hosted home: ask a question with a budget or verify a recorded run."></p>
<p align="center"><sub>Hosted demo, captured 12 Nov 2026.</sub></p>

## Live demo numbers

**Hosted XRPL Testnet demo since 11 Nov, team test runs included, as of <!--f:live_asof-->12 Nov 2026, 12:24 SGT<!--/f-->.**

| Measurement | Recorded result |
|---|---|
| Questions | <!--f:live_questions-->62<!--/f--> |
| Settled purchases | <!--f:live_purchases-->74<!--/f--> |
| Median / p90 answer time | <!--f:live_median_s-->22.316<!--/f--> s / <!--f:live_p90_s-->61.061<!--/f--> s (<!--f:live_timing_n-->49<!--/f--> timed runs) |
| Median model cost per question | US$<!--f:live_model_usd-->0.0020035<!--/f--> |
| Recorded gate violations | <!--f:live_violations-->0<!--/f--> across <!--f:live_audits-->50<!--/f--> audited runs; <!--f:live_audit_unavailable-->12<!--/f--> audits unavailable |

[Snapshot and definitions](docs/submission/evidence/hosted-stats-nov12/README.md) ·
[Live scoreboard](https://ra-front-651013803640.asia-southeast1.run.app/api/demo/stats).
Model cost is separate from article prices and ledger fees.

## How it works

![Policy locks payment; writer publishes the article key to collect; buyer verifies and cites the delivered passages](docs/media/key-reveal.svg)

1. **Ask with a budget.** Confirm the plan in a five-second action sheet.
2. **Search free sources first.** Writers return abstracts and signed promises.
3. **Buy missing evidence.** Only policy code pays, at most one article per round for three rounds.
4. **Check the key and cite.** The app grants access after the escrow finish validates;
   the browser hashes the published key against the escrow lock.

Two team-authored writers, Build notes and XRPL explainers, provide paid practitioner
notes; Open Records supplies free records. [Publish your notes](docs/publishing.md).

### Hard guarantees

Every gate has regression tests and a [read-only audit rule](scripts/gate-audit.ts):

| Guarantee | Enforcement test | Audit rule |
|---|---|---|
| No premium bytes before a grant | [Purchase boundary](tests/purchase.test.ts), [raw leak audit](tests/gate-audit.test.ts) | `premium_leak` |
| Only policy code spends, within the prompt budget | [Budget and stop cases](tests/purchase.test.ts) | `purchase_without_policy`, `over_budget` |
| One charge per intent | [Parallel pays and restart cases](tests/purchase.test.ts) | `duplicate_settlement` |
| Real citations to delivered passages | [Grant and proof cases](tests/purchase.test.ts) | `citation_without_verified_grant` |
| Simulated or substituted work is labelled | [Rail label regression](tests/gate-audit.test.ts) | `missing_rail_label` |

## Use it from your agent

Give Claude Code the same research tools. The calling model cannot raise environment caps:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-mcp-1.1.1.tgz --testnet
```

Or run the complete purchase-and-verification path (Node ≥ 22.13):

```sh
REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1
npx -y $REL/researchagent-mcp-1.1.1.tgz try --testnet
```

```sh
npm i https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-sdk-1.1.1.tgz
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-1.1.1-py3-none-any.whl
```

[Install guide: TypeScript, Python, web and Mac](docs/install.md) ·
[Agent hires agent, with writer royalties](docs/hire.md).

## Verify it yourself

Open **Home → Verify → Run the checks**. The featured 12 Nov run shows all five
gates Held: browser/TS **<!--f:featured_browser-->24<!--/f--> passed, 0 failed, 2 not checked**;
Python **<!--f:featured_wheel-->25<!--/f--> passed, 0 failed, 2 skipped**.
The run bought one S$0.40 article in <!--f:featured_seconds-->31.1<!--/f--> s Start→Done,
excluding planning and the modal; its initial draft used fixture extracts and keyword search.
[Its receipts and ledger checks](docs/evidence/hosted-export-nov12/README.md).

Export any run’s receipts to check them outside the app. Separately written
TypeScript and Python verifiers agree on <!--f:vectors-->224<!--/f--> conformance cases.
[Receipt format](docs/receipt-spec.md) · [Public ledger page](https://collaboration95.github.io/theFastandtheFungible/ledger/).

## Progress and builder feedback

<!--f:prs-->308<!--/f--> pull requests merged since <!--f:since-->21 Sep<!--/f-->;
<!--f:releases-->15<!--/f--> releases, counted at <!--f:sha-->c50199e5<!--/f--> on
<!--f:as_of-->12 Nov 2026<!--/f-->.
<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->.

[Progress since SingHacks](https://collaboration95.github.io/theFastandtheFungible/progress/) ·
[Reproducible builder feedback](docs/BUILDER-FEEDBACK.md).

## Status and limits

- **Environment and assets.** This is a development network; mainnet signing is disabled.
  The live demo pays in XRP. The CLI’s TEST-SGD is an unbacked stand-in for RLUSD.
  Recorded unsigned RLUSD escrow probes returned `tecNO_PERMISSION` on both networks;
  the matched TEST-SGD control succeeded. [Recorded verdicts](docs/evidence/dry-run-nov12/README.md).
- **Market.** No independent writers, customers, pilots or revenue yet. Demand among
  XRPL/x402 integrators using coding agents is not yet validated.
- **Delivery and refunds.** Signed submission can expose the key before validation;
  escrow stays claimable until CancelAfter. A key match proves reveal, not quality.
  Quality refunds need the writer’s signature and cooperation; a real writer could refuse.
  No-show recovery requires a validated EscrowCancel after the deadline.
- **Identity.** Three accepted operator-issued Credentials and an operator-issued
  Permissioned Domain support identity display only, not KYC, quality or payment permission.
- **Operations.** One shared payer, visitor caps, explicitly labelled per-run model
  fallbacks. Cold installs depend on npm and faucet latency; [timings and misses](docs/submission/qa-prep.md).
  Packages are on GitHub Releases; registry publication and Mac signing remain pending.
  A regulated launch also needs custody, screening, KYB and licensing work.

[Docs](docs/README.md) · [Numbers](docs/numbers.md) · [Deck (PDF)](docs/submission/ResearchAgent-SFF-deck.pdf) ·
[Q&A](docs/submission/qa-prep.md) · [Contributing](.github/CONTRIBUTING.md) · [Security](.github/SECURITY.md) · [MIT license](LICENSE)
