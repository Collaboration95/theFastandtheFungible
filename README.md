# ResearchAgent

**A research agent with a wallet.** Agents are the new readers, so experts should get paid when an agent uses their thinking.

ResearchAgent answers from free sources first. When the missing piece sits behind a paywall, it can buy that one article straight from the writer, inside a budget you set, and it checks every promise the writer made after delivery.

<p>
  <a href="https://collaboration95.github.io/theFastandtheFungible/"><strong>Explainers site →</strong></a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/talk/">Walkthrough</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/slides/">Slides</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/project-map/">Project map</a>
</p>

Presented at AI Tinkerers Singapore, 10 Oct 2026.

## See it first

| | |
|---|---|
| [**Inside ResearchAgent**](https://collaboration95.github.io/theFastandtheFungible/talk/) | Replays a real run from its event log: free search, a purchase, a proof that fails, an on-chain refund, then a second buy that answers the question. Start here. |
| [**Slide deck**](https://collaboration95.github.io/theFastandtheFungible/slides/) | The AI Tinkerers talk. Boxes on the architecture slide open the project map. Keys: `→` `←` · `O` overview · `N` notes · `F` fullscreen. |
| [**Project map**](https://collaboration95.github.io/theFastandtheFungible/project-map/) | Three clickable levels, from the reader's agent, the writers and the ledger down to the primitives. Every arrow is numbered and explained. |

The writers and their articles are fictional. Payments settle on the XRPL Testnet, so no real money moves.

## How a run works

1. **Ask.** You set a prompt budget (S$0, S$1, S$2 or S$5) and ask a question. The model asks at most two short clarifying questions, which you can skip.
2. **Confirm the plan.** An action modal shows the plan and counts down for 5 s (Edit, Cancel, Go now). It confirms the plan, not a purchase: the budget is the only spending authorization.
3. **Search the writers.** Each writer runs their own site with hybrid search (BM25 + vectors) over their full text. A hit returns the abstract, signals and a signed manifest, never the premium text.
4. **Decide what's worth buying.** A calibrated decision model judges each candidate, weighted by the writer's trust score. Cloudflare Clef-flash is the default; the demo runs OpenAI Decisions `gpt-6-luna` (`DECISION_PROVIDER=openai`).
5. **Pay.** Deterministic policy code, never the LLM, pays the writer over [x402 v2](docs/x402-xrpl.md) on XRPL Testnet, within the budget and a S$1 per-source cap.
6. **Verify and refund.** The delivered article is checked against the writer's promises. A broken promise is challenged, refunded on-chain, and the writer's trust score drops.
7. **Answer.** DeepSeek writes the answer and a PDF report. Every citation resolves to an exact delivered passage. Langfuse traces live runs.

### Hard guarantees

- No premium bytes reach the browser or a model before a matching grant.
- The budget is the only spending authorization, and only policy code can start a purchase.
- One charge per intent: retrying a failed delivery never charges again, and Stop blocks new purchases.
- Citations are real: they point at delivered passages.
- Anything simulated or substituted is labelled on screen.

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
| `make cloudrun` | (live) Deploy to Google Cloud Run |
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
| `.` | Presenter menu: pace, clarify on/off, UC1–UC3 presets, fail-next-delivery (under `make fault`) |
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

### Google Cloud Run

`make cloudrun` deploys the live demo as one container (nginx + API + publisher, see [`docker/cloudrun/`](docker/cloudrun/)) to `asia-southeast1` (Singapore). Cloud Build builds it remotely, so no local Docker is needed. Run `gcloud auth login` once first; the keys go from `.env` into Cloud Run environment variables.

The service runs one always-on instance (2 vCPU, 2 GiB). Its SQLite ledgers start fresh on every deploy or restart. Reset reputation before a stage run:

```sh
curl -X POST <service URL>/api/reputation/reset
```

## Documentation

- [FINAL-PUSH.md](FINAL-PUSH.md): the product source of truth (direction, decisions D1–D24, open items)
- [prompt.md](prompt.md): the five hard gates and the worker workflow
- [docs/README.md](docs/README.md): documentation index, including architecture, design and the x402/XRPL flow
- [STATUS.md](STATUS.md): progress log and human-only steps

**Not built yet:** durable storage on Cloud Run, mainnet, licensing, and a central index.
