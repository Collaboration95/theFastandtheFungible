# P4 sandbox scoreboard

Local acceptance uses synthetic metadata only. It makes no model calls, ledger calls, purchases or cloud changes. The four-run seed is not evidence of real sandbox usage. Screenshots visibly identify the synthetic store.

The public `GET /api/demo/stats` endpoint returns fixed aggregate fields only, caches the result for 60 seconds, and is mounted before the session/admission middleware. The small `server/routes.ts` mount is necessary to avoid minting a session; session and limit semantics are unchanged. The one-line export in `server/hosted/routes.ts` keeps that public hosted router grouped with the hosted routes. It accepts cookieless GET/HEAD; query parameters are rejected. Other methods return 405 before the session guard, so unsupported calls cannot mint a session either. Cache-Control requires revalidation so downstream caches cannot add another 60 seconds of staleness.

Inside the grouped judges' corner, the scoreboard opens a native details panel. Closing that group unmounts the panel and stops its refresh timer. It fetches with `credentials: omit` only after opening and refreshes once per minute. It publishes no question, run ID, intent ID, transaction hash, session, principal, IP, token or individual model record. It adds no per-answer fee line.

## Counting rules

- Questions are distinct started hosted runs with a started UTC day on/after 11 November 2026. Plans, cancelled scopes and chat replies without a run do not count. Simulated runs are excluded from the Testnet totals and disclosed separately.
- Purchase runs have at least one settled purchase receipt. Escrow cancellation receipts do not count as purchases. Settled purchases remain counted after a writer-signed refund. Refunds count positive recorded intent refunds; cancelled principal is not a writer refund.
- Spend is gross charged intent spending, before refunds, in SGD minor units. Median spend includes purchase runs only.
- Model cost uses the larger of the hold's used microdollars and its recorded attempt reservations. Reconciled attempts use their final estimate; an unfinished attempt retains its conservative upper bound. The median includes every started question, including zero-cost fixture questions, and excludes unstarted scope holds.
- Start→Done is from the first saved run/queue event to the last Done event, including queue wait and delivery recovery. It excludes pre-Start planning and the five-second confirmation modal. Only runs with both timestamps contribute; the sample count is visible. Median averages the middle pair; p90 uses nearest rank.
- Anchored N/N counts schema-valid stored Testnet anchor confirmations bound to that run's hash. It does not query the public ledger. In-progress and still-active anchoring holds are pending, not failures. Finished, inactive runs without a valid stored anchor contribute to the unanchored count.
- Audit counters count affected runs once per rule. Legacy phase events omit identity/round data: DECIDE order establishes the round, and PURCHASE/ESCROW_CREATE identifies that round's intent. BUY must follow a DECIDE with a persisted policy selection; the selected article/source must match the intent. READ_PAID must follow the matching GRANT. Raw receipt reads detect missing intents that Store.getRun's inner join would hide. Duplicate ledger identities or repeated BUYs count; reconciliation observations of the same intent do not count as a second purchase.
- Missing/pruned event histories are explicitly unavailable. The panel does not claim it rechecks citation text or premium bytes: it audits recorded event order, policy picks, budget, identities and anchors. It never asserts that unavailable runs passed.

## Reproduce

Run from the worktree with Node 22.13+ and `npm ci`:

```sh
npx vitest run tests/hosted-stats.test.ts tests/sandbox-numbers.test.tsx
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh sh -c 'npm run build && node --import tsx tests/p4-proof.ts load && node --import tsx tests/p4-proof.ts visual'
```

The load probe uses the real HOSTED=1 app, 5,000 synthetic metadata runs and 1,000 cached HTTP requests at concurrency eight, plus the first cold request. The same p95 target is also asserted across all 1,001 requests including that cold refresh. It reports the first uncached request separately from cached request percentiles. It also records that no session, session mint or admission was created. All listeners use allocated or ephemeral ports. The visual probe uses the existing local hosted HTTPS test stack and the production build at 1280 and 390 px. It records horizontal overflow and serious/critical axe findings. Browser/device evidence is Chromium emulation. The browser blocks external HTTP and WebSocket traffic, including the existing shared-payer card’s public-node reads; that card shows its unavailable state rather than invented ledger figures.

## Seeded result

4 questions; 2 purchase runs; 2 settled purchases; 1 refund; 4/4 anchored; median Start→Done 25 s, p90 40 s; median gross spend S$0.50; median model US$0.0050; every violation counter 0. A separate corrupted seed makes all six counters nonzero. Additional tests cover missing traces, empty stores, pre-cutoff holds, simulated exclusions, cancellation, key-reveal trace identities, pending anchors, pre-Start planning time, unavailable UI and 60-second cache expiry.

Measured load and visual results are recorded in `load.json` and `layout.json`; screenshots are `scoreboard-1280.png` and `scoreboard-390.png`.

Measured cached endpoint latency: p50 1.01 ms, p95 1.79 ms, p99 3.42 ms, maximum 8.98 ms; p95 including the cold request 1.79 ms across 1,001 requests; one cold refresh 89.49 ms. All 1,000 requests succeeded, and sessions, session mints and admissions remained zero. Both 1280 and 390 px checks have no horizontal overflow and zero serious/critical axe findings. Screenshots capture the full page at those viewport widths.

The first clean-head gate failed the unchanged initial-JavaScript budget: 171,171 gzip bytes against the exclusive 170,000-byte limit. `bundle-regression.json` retains that miss. The panel body now loads as a separate chunk only when opened; the compact summary remains immediately available. The on-open panel is absent from the initial import closure (1,481 gzip bytes in its separate chunk), but this base still measures 170,181 gzip bytes; `bundle-lazy-regression.json` retains that preflight miss. Broader bundle reduction belongs to DEPLOY-FIX. Both earlier misses used Node 26; final acceptance and gates pin Node 22 to match deploy. Production preflight after the split records 158,386 gzip bytes against the same exclusive 170,000-byte limit. The scoreboard panel chunk is absent from the initial static-import closure. The final browser-performance gate independently enforces it before shipping.

The first integrated Node 22 gate also found the static replay asset total at 2,000,853 bytes against its unchanged exclusive 2,000,000-byte cap (`replay-bundle-regression.json`). Final static replay preflight records 1,826,374 raw JS/JSON bytes against the unchanged exclusive 2,000,000-byte cap (`replay-bundle.json`); no scoreboard panel chunk is emitted. The hosted-only scoreboard import is now excluded in the existing `browser-demo` build mode: the static replay has no hosted store. No replay source or evidence was changed, and no threshold was raised.

After L12 merged, its renderer guard classified a `US$` interpolation as SGD because both end in `S$`. The model-cost card now states US$ once in its label and retains a four-decimal numeric value beneath it. SGD still uses the shared two-decimal formatter. The shared guard and monetary precision were not changed.
