<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/lockup-on-dark.svg">
    <img src="design/brand/lockup.svg" alt="ResearchAgent" height="48">
  </picture>
</p>

<h3 align="center">Research with a wallet.</h3>

<p align="center">
  An agent that answers from free sources first, then buys the one missing article straight from the writer,<br>
  inside a budget you set. It checks every promise the writer made, and the money comes back if one is broken.
</p>

<p align="center">
  <a href="https://github.com/Collaboration95/theFastandtheFungible/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Collaboration95/theFastandtheFungible/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases"><img alt="Release" src="https://img.shields.io/github/v/release/Collaboration95/theFastandtheFungible?display_name=tag&sort=semver"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-informational"></a>
  <a href="eval/mcp/testnet-2026-11-03.md"><img alt="Payments settle on XRPL Testnet" src="https://img.shields.io/badge/XRPL-Testnet%20only-informational"></a>
</p>

<p align="center">
  <a href="https://collaboration95.github.io/theFastandtheFungible/"><b>Explainers</b></a> ·
  <a href="https://collaboration95.github.io/theFastandtheFungible/talk/">Walkthrough</a> ·
  <a href="https://collaboration95.github.io/theFastandtheFungible/project-map/">Project map</a> ·
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases">Releases</a> ·
  <a href="docs/BUILDER-FEEDBACK.md">Builder feedback</a>
</p>

