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

Open [http://localhost:5173](http://localhost:5173). The default is `APP_MODE=fixture`:
no credentials, network, publisher account, or XRPL seed is required. The API
listens on port 8788 and persists fixture runs in `data/runs.json`.

Choose a question and a website allowlist first, then confirm the working
decision, source universe, and manual token cap in the scope card. Start
research to inspect twenty ranked fixture articles. The canonical decisions
are Buy Northstar S$0.20, Skip Circuit Note, Buy Meridian S$0.80, and record
GridScope as blocked. Assemble the cited answer to see the before/after thesis
and exact evidence spans.

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
deterministic fallback. OpenAI and Groq are the intended compatible server-side
provider adapters; keys are never prefixed with `VITE_` or sent to the browser.

## Trust boundaries

Premium fixture bodies are stored in `server/premium-store.ts` and
`data/mock-articles.json`; they are absent
from the client bundle and public responses before purchase. Fixture payment is
explicitly a simulation and never claims to have paid a real publisher.
`SECURITY.md`, `ARCHITECTURE.md`, `DESIGN.md`, `UX-CONTRACT.md`, and
`VERIFICATION.md` document the remaining prototype limits.
