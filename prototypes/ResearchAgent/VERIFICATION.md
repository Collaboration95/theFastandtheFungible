# ResearchAgent verification

Date: 2026-09-05  |  Working tree: local prototype under `tftf/prototypes/ResearchAgent`

## Automated evidence

- `npm run typecheck` — required before handoff.
- `npm test` — deterministic domain and budget checks.
- `npm run build` — production client build and TypeScript compile.
- `npm run verify` — runs the three checks above.

## Current fixture evidence

The fixture corpus contains 12 sources and 8 evidence families. The server
persists runs and event records in `data/runs.json`; premium bodies are kept in
the server-only store. The canonical run shows S$2.00 → S$0.20 Northstar →
S$0.80 Meridian → S$1.00 remaining, with Circuit skipped as redundant and
GridScope blocked by the S$1.00 per-source ceiling. The dossier is marked
`FIXTURE RESEARCH · NOT INVESTMENT ADVICE` and claims cite exact unlocked spans.

## Manual/browser checklist

- Desktop reading surface and 390px single-column surface are implemented.
- Trace node selection opens an app-owned evidence drawer; Escape closes it.
- Premium preview is protected before purchase; unlocked evidence is labelled
  synthetic and fixture-owned.
- Pause/resume, reset, replay, cancel, print, reduced motion, focus styling,
  live status, and scroll ownership are implemented.

## Limitations

This handoff uses fixture retrieval, fixture synthesis, and simulated settlement.
OpenAI/Groq calls, optional live metadata adapters, XRPL Testnet settlement,
Playwright/axe screenshot capture, and a production transactional database are
release follow-ups rather than prerequisites for the no-credential demo.
