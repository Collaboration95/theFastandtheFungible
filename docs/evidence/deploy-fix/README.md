# Deploy blockers, 12 November 2026

Local source/build and fixture evidence only. No hosted redeploy, cloud mutation,
question against the public demo, provider call or payment was made by this lane.

At main `039c497a8fb1a687e9cc027d378055786d4e0439`, production initial JS is
**170,326 bytes gzip on Node v22.23.4**, zlib `1.3.1-e00f703`. The same built
files measure **169,998 on Node v26.3.1**, zlib `1.2.12`. This reproduces why
main's successful local-gate receipt used Node v26.3.1 (receipt
`1794424265517-79687-e5c7590d-2f23-41a2-b6c3-e9c05bda8014.json`), while deploy
on Node 22 fails. Gate cache keys already distinguish runtime versions.

ReceiptSheet, ShowWork, Passage, ReputationPanel and ChatThread now load on demand. The
unchanged manifest/static-import traversal and per-file `gzipSync` calculation
measures **159,261 bytes** on Node 22, a reduction of **11,065 bytes**.
LedgerCheck and LedgerReceipt were already lazy; the full browser verifier was
already a dynamic import on explicit verification (warmed only after DONE).

`npm run build` now calls `scripts/bundle-budget.mjs`, requires Node 22 and fails
at 170,000 bytes or above. The local gate's app-build runs before the unit/browser
steps; the deploy's perf test imports the same measurement and limit. This
preserves the existing <170,000 limit and leaves 10,739 bytes below it; no
threshold or test is loosened.
`check:fast` remains unchanged. Build cache inputs include the budget helper.

Targeted validation:

- Startup's actual override loop accepts upper/lower/mixed-case 64-hex domains,
  including a final line without a newline, and replaces an existing value.
  Eight invalid forms fail with an explicit domain error without writing it.
- `tests/hosted-ops.test.ts` and `tests/bundle-budget.test.ts`: 21 passing tests.
  Bundle tests cover transitive imports, deduplication, cycles, exclusion of
  dynamic imports and rejection of oversized static content.
- Production Chromium performance test: CLS 0.010060947630140517 (<0.02),
  interactive 62.65 ms, palette p95 33.3 ms, view switching p95 33.1 ms.
  This is the repository performance test. Separately, Lighthouse 13.6.0
  measured navigation CLS **0** on the local production app (desktop,
  fixture/simulated stack, no question submitted). Both satisfy ≤0.02.
- Four production Playwright lazy-load tests (1280 and 390 px): no receipt/Show work chunk request
  before opening, labelled modal with reserved space during a blocked download,
  final content after release, and Escape closes it. All four passed.
- A separate deferred-conversation test passed: no eager chunk request, labelled
  loading state, fixture reply and disclosure preserved, keyboard focus restored.
- Three targeted hosted UI cases passed: answer/verification with visitor isolation,
  Writers, and keyboard Ask → plan → result → verification. Local fixtures only.
- Full check:fast, local gate (including hosted browsers and the ≤0.02 CLS
  budget), exact PR publication and exact merge publication are required before
  delivery; their receipts live in the shared Git local-gate directory.
