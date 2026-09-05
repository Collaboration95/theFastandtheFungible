# ResearchAgent

ResearchAgent is a locally runnable SingHacks 2026 Ripple-track prototype: an
AI research desk that decides which evidence is worth buying before a committee
brief.

## Run in five minutes

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The default is `APP_MODE=fixture`
and `XRPL_MODE=fixture`: no credentials, network, publisher account, or XRPL seed
is required. For an explicitly authorized XRPL Testnet run, set `XRPL_MODE=live`
and provide the payer seed/address plus receiver address in the ignored local
`.env`; never place secrets in `.env.example`. The API
listens on port 8788 and persists fixture runs in `data/runs.json`.

Choose a question and a website allowlist first, then set the XRP research
budget in the same websites panel. Start research to run the semantic fixture
retrieval. Groq receives only the retrieved previews and metadata, chooses an
eligible purchase action, and the server executes it against XRPL Testnet when
live mode is enabled. The purchased fixture article is then unlocked. Assemble
the cited answer to stream a grounded dossier from Groq; the final JSON is
validated against the accessible source and evidence-span IDs before display.

## Commands

```bash
npm run typecheck
npm test
npm run build
npm run verify
npm run seed
```

The implementation exposes versioned REST routes under `/api/v1`, including
health, scenario, persisted runs, reset/step/cancel, sources, purchases,
synthesis, dossier, receipt, and an SSE stream. `LLM_PROVIDER=fixture` is the
deterministic fallback. The live provider currently targets Groq’s
OpenAI-compatible Chat Completions API; keys are never prefixed with `VITE_` or
sent to the browser. Tune `LLM_SYNTHESIS_TEMPERATURE` in `.env` to vary the
Groq dossier prose; purchase planning remains low-temperature for safer
bounded decisions.

## Trust boundaries

Premium fixture bodies are stored in `server/premium-store.ts` and
`data/mock-articles.json`; they are absent
from the client bundle and public responses before purchase. Fixture payment is
explicitly a simulation and never claims to have paid a real publisher.
`SECURITY.md`, `ARCHITECTURE.md`, `DESIGN.md`, `UX-CONTRACT.md`, and
`VERIFICATION.md` document the remaining prototype limits.
