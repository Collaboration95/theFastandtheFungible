<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/lockup-on-dark.svg">
    <img src="design/brand/lockup.svg" alt="ResearchAgent" height="48">
  </picture>
</p>

<h3 align="center">Research with a wallet.</h3>

<p align="center">A search engine for agent-readable expertise: answer from free sources, then buy the missing evidence.<br>Writers search their own articles; a decision model judges value; policy code pays within your budget and verifies delivery.</p>

<p align="center">
  <a href="https://collaboration95.github.io/theFastandtheFungible/">Explainers</a> ·
  <a href="https://collaboration95.github.io/theFastandtheFungible/talk/">Walkthrough</a> ·
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.6.0/ResearchAgent-0.6.0-arm64.dmg">Download for Mac</a> ·
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases">Releases</a>
</p>

<p align="center">
  <a href="https://github.com/Collaboration95/theFastandtheFungible/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Collaboration95/theFastandtheFungible/actions/workflows/ci.yml/badge.svg"></a>
  <a href="#numbers"><img alt="Latest committed nightly scorecard" src="docs/media/scorecard.svg"></a>
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Collaboration95/theFastandtheFungible?sort=semver"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-lightgrey"></a>
  <a href="docs/x402-xrpl.md"><img alt="XRPL Testnet" src="https://img.shields.io/badge/XRPL-Testnet-lightgrey"></a>
</p>

![19-second refund demo: a failed proof returns the payment](docs/media/refund-demo.gif)

Fictional writers and synthetic articles; this clip uses **simulated payments**.
[Original MP4](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.6.0/uc3-2026-11-03.mp4) · [Regenerate the GIF](scripts/readme-media.mjs).

## Quick start

Node ≥ 22.13 and Make. Three commands, no keys needed:

```sh
git clone https://github.com/Collaboration95/theFastandtheFungible && cd theFastandtheFungible
make setup
make run
```

Open <http://127.0.0.1:5100>. Fixture providers and simulated payments work offline.
For live providers, add the keys described in `.env.example` to your ignored `.env`, then:

```sh
make doctor
make live
```

Live model calls can incur provider fees. Settlement uses XRPL Testnet when a payer seed is configured;
otherwise it is labelled simulated. Testnet funds have no real value. [All make targets, Docker and operation](docs/running.md).

## Try it in Claude Code

HTTP option: open Mac **Desktop Settings → Connect an agent → Claude Code**, create an allowance and copy its command (app stays open; per-agent bearer on loopback Streamable HTTP).

From the installed checkout, authorize S$2 per question and S$5 per UTC day in fixture mode:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

Start a fresh session:

> Search the writers, then ask_expert: What's the analyst outlook on Kestrel Semiconductor's deal with TSMC (pricing & margins)? Request budget_sgd=2 and idempotency_key="first-question".
> Show the answer, citations, purchases and mode labels; use get_run if it is still running.

For Codex, put this in `~/.codex/config.toml` (replace `/absolute/checkout`):

```toml
[mcp_servers.researchagent]
command = "node"
args = ["--import", "/absolute/checkout/node_modules/tsx/dist/loader.mjs", "/absolute/checkout/mcp/server.ts"]
tool_timeout_sec = 60
[mcp_servers.researchagent.env]
MCP_MAX_BUDGET_MINOR = "200"
MCP_DAILY_CAP_MINOR = "500"
```

The four tools are `search_expertise`, `ask_expert`, `get_run` and `wallet_status`.
Configured caps default to zero; the calling model cannot raise them. [MCP reference](docs/mcp.md) · [TypeScript SDK](docs/sdk.md) · [Python example](examples/python/ask.py).

