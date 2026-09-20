# Diagram and flow audit — 20 September 2026

## Scope

This audit covers the current React/Vite + Express fixture application and the
four focused Excalidraw architecture/implementation views. The iOS simulator
is intentionally out of scope: this repository has no native iOS target.

## Verification result

The current fixture journey completed successfully:

1. Landing question and source-profile selection.
2. Editable research-plan review.
3. Explicit plan approval before discovery and purchase planning.
4. Evidence map with 12 previews and 6 evidence families.
5. Exact quote review bound to invoice, resource, network, version hash,
   expiry, and quote hash.
6. Explicit purchase confirmation and premium-span unlock.
7. Redundant-source skip and over-ceiling-source block.
8. Cited dossier synthesis.

Automated checks:

- `npm run verify` — typecheck, 19 unit/API tests, and production build pass.
- `npm run test:e2e` — 6 Playwright journeys pass.
- `npm run test:a11y` — no serious or critical violations on the ready desk.

Evidence screenshots are in [`screenshots/`](../screenshots/):

- `audit-01-landing.png`
- `audit-02-plan-review.png`
- `audit-03-evidence-workspace.png`
- `audit-04-purchase-confirmation.png`
- `audit-05-dossier.png`

## Implemented and verified

- Server-side plan approval gate; direct execution and purchase planning are
  rejected before approval.
- Human purchase approval with exact quote binding.
- Premium evidence remains locked until the accepted purchase is recorded.
- Fixture settlement is labelled as simulation; optional XRPL Testnet remains a
  separately configured path.
- Persistent purchase/receipt records survive a clean reset, while the prior
  run becomes read-only.
- Deterministic fixture retrieval, family clustering, budget ceiling checks,
  cited synthesis, and accessibility coverage.

## Discrepancies and remaining work

The backend already exposes receipt data, but the live UI does not expose the
full promised product surface:

- The dossier offers browser Print, but no Evidence Receipt view or JSON export
  is reachable from the application (#11).
- The sidebar exposes Research desk, Evidence map, and Cited dossier only; local
  report history is not navigable (#38).
- Purchased article/library records are persisted server-side but there is no
  library UI for access, license, retention, or linked reports (#39).
- Citation links work inside the current dossier, but there is no durable
  article-to-report/claim revisit surface (#44).
- The fixture catalog contract still has the documented 20-record JSON corpus
  versus the 12-record hardcoded fallback drift; canonicalization remains a
  foundation task.
- Live source adapters, durable transactional persistence, and fully validated
  real payment/fulfilment remain roadmap work; the current journey is fixture
  mode by design.

The existing GitHub epic received the audit evidence and links to the open
issues rather than creating duplicates:

- [Evidence impact, analyst dossier, and receipt](https://github.com/Collaboration95/theFastandtheFungible/issues/3)
- [Evidence Receipt view and export](https://github.com/Collaboration95/theFastandtheFungible/issues/11)
- [Local report history](https://github.com/Collaboration95/theFastandtheFungible/issues/38)
- [Purchased article library](https://github.com/Collaboration95/theFastandtheFungible/issues/39)
- [Article-to-report and claim traceability](https://github.com/Collaboration95/theFastandtheFungible/issues/44)

## Diagram updates

Each editable source and SVG export now contains a dated current-state layer:

- [`runtime-flow`](../diagrams/runtime-flow/canvas/excalidraw/scene.excalidraw) — plan gate, exact quote review, and reset-safe persistence.
- [`code-verification`](../diagrams/code-verification/canvas/excalidraw/scene.excalidraw) — passing test counts and the missing UI surfaces.
- [`mock-live-boundaries`](../diagrams/mock-live-boundaries/canvas/excalidraw/scene.excalidraw) — fixture default, optional Groq, and optional XRPL Testnet truth boundaries.
- [`risks-next-work`](../diagrams/risks-next-work/canvas/excalidraw/scene.excalidraw) — implemented controls, current UI gaps, and next build order.

The official UX-01 wireframe canvas was preserved because it already contains
the intended receipt/history/library contract; the audit now makes the gap
between that contract and the live UI explicit.
