# ResearchAgent

Perplexity with a wallet: LLMs write, a decision model chooses, and policy code pays within the per-prompt budget. The October 10 demo uses a fictional corpus and simulated SGD; no real funds are used. The publisher protocol is x402-shaped, without claiming compatibility.

```sh
make setup     # npm ci + create .env from .env.example
make run       # offline fixture demo (no keys)
make doctor    # Node, deps, .env drift, ports, provider keys
make keys      # one real Groq + Clef call; shows live rate limits
make live      # Groq + Cloudflare Clef, key preflight first, labelled fixtures on failure
make reset     # stop the demo, wipe data/*.db and generated reports
make check     # lint + typecheck + unit tests (pre-commit and CI run this)
make verify    # check + serial browser tests + build
make           # every target
```

`make` wraps the npm scripts (`npm run demo`, `demo:live`, `demo:reset`, `verify`, `doctor`). Needs Node ≥ 22.13 for `node:sqlite` (`.nvmrc`). To run a second checkout beside a running demo, shift every port: `make run OFFSET=100` serves 5200/8888/8890.

Open http://127.0.0.1:5100. API: 8788. Local publisher: 8790. Set a prompt budget of S$0, S$1, S$2 or S$5. There is no per-purchase approval dialog. S$0 computes a would-buy table and spends nothing. The default S$1 per-source cap stays in policy code. [docs/before-after.svg](docs/before-after.svg) maps the architecture against the September prototype.

Copy `.env.example` to `.env` and supply Groq and Cloudflare keys for live mode. Keys and delivery tokens remain private; do not commit them. `CLOUDFLARE_ACCOUNT_ID` is resolved once with the account token if missing. `PUBLISHER_URL` can point at the human-deployed Cloud Run service; its shared `PUBLISHER_SECRET` must match the API. The default demo uses a development-only local secret for fictional settlements.

Each run has durable SQLite reservations, intents, receipts and verified grants. No premium bodies or spans enter the browser or models before a matching grant. Retrying a failed delivery never creates a new charge. Stop prevents new purchases. Citations resolve to exact delivered passages; the PDF includes decision tables and simulated receipts. When Chromium fails, the report endpoint returns labelled printable HTML.

Variants: `make variant V=open-sufficient|contradiction|unchanged|injection`. `make fault` enables the local fault demo. A fresh run never erases historical receipts. Runtime files are ignored in `data/`.

[prompt.md](prompt.md) is the sprint source of truth. [STATUS.md](STATUS.md) records unattended progress and human-only steps. Cloud deployment, fallback recording, rehearsals and the release tag remain human work.