<!-- TODO(pass 2; #270 and `make clip` are merged): hero GIF of the local app, a 15–20 s refund scene under 4 MB from `make clip`, committed under docs/media/ -->

[Watch the 20-second refund demo](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.6.0/uc3-2026-11-03.mp4) · fictional writers, simulated payments.

## Mac app

Download the Apple Silicon DMG from [Releases](https://github.com/Collaboration95/theFastandtheFungible/releases),
drag ResearchAgent to Applications, and open it. The unsigned build may need
Finder → right-click → Open (or Privacy & Security → Open Anyway). The default
judge mode works offline without keys and visibly labels payments SIMULATED.
Use ⌘K for commands and ⌘, for desktop settings, Testnet wallet creation and
Keychain provider credentials. Remote HTTPS backends use an API token stored in Keychain.
Seeds are encrypted in the macOS Keychain at rest and present in engine memory
while signing. [Desktop guide](desktop/README.md) · [Build/signing](desktop/SIGNING.md).
From source: `OFFSET=900 make app` or `OFFSET=900 make dmg`.


> The writers and their articles are **fictional**, and payments settle on the **XRPL Testnet**: no real money moves.

## Try it in Claude Code

Add the MCP server (S$2 per question and S$5 per UTC day, simulated fixture mode, no keys):

```sh
git clone https://github.com/Collaboration95/theFastandtheFungible && cd theFastandtheFungible && npm ci
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

Start a fresh session and ask:

> Search the writers, then ask_expert: What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)? Request budget_sgd=2. Show citations, purchases and all mode labels.

Four tools: `search_expertise`, `ask_expert`, `get_run`, `wallet_status`. You set the caps; the calling model cannot raise them, and both default to `0` (free research, would-buy only). Codex, config files and the details: [docs/MCP](docs/mcp.md).

<!-- TODO(pass 2, after #259): "Download for Mac" link to the latest release, and the right-click → Open note until the Developer ID lands (#265) -->
## Use from code

The [TypeScript SDK](docs/sdk.md) shares the MCP client's capped, idempotent ask flow:

```ts
const run = await createClient({ baseUrl }).ask('What changed in the deal?', { budgetSgd: 1 })
```

It also has metadata search, run snapshots, trace streaming and wallet status. It has no purchase method: only backend policy can buy. Examples: [`examples/sdk-quickstart.ts`](examples/sdk-quickstart.ts) and the stdlib-only [`examples/python/ask.py`](examples/python/ask.py).

## Run it locally

Needs Node ≥ 22.13 (see `.nvmrc`).

```sh
make setup   # npm ci, and create .env from .env.example
make run     # offline demo with fixture providers, no keys needed
```

Open <http://127.0.0.1:5100>. For live mode, put DeepSeek and Cloudflare keys (plus an OpenAI key for OpenAI Decisions) in `.env`, then `make doctor`, `make keys` and `make live`. Keys and wallet seeds stay in `.env`, which is never committed. Every make target, the demo keys and Docker: [docs/running.md](docs/running.md).

## How a run works

1. **Ask.** Set a prompt budget (S$0 to S$5) and a question. Up to two short clarifying questions, skippable.
2. **Confirm the plan.** A 5 s action modal shows the plan (Edit, Cancel, Go now). It confirms the plan, not a purchase.
3. **Search the writers.** Each writer's own site runs hybrid search over their full text. A hit returns an abstract, signals and a signed manifest, never the premium text.
4. **Decide.** A decision model (OpenAI Decisions `gpt-6-luna`, or Cloudflare Clef-flash) judges what is worth buying, weighted by the writer's trust score.
5. **Pay.** Deterministic policy code, never the LLM, pays over [x402 v2](docs/x402-xrpl.md) on XRPL Testnet, within the budget and a S$1 per-source cap.
6. **Verify and refund.** The delivered article is checked against the writer's promises. A broken one is challenged and refunded on-chain, and the writer's trust score drops.
7. **Answer.** DeepSeek writes the answer and a PDF report. Every citation resolves to a delivered passage.

### Hard guarantees

Five gates hold on every run, enforced by tests (`tests/purchase.test.ts`, `gate-N` cases) and a read-only audit ([`scripts/gate-audit.ts`](scripts/gate-audit.ts), six rules):

- no premium bytes before a grant;
- the budget is the only spending authorization, and only policy code can start a purchase;
- one charge per intent, even across retries and restarts;
- citations point at delivered passages;
- anything simulated or substituted is labelled.

Architecture: [contracts/ARCHITECTURE.md](docs/contracts/ARCHITECTURE.md) · [security](docs/contracts/SECURITY.md) · [interactive project map](https://collaboration95.github.io/theFastandtheFungible/project-map/) · [Nov 2026 architecture review](docs/contracts/REVIEW-NOV-2026.md) · [compliance posture](docs/COMPLIANCE.md) (audit trail, export, what is and isn't claimed)

## Proof

**A real Testnet purchase, from an MCP client.** On 3 Nov 2026 a stdio MCP client asked UC2's question with a S$2 cap and an idempotency key. One purchase was verified and settled for 0.09 Testnet XRP in 22.8 s, all 8 returned citations matched delivered passages, and a retry with the same key returned the same run with no second charge.
[Transaction `D65FDA44…2FC9F9`](https://testnet.xrpl.org/transactions/D65FDA447AAC788BA7451615FCB6BDD62960AB066DC5A0BB150980B9E32FC9F9) (validated `tesSUCCESS`, ledger 22015773) · [full write-up](eval/mcp/testnet-2026-11-03.md). Testnet XRP has no value, and the writer and corpus are fictional.

**Scorecard.** From `make scorecard` (`eval/scorecard/latest.json`), run locally on the owner's Mac. LIVE means real decision and coverage model calls on the synthetic corpus; the planner/writer are fixtures, search is keyword-only, and payments are simulated (zero XRP transferred). Flow quality uses the bank's scripted fact check. Before/after results and fixture scores are in the [tracker](docs/SFF-PUSH.md#hill-climb-scorecard).

<!-- scorecard:start -->
| Metric | Latest | Mode · date |
|---|---|---|
| **Pitch: gross spend buying a fact used in final answer** | 80.0% [95% CI 63.2–92.0%] | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Hard-gate audit violations | 0 across 10 runs, 646 observations | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Supported-fact uplift from paying | +38.0 pts [95% CI 24.0–51.1 pts] | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Purchase-selection F1 (flow / sweep) | 0.55 [95% CI 0.36–0.69] / 0.69 [95% CI 0.51–0.81] | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Wasted gross spend | 20.0% [95% CI 8.0–36.8%] | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Wasted net spend (after confirmed refunds) | 20.0% [95% CI 8.0–36.8%] | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| p50 / p95 time to first answer | 111 ms / 261 ms | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Cold start (demo API + publisher) | 1448 ms | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |
| Model cost per query | US$0.0036008399999999997 | LIVE decision + coverage; fixture research; simulated payments · held-out (92 questions) · 2026-11-03 |

Pitch definition: gross cost of verified purchases adding a requested, bank-supported fact retained in the final cited answer, divided by all gross purchase cost. 95% CIs resample source clusters; fixed synthetic corpus and observed model draws. Reused question holdout; historical failures were inspected. Two separate [live Testnet sanity runs](docs/evidence/numbers-v7-testnet.md) verify the settlement path, not this percentage.
<!-- scorecard:end -->

**Builder feedback.** [15 implementation findings, a mainnet-readiness checklist and 15 earlier submissions](docs/BUILDER-FEEDBACK.md) on XRPL, x402 and the Starter Kit, each with evidence, our workaround and the suggested upstream fix. Mainnet is not enabled.

## Explainers

| | |
|---|---|
| [**Inside ResearchAgent**](https://collaboration95.github.io/theFastandtheFungible/talk/) | Replays a real run from its event log: a purchase, a proof that fails, an on-chain refund, then a second buy that answers the question. Start here. |
| [**Project map**](https://collaboration95.github.io/theFastandtheFungible/project-map/) | Three clickable levels from the agent, writers and ledger down to the primitives. |
| [**Slides**](https://collaboration95.github.io/theFastandtheFungible/slides/) | The AI Tinkerers Singapore talk, 10 Oct 2026. |
| [**How it evolved**](https://collaboration95.github.io/theFastandtheFungible/evolution/) | The build log in charts, replayed from git, GitHub and the agents' own logs. |

The explainers site shares one header across its pages (source in [`site/`](site/SOURCE.md), generated by `scripts/site-header.mjs`).

## More

[Documentation index](docs/README.md) · [SFF finals tracker and changelog](docs/SFF-PUSH.md) · [Judging criteria](docs/JUDGING-CRITERIA.md) · [Design record D1–D24](docs/FINAL-PUSH.md) · [Decision model report](eval/REPORT-decisions.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

**Not built yet:** durable hosted storage, mainnet, licensing and a central index. The 10 Oct live demo ran on Google Cloud Run; that deploy was removed after the talk (last commit with it: `ce77f59`).

## Publish your own expertise

From a clone with Node 22.13+ and `npm ci`, turn a Markdown folder into a local
writer that UI and MCP agents can search and pay:

```sh
cp -R examples/writer-starter my-notes
npm run publish:site -- ./my-notes
# Beside another stack: OFFSET=800 npm run publish:site -- ./my-notes
```

The command serves the site, signed manifests and an x402 facilitator on loopback,
creates and faucet-funds an **XRPL Testnet** wallet, and prints the time to ready.
Keep it running and use the printed `PUBLISHER_URL` with the UI/MCP engine.
It also registers the writer in the ignored `data/local-writers/` directory;
the next normal publisher start includes it alongside the built-in writers.
Stop that site before starting the normal stack on the same port. Ctrl-C stops
the host; rerun the same command after edits. Use `--slug my-name`, `--name "My Name"`,
`--port 9590`, or `--rail simulated` for an explicitly labelled offline run.
`node scripts/publish-site.mjs ./my-notes` is the equivalent repo-local bin entry.

Each top-level `.md` file needs scalar front matter (plain or quoted values):

```markdown
---
title: Solar electricity share
tier: PAID
price: 0.10
abstract: A separately written public summary of the research scope.
tags: solar, electricity, Malaysia
questions: Contracted share? | Hourly matching?
synthetic: false
---

## Contract scope

Your article goes here, split into paragraphs…
```

`price` is SGD with up to two decimal places, converted at the existing labelled
demo rate (S$0.10 = 0.01 Testnet XRP). FREE articles use `price: 0.00`.
The existing corpus rules apply: 600–1,400 words and at least four paragraphs.
Filenames and writer slugs use lowercase letters, numbers and hyphens. Public
abstracts, titles and topic labels must not reproduce eight consecutive premium
words. Short headings and optional `questions` supply public topics; keep answers
in the body. The v2 fact menu uses headings and front matter as vocabulary, with the existing
entity/measure catalogue as a fallback. Optional `entity` and `measure` noun
phrases override that vocabulary; a menu is bound only to passages that actually
mention both phrases. Digits and answer values are rejected by the menu schema.
Metadata generation is deterministic, with no LLM calls.
Search uses the existing hybrid index when `SEARCH_EMBEDDINGS=live` is explicitly
set with Workers AI credentials; otherwise it says keyword search. Enabling live
embeddings sends the existing index text to Workers AI and uses that provider.

Keys are never printed. A wallet is created once in a mode-0600 `.env.writer`
inside the private writer directory, or attached from the existing
`XRPL_PUBLISHER_<SLUG>_SEED` environment variable. A failed faucet call keeps the
key for retry. Back up this ignored directory privately. Mainnet is disabled.
Every new writer is shown as **unverified writer**; an operator denylist at
`data/payee-denylist.json` (an array of `{ "address": "r…", "reason": "…" }`)
is checked before wallet funding and before payment signing. This is not KYB
or a sanctions provider ([compliance posture](docs/COMPLIANCE.md)).

To reproduce the end-to-end demo with real retrieval, fixture decisions and
proof verification:

```sh
node --import tsx scripts/publish-demo.ts           # SIMULATED, no network payment
node --import tsx scripts/publish-demo.ts --testnet # one 0.01 Testnet XRP read
```

The Testnet demo uses `XRPL_PAYER_SEED` from the ignored `.env`, binds port 9590,
and stores private state under `scratch/published-demo/`. It refuses to start a
second Testnet demo against an existing buyer journal; reconcile that journal
instead of paying again. [Recorded Testnet proof](docs/evidence/publish-site-277.md).
The three starter articles are adaptations of the repository's original
synthetic corpus (energy, grid planning and wafer contracts), not real reporting.

---

`theFastandtheFungible` is the team and repository name; the product is **ResearchAgent**. The repository name stays stable for published Pages URLs.
