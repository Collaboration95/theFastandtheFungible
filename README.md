# ResearchAgent

Agents are the new readers. Experts should get paid when an agent uses their thinking.

ResearchAgent is a neutral search engine for agent-readable expertise, with a wallet. A reader's agent asks a question, writers search their own articles, a calibrated decision model (Cloudflare Clef) picks which paywalled article is worth buying, code pays the writer directly, and every promise the writer made is checked after delivery. LLMs on DeepSeek write the answer and report; they never choose or trigger a purchase.

**Direction and decisions:** [FINAL-PUSH.md](FINAL-PUSH.md) (6 Oct pivot, decisions D1-D24, open items) is the source of truth for the product. Planned work below is marked as planned.

**Implemented today (v1):** one synthetic corpus (19 fictional Vertex Compute documents) behind one local publisher, an x402-shaped flow settled on XRPL Testnet, DeepSeek for writing, Clef for decisions, policy code for payment, and Langfuse traces for live runs. No real funds are used and everything simulated or substituted is labelled. The v1 flow is not full x402 v2.

**Planned (FINAL-PUSH):** federated per-writer search, signed manifests, x402 v2 with writer-run facilitators, `/challenge` refunds, a public trust matrix, a clarify step and a writer roster. Until it lands, treat anything beyond the v1 list as not built.

```sh
make setup     # npm ci + create .env from .env.example
make run       # offline fixture demo (no keys)
make doctor    # Node, deps, .env drift, ports, provider keys
make keys      # one real DeepSeek + Clef call; shows latency
make live      # DeepSeek + Cloudflare Clef, key preflight first, labelled fixtures on failure
make reset     # stop the demo, wipe data/*.db and generated reports
make check     # lint + typecheck + unit tests (pre-commit and CI run this)
make verify    # check + serial browser tests + build
make           # every target
```

`make` wraps the npm scripts (`npm run demo`, `demo:live`, `demo:reset`, `verify`, `doctor`). Needs Node ≥ 22.13 for `node:sqlite` (`.nvmrc`). To run a second checkout beside a running demo, shift every port: `make run OFFSET=100` serves 5200/8888/8890.

Open http://127.0.0.1:5100. API: 8788. Local publisher: 8790. Set a prompt budget of S$0, S$1, S$2 or S$5. The budget is the only spending authorization: there is no per-purchase approval dialog. S$0 computes a would-buy table and spends nothing. The default S$1 per-source cap stays in policy code.

One screen holds the run: steps on the left, the short answer in the middle, budget, purchases and decisions on the right. A run finishes in far less time than a person can follow, so the screen replays its trace at stage pace (a minimum time per step, labelled while it plays; D13). Press `.` for the presenter menu (pace, the fail-next-delivery switch under `make fault`) and `W` for Show work (raw trace, wire, full policy table, receipts). `?pace=real` skips the replay and shows the run at its true speed; `?run=<id>` reopens a run. Design walkthrough: `docs/ux-walkthrough/index.html`.

Planned (D8, [FINAL-PUSH §6](FINAL-PUSH.md#6-clarify-step-and-action-modal-d8)): after you submit, the model asks at most two short clarifying questions (skippable chips), then shows its plan in an action modal above the input bar. The modal counts down for 5 s with Edit, Cancel and Go now, and the run starts on expiry. It confirms the plan before any spending. It is not a purchase approval; the budget stays the only authorization.

Copy `.env.example` to `.env` and supply DeepSeek and Cloudflare keys for live mode. Keys and delivery tokens remain private; do not commit them. `CLOUDFLARE_ACCOUNT_ID` is resolved once with the account token if missing. `PUBLISHER_URL` can point at the human-deployed Cloud Run service; its shared `PUBLISHER_SECRET` must match the API. The default demo uses a development-only local secret for fictional settlements.

Each run has durable SQLite reservations, intents, receipts and verified grants. No premium bodies or spans enter the browser or models before a matching grant. Retrying a failed delivery never creates a new charge. Stop prevents new purchases. Citations resolve to exact delivered passages; the PDF includes decision tables and simulated receipts. When Chromium fails, the report endpoint returns labelled printable HTML.

Variants: `make variant V=open-sufficient|contradiction|unchanged|injection` runs the Vertex corpus variants offline. `make fault` enables the local fault demo. A fresh run never erases historical receipts. Runtime files are ignored in `data/`. Per D18 the Vertex corpus and its variants are being removed; the offline backup becomes `npm run demo` (fixture providers) on the new writer corpus.

## Docker (venue laptop)

The same demo in three Alpine containers (web · api · publisher), no Node on the host. Images are built locally from one commit with `git archive` (no registry, no `.env` or `node_modules` in the context) and tagged with its short SHA plus `:local`.

```sh
make docker-build              # or: scripts/docker-build.sh <commit>; prints image sizes
make docker-run                # fixture demo on http://127.0.0.1:5100 (no keys)
make docker-live               # DeepSeek + Clef + XRPL Testnet + Langfuse, keys read from .env at runtime
TAG=<sha> make docker-live     # run a specific commit's images
make docker-logs               # follow logs
make docker-down               # stop; V=1 also wipes the ledgers and reports volumes
```

`WEB_PORT=5200` (or `OFFSET=100`) runs it beside a host demo. Only the web port is published, on 127.0.0.1; the api and publisher are reachable only inside the compose network. The local fault toggle is off in Docker, and `PUBLISHER_URL` always points at the publisher container.

[FINAL-PUSH.md](FINAL-PUSH.md) is the product source of truth; [prompt.md](prompt.md) holds the hard gates and the worker workflow. [STATUS.md](STATUS.md) records unattended progress and human-only steps. [docs/README.md](docs/README.md) is the documentation index. Cloud deployment, fallback recording, rehearsals and the release tag remain human work.
