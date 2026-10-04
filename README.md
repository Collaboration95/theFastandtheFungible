# ResearchAgent

Perplexity with a wallet: LLMs write, a decision model chooses, and policy code pays within the per-prompt budget. The October 10 demo uses a fictional corpus and simulated SGD; no real funds are used. The publisher protocol is x402-shaped, without claiming compatibility.

```sh
npm ci
npm run demo          # offline fixture providers
npm run demo:live     # Groq + Cloudflare Clef, visibly labelled fixtures on failure
npm run demo:reset    # only data/*.db files and generated reports; stop demo first
npm run verify       # lint, typecheck, unit/process scenarios, serial browser tests, build
```

Open http://127.0.0.1:5100. API: 8788. Local publisher: 8790. Set a prompt budget of S$0, S$1, S$2 or S$5. There is no per-purchase approval dialog. S$0 computes a would-buy table and spends nothing. The default S$1 per-source cap stays in policy code.

Copy `.env.example` to `.env` and supply Groq and Cloudflare keys for live mode. Keys and delivery tokens remain private; do not commit them. `CLOUDFLARE_ACCOUNT_ID` is resolved once with the account token if missing. `PUBLISHER_URL` can point at the human-deployed Cloud Run service; its shared `PUBLISHER_SECRET` must match the API. The default demo uses a development-only local secret for fictional settlements.

Each run has durable SQLite reservations, intents, receipts and verified grants. No premium bodies or spans enter the browser or models before a matching grant. Retrying a failed delivery never creates a new charge. Stop prevents new purchases. Citations resolve to exact delivered passages; the PDF includes decision tables and simulated receipts. When Chromium fails, the report endpoint returns labelled printable HTML.

Variants: `CORPUS_VARIANT=open-sufficient|contradiction|unchanged|injection npm run demo`. `PUBLISHER_FAULTS=1` enables the local fault demo (later UI toggle). A fresh run never erases historical receipts. Runtime files are ignored in `data/`.

[prompt.md](prompt.md) is the sprint source of truth. [STATUS.md](STATUS.md) records unattended progress and human-only steps. Cloud deployment, fallback recording, rehearsals and the release tag remain human work.
