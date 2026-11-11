# LABELS9: plain trace and promise labels

Local fixture UI evidence, 12 November 2026. Full [code-to-label table](labels.md). No live model, hosted admission,
Testnet transaction or paid purchase was made for this work.

The before/after screenshots use the same committed UC1 fixture plus one explicitly
synthetic `MODEL_FALLBACK` guard event in `tests/labels9-preview.tsx`. That event
matches the production guard's code, reason and legacy label. It is not evidence
of a live model call. Before is main `039c497a`; after is this change. Both widths
are CSS pixels (1280 and 390), height 900. The extra phone screenshot scrolls the
same sheet to its last row so the substitution explanation can be read.

| Check | Result |
| --- | --- |
| Show work Trace, 1280 | axe: 0 violations, including 0 serious/critical; 0 warning rows; no horizontal overflow |
| Show work Trace, 390 | axe: 0 violations, including 0 serious/critical; 0 warning rows; sheet/scroll area 390px, trace 338px, no overflow |
| All five Show work tabs, both widths | axe: 0 violations in Trace, Wire, Policy, Receipts and Models |
| Healthy UC1 and paid UC2 fixtures | 0 warning rows |
| Forced failed delivery | warning row and failure alert retained |
| Guard / model allowance substitutions | explicit offline-extract label, neutral styling |
| Timeout / provider error / invalid output / unavailable | explicit offline-extract label, warning styling |
| Expected x402 HTTP 402 | neutral (payment terms, not a failed request) |
| Forced HTTP 503 / failed proof / failed follow-up | warning retained |
| Team fact menus | rendered through Verification; no bare catalogue pair |

Reproduce: serve the repository with Vite on an allocated local port, open
`/tests/labels9-preview.html`, resize to each width and open Show work. Run axe-core
on the dialog. The fixture uses real components and production styles. Automated
rendering and catalogue checks: `npx vitest run tests/trace-labels.test.tsx`.

Wire, Policy and Ledger are loaded when opened; Trace remains synchronous. The existing
entry-bundle budget is unchanged. The tab-loading regression tests await the real views.

Persisted server codes, event text, manifests, receipts and verifiers are unchanged.
The Models tab retains the recorded provider identities and fixture disclosures.
Keyword-only status does not distinguish disabled embeddings from a failed call,
so the UI says “semantic search not used”; it does not invent a cause.

Nothing loosened. No gate threshold, test threshold, timeout or verifier was changed.
