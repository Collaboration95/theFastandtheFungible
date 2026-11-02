# ResearchAgent

**Research with a wallet.** Agents are the new readers, so experts should get paid when an agent uses their thinking.

ResearchAgent answers from free sources first. When the missing piece sits behind a paywall, it can buy that one article straight from the writer, inside a budget you set, and it checks every promise the writer made after delivery.

<p>
  <a href="https://collaboration95.github.io/theFastandtheFungible/"><strong>Explainers site →</strong></a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/talk/">Walkthrough</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/slides/">Slides</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/project-map/">Project map</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/evolution/">How it evolved</a>
</p>

Presented at AI Tinkerers Singapore, 10 Oct 2026. The live demo ran on Google Cloud Run and placed in the sponsor's top three Cloud Run demos.

## See it first

| | |
|---|---|
| [**Inside ResearchAgent**](https://collaboration95.github.io/theFastandtheFungible/talk/) | Replays a real run from its event log: free search, a purchase, a proof that fails, an on-chain refund, then a second buy that answers the question. Start here. |
| [**Slide deck**](https://collaboration95.github.io/theFastandtheFungible/slides/) | The AI Tinkerers talk. Boxes on the architecture slide open the project map. Keys: `→` `←` · `O` overview · `N` notes · `F` fullscreen. |
| [**Project map**](https://collaboration95.github.io/theFastandtheFungible/project-map/) | Three clickable levels, from the reader's agent, the writers and the ledger down to the primitives. Every arrow is numbered and explained. |
| [**How it evolved**](https://collaboration95.github.io/theFastandtheFungible/evolution/) | The build log in charts: 39 days of commits, pull requests, coding-agent prompts and tokens, replayed from git, GitHub and the agents' own logs. |

The writers and their articles are fictional. Payments settle on the XRPL Testnet, so no real money moves.

## How a run works

1. **Ask.** You set a prompt budget from S$0 to S$5 in 5-cent steps (quick picks: S$0, S$1, S$2, S$3 and S$5) and ask a question. The model asks at most two short clarifying questions, which you can skip.
2. **Confirm the plan.** An action modal shows the plan and counts down for 5 s (Edit, Cancel, Go now). It confirms the plan, not a purchase: the budget is the only spending authorization.
3. **Search the writers.** Each writer runs their own site with hybrid search (BM25 + vectors) over their full text. A hit returns the abstract, signals and a signed manifest, never the premium text.
4. **Decide what's worth buying.** A selectable decision model judges each candidate, weighted by the writer's trust score: OpenAI Decisions `gpt-6-luna` (`DECISION_PROVIDER=openai`) or Cloudflare Clef-flash (`DECISION_PROVIDER=cloudflare`, the `make live` default). Scores are raw by default; calibration requires `DECISION_CALIBRATION=on` and a matching provider/model/prompt calibrator.
5. **Pay.** Deterministic policy code, never the LLM, pays the writer over [x402 v2](docs/x402-xrpl.md) on XRPL Testnet, within the budget and a S$1 per-source cap.
6. **Verify and refund.** The delivered article is checked against the writer's promises. A broken promise is challenged, refunded on-chain, and the writer's trust score drops.
7. **Answer.** DeepSeek writes the answer and a PDF report. Every citation resolves to an exact delivered passage. Langfuse traces live runs.

### Hard guarantees

- No premium bytes reach the browser or a model before a matching grant.
- The budget is the only spending authorization, and only policy code can start a purchase.
- One charge per intent: retrying a failed delivery never charges again, and Stop blocks new purchases.
- Citations are real: they point at delivered passages.
- Anything simulated or substituted is labelled on screen.

## Use it from Claude Code / Codex

After `npm ci` in this checkout, add the local stdio server with one command.
These examples authorize **S$2 per question and S$5 per UTC day** in simulated
fixture mode. Set both caps to `0` for free research / would-buy only (the default).
The operator sets caps in configuration; a calling model's `budget_sgd` is only a
request and cannot raise them. No per-purchase approval is needed.

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

Or for Codex:

```sh
codex mcp add researchagent --env MCP_MAX_BUDGET_MINOR=200 --env MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

The equivalent Codex `~/.codex/config.toml` entry (replace `/absolute/checkout`):

```toml
[mcp_servers.researchagent]
command = "node"
args = ["--import", "/absolute/checkout/node_modules/tsx/dist/loader.mjs", "/absolute/checkout/mcp/server.ts"]
tool_timeout_sec = 60

[mcp_servers.researchagent.env]
MCP_MAX_BUDGET_MINOR = "200"
MCP_DAILY_CAP_MINOR = "500"
```

Configuration fields follow the [official OpenAI MCP documentation](https://developers.openai.com/codex/mcp).
Start a fresh client session, then ask:

> Search the writers, then ask_expert: What's the analyst outlook on Kestrel
> Semiconductor's latest deal with TSMC (pricing & margins)? Request budget_sgd=2,
> idempotency_key="my-uc2". Show citations, purchases and all mode labels.

The question includes UC2's recorded clarification inline: MCP deliberately never
pauses for clarification. `search_expertise({query,k?})` returns only public
metadata. `ask_expert({question,budget_sgd,idempotency_key?})` returns an answer,
exact delivered citation passages with URLs, verified/refunded purchase statuses,
and actual Testnet transaction/explorer links when present (null for simulation).
`get_run({run_id})` reads an existing MCP run; `wallet_status()` shows public payer
address, rail, gross spend, reservations and caps, never credentials.

Run `make mcp` directly, or `make mcp-live` for live providers. Fixture mode forces
fixture research/decisions, keyword search and simulated settlement, even if the
shell has live settings. Every result labels its mode; the writer corpus is
fictional. Local boot uses two ephemeral loopback ports with isolated ledgers in
`data/mcp/`; set `RA_DATA_DIR` to persist them elsewhere. Keep that directory to
preserve idempotency and daily accounting. Separate data directories are separate
allowances; this is an operator boundary, not a wallet-wide cap.

Set `RA_BACKEND_URL` to an existing ResearchAgent API for HTTP-backed tools. That
API **must include the MCP routes from #255** and have its own human caps set at
startup. Client-side cap variables do not override a remote API's caps. The API
is a trusted operator service; protect network access when hosting it remotely.
These caps cover MCP runs, not web UI runs. No cloud resource is created by MCP.

Both caps default to zero. Budgets round down to the existing 5-cent step and
S$5 engine maximum. Each active run reserves its remaining possible charge;
uncertain settlements retain the reservation across shutdown/restart and UTC
midnight. Gross charges are attributed to their receipt's UTC settlement day;
refunds do not replenish authority. A key maps atomically to one run in the
engine's `app.db`; reuse with a different question is rejected. Reuse with a new
requested budget returns the original run. Without a key, each call is a new
intent. `ask_expert` waits up to 45 seconds, then returns the running id for
`get_run`; a timeout does not cancel a purchase or authorize a retry with a new key.

`RA_LIVE=1` enables live providers and, only with `XRPL_PAYER_SEED`, XRPL Testnet.
Provider credentials stay in the engine environment; tools cannot supply keys,
rail, provider, plan, article selection or higher caps. Live provider usage can
incur model fees separately from the article cap. `node scripts/mcp-demo.mjs`
uses a real authenticated Claude Code session with fixture engine providers,
only the four MCP tools, and simulated settlement; it saves a sanitized tool
transcript summary under `eval/mcp/` (or prints manual steps if Claude is absent).
A separate [Testnet MCP purchase proof](eval/mcp/testnet-2026-11-03.md) records validated settlement and retry evidence.
Run `npx vitest run tests/engine.test.ts tests/mcp-policy.test.ts tests/mcp.e2e.test.ts`
for offline transport, isolation, cap and restart checks.

## Quick start

Needs Node ≥ 22.13 (for `node:sqlite`; see `.nvmrc`).

```sh
make setup   # npm ci, and create .env from .env.example
make run     # offline demo with fixture providers, no keys needed
```

Open <http://127.0.0.1:5100>. The API listens on 8788 and the local publisher on 8790.

For live mode, fill `.env` with DeepSeek and Cloudflare keys (plus an OpenAI key for OpenAI Decisions), then:

```sh
make doctor  # checks Node, deps, .env drift, ports and provider keys
make keys    # one real call per provider, with latency
make live    # live providers, key preflight first; labelled fixtures if a provider fails
```

Keys and wallet seeds stay in `.env`, which is never committed. `make wallets CREATE=1` creates and funds the writers' Testnet wallets.

<details>
<summary><strong>All make targets</strong></summary>

| Target | What it does |
|---|---|
| `make setup` | `npm ci` and create `.env` from `.env.example` |
| `make run` | Offline fixture demo (no keys) |
| `make live` | Live demo: DeepSeek, decision model, XRPL Testnet, Langfuse |
| `make doctor` | Node, deps, `.env` drift, ports, provider keys |
| `make keys` | One real DeepSeek, Clef and OpenAI Decisions call; shows latency |
| `make preflight` | Stage check before the slot: a live decision round, quota, leftover trust and runs, XRPL |
| `make fault` | Fixture demo with the "fail next delivery" switch |
| `make corpus` / `make embeddings` | (live) Generate and embed the writer corpus |
| `make smoke` | (live, spends calls) UC1–UC3 end to end on port offset 300; `ARGS="--only UC2"` or `"--probe"` |
| `make reset` | Stop the demo; wipe `data/*.db` and generated reports |
| `make check` | Lint, typecheck and unit tests (pre-commit and CI) |
| `make verify` | `check`, serial browser tests and a build |
| `make` | List every target |

To run a second checkout beside a running demo, shift every port: `make run OFFSET=100` serves 5200/8888/8890.

</details>

## Using the demo

One screen holds the run: steps on the left, the answer in the middle, and budget, purchases and decisions on the right. A run finishes faster than anyone can follow, so the screen replays its trace at stage pace and labels the replay.

| Key or URL | Effect |
|---|---|
| `.` | Presenter menu: pace, skip replay, skip clarifying questions, reset writer reputation, fail-next-delivery (under `make fault`) |
| `W` | Show work: raw trace, wire, full policy table, receipts |
| `?pace=real` | Skip the replay and show the true speed |
| `?run=<id>` | Reopen a past run |

With a S$0 budget, the agent builds a would-buy table and spends nothing. When Chromium is unavailable, the report endpoint returns labelled printable HTML instead of a PDF.

The corpus has 8 fictional writers and 83 synthetic articles (20 free, 63 paid), served by one local publisher host. `tests/scenarios` runs the three demo use cases end to end.

## Deploy

### Docker (venue laptop)

Three Alpine containers (web · api · publisher), no Node needed on the host. Images are built from one commit with `git archive`, so `.env` and `node_modules` never enter the build context.

```sh
make docker-build            # or scripts/docker-build.sh <commit>
make docker-run              # fixture demo on http://127.0.0.1:5100
make docker-live             # live providers, keys read from .env at runtime
TAG=<sha> make docker-live   # a specific commit's images
make docker-logs
make docker-down             # V=1 also wipes the ledger and report volumes
```

Only the web port is published, on 127.0.0.1. `WEB_PORT=5200` (or `OFFSET=100`) runs it beside a host demo.

The 10 Oct live demo ran on Google Cloud Run. That deploy (`make cloudrun`, `docker/cloudrun/`) was removed after the talk and the Google Cloud project was shut down. The last commit that has it is `ce77f59`.

## Documentation

- [Builder feedback](docs/BUILDER-FEEDBACK.md): implementation friction, repros and mainnet-readiness gaps

- [docs/README.md](docs/README.md): documentation index
- [Architecture](docs/contracts/ARCHITECTURE.md), [security](docs/contracts/SECURITY.md) and the [x402/XRPL flow](docs/x402-xrpl.md)
- [Design record](docs/FINAL-PUSH.md): the decisions D1–D24 behind the October build
- [Decision model report](eval/REPORT-decisions.md): how the buying decisions were measured on the real corpus

**Not built yet:** durable hosted storage, mainnet, licensing, and a central index.

---

`theFastandtheFungible` is the team / repository name; the product is **ResearchAgent**. The repository name stays stable for published Pages URLs.