Native XRP interop with the XRPL AI Starter Kit’s t54 client and server: [compatibility and pinned versions](docs/x402-xrpl.md#starter-kit-compatibility) · [Testnet evidence](docs/evidence/starter-kit-interop.md).

## Mac app

[Download the Apple Silicon DMG](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.6.0/ResearchAgent-0.6.0-arm64.dmg),
drag ResearchAgent to Applications, then open it. Until Developer ID signing lands, use
Finder → right-click → Open, or Privacy & Security → Open Anyway for this unsigned build.
The default offline demo labels simulated payments. Desktop settings store provider credentials and wallet seeds in macOS Keychain.
[Desktop guide](desktop/README.md) · [Build and signing](desktop/SIGNING.md).

## How it works

![Seven steps from question to cited answer, with policy owning payment](docs/media/architecture.svg)

1. **Ask.** Set the budget and question; answer or skip up to two clarifying questions.
2. **Confirm the plan.** A 5 s action modal offers Edit, Cancel and Go now. The budget authorizes spending.
3. **Search.** Each writer searches their own full text and returns public metadata and a signed manifest.
4. **Decide.** OpenAI Decisions or Cloudflare Clef-flash judges value, weighted by writer trust.
5. **Pay.** Deterministic policy code buys over x402 v2 on XRPL Testnet, within the prompt and source caps.
6. **Verify.** Check the delivered article against the signed promises; challenge broken ones and reduce trust.
7. **Answer.** DeepSeek writes from delivered evidence, with citations and an exportable report.

[Architecture and trust boundaries](docs/contracts/ARCHITECTURE.md) · [x402, verification and refunds](docs/x402-xrpl.md).

## Hard guarantees

Every gate has regression tests and a corresponding [read-only audit rule](scripts/gate-audit.ts):

| Guarantee | Enforcement test | Audit rule |
|---|---|---|
| No premium bytes before a grant | [Purchase boundary](tests/purchase.test.ts), [raw leak audit](tests/gate-audit.test.ts) | `premium_leak` |
| Only policy code spends, within the prompt budget | [Budget and stop cases](tests/purchase.test.ts) | `purchase_without_policy`, `over_budget` |
| One charge per intent | [Parallel pays and restart cases](tests/purchase.test.ts) | `duplicate_settlement` |
| Real citations to delivered passages | [Grant and proof cases](tests/purchase.test.ts) | `citation_without_verified_grant` |
| Simulated or substituted work is labelled | [Rail label regression](tests/gate-audit.test.ts) | `missing_rail_label` |

<a id="proof"></a>

## Numbers

Generated from the [committed scorecard](eval/scorecard/latest.json) by
[`readme-scorecard.mjs`](scripts/readme-scorecard.mjs). LIVE refers to decisions and the separate coverage evaluation;
research and flow fact scoring are fixtures, the corpus is synthetic and payments are simulated.
These local measurements are conditional evidence, not a production benchmark.

<!-- scorecard:start -->
| Metric | Latest | Mode · date |
|---|---|---|
| **Pitch: gross spend buying a fact used in final answer** | 93.15% [95% CI 81.25–100.00%] | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Hard-gate audit violations | 0 across 10 runs, 568 observations | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Supported-fact uplift from paying | +66.7 pts [95% CI 45.8–83.3 pts] | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Purchase-selection F1 (flow / sweep) | 0.94 [95% CI 0.80–1.00] / 0.94 [95% CI 0.80–1.00] | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Wasted gross spend | 6.85% [95% CI 0.00–18.75%] | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Wasted net spend (after confirmed refunds) | 6.85% [95% CI 0.00–18.75%] | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| p50 / p95 time to first answer | 61 ms / 100 ms | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Cold start (demo API + publisher) | 715 ms | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |
| Model cost per query | US$0.0026 | LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments · fresh (48 questions / 24 new documents) · 2026-11-03 |

Pitch definition: gross cost of verified purchases adding a requested, bank-supported fact retained in the final cited answer, divided by all gross purchase cost. 95% CIs resample source clusters; fixed synthetic corpus and observed model draws. Fresh questions and new documents, frozen before one run per policy; no tuning. Same-vendor synthetic labels, human review pending; source templates are correlated. Two separate [live Testnet sanity runs](docs/evidence/numbers-v7-testnet.md) verify the settlement path, not this percentage.
<!-- scorecard:end -->

[Separate MCP Testnet proof](eval/mcp/testnet-2026-11-03.md) records real Testnet settlement,
citations matched to delivered passages and an idempotent retry. It does not validate the scorecard's quality estimate.

## Shipped in 10 days

The build is in progress. These six releases are shipped; the remaining features below are **on main**, pending release.

| Release | Shipped |
|---|---|
| [v0.1.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.1.0) | MCP server and nightly scorecard |
| [v0.2.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.2.0) | App redesign |
| [v0.3.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.3.0) | Public fact menu |
| [v0.4.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.4.0) | Mac app, DMG and Keychain |
| [v0.5.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.5.0) | Clear spend, payments and refund UI |
| [v0.6.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.6.0) | Clearer answers and reports |

On main: [escrow](https://github.com/Collaboration95/theFastandtheFungible/pull/308),
[hire the agent](https://github.com/Collaboration95/theFastandtheFungible/pull/306),
[test USD](https://github.com/Collaboration95/theFastandtheFungible/pull/315),
[audit and compliance](https://github.com/Collaboration95/theFastandtheFungible/pull/309),
[one wallet, many agents](https://github.com/Collaboration95/theFastandtheFungible/pull/319),
[verify answers and recover runs](https://github.com/Collaboration95/theFastandtheFungible/pull/322).

## Publish your expertise

Turn a Markdown folder into a searchable writer with signed manifests and x402 delivery:

```sh
cp -R examples/writer-starter my-notes
npm run publish:site -- ./my-notes --rail simulated
```

For Testnet funding, schema, privacy and the recorded proof, see the [publishing guide](docs/publishing.md).
New writers are unverified; this is not KYB or a sanctions service. [Compliance posture](docs/COMPLIANCE.md).

## More

[Documentation](docs/README.md) · [Project map](https://collaboration95.github.io/theFastandtheFungible/project-map/) ·
[Slides](https://collaboration95.github.io/theFastandtheFungible/slides/) · [Build log](https://collaboration95.github.io/theFastandtheFungible/evolution/) ·
[Builder feedback](docs/BUILDER-FEEDBACK.md) · [Design record](docs/FINAL-PUSH.md) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT license](LICENSE).

Mainnet, durable hosted storage and licensing remain future work. The October Cloud Run demo was removed after the talk.
`theFastandtheFungible` is the team and repository name; the product is **ResearchAgent**.

[SDK v1 API and examples](docs/sdk.md).
