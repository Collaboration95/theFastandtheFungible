# Lane A reliability evidence

Local synthetic fixtures only. No live provider, network ledger, Testnet settlement or real money was used. `history.json` records the host, SQLite version, query plans and five timing samples. Run directly:

```
node --import tsx scripts/bench-history.ts --runs 3000 --events-per-run 60 --output scratch/history-3000.json
node --import tsx scripts/bench-history.ts --runs 10000 --events-per-run 60 --migration-only --output scratch/history-10000.json
```

The before/after hydration measurements use the same populated Store and remove/recreate only the two new indexes. Migration timing is separate. The 10,000-run mode deliberately omits the quadratic baseline hydration. The temporary database is retained outside the repository for inspection; it contains synthetic progress events only.

Startup, drain and answer recovery use SQL selection rather than `listRuns()`. Operational metrics use metadata projections, preserve nearest-rank percentiles and null costs, and still return O(number of runs) usage rows. Payment recovery remains independent per intent so a blocked writer cannot starve other signed obligations. Answer/refund recovery sweeps are single-flight.

`tests/history-bounds.test.ts` compares selectors with the previous predicates on mixed history. `tests/runtime-limits.test.ts` covers chunked body cancellation and 1,000 disconnects. Oversized SSE snapshots close the stream; SDK observers resynchronize through GET of the same run. Terminal state remains durable. Initial and terminal snapshots bypass the 250 ms snapshot throttle. Publisher delivery/free reads allow 2 MiB; registry/search/challenge allow 256 KiB. The checked corpus has 83 articles; largest serialized source article is 17,221 bytes. Fixture integration validates actual delivery envelopes.

`tests/client-errors.test.ts` and Python error tests validate safe categories and plaintext bearer rejection. Budget clamping remains free-first: successful admission includes a checkpoint `budgetReason` when reduced, surfaced as SDK `clampReason`. Typed errors carry retryability and retained run IDs; messages are generated from allowlisted codes rather than upstream messages. Testnet x402 requires an explicit journal even with an injected ledger.

`tests/refund-recovery.test.ts` uses synthetic historical obligations and a fake ledger for XRP and issued currency. It closes/reopens Store, attempts retention, rejects a wrong invoice and wrong sender, then concurrently verifies the exact candidate. The outcome, REFUND event and audit entry commit atomically (an injected audit failure rolls them back). Exactly one REFUND event/audit entry is written, refunded totals increment once, gross spend is unchanged, and the signing spy sees zero calls. There is no replacement payment.

Deferred under the lane stop rule: one engine-wide active-work cap (including planning, scope, reports, hire and startup), cooperative Stop propagation to every provider, and a global reconciliation scheduler. No cap of four or sub-second in-flight Stop claim is made. `limits.json` marks these unmeasured. Replacing the existing independent payment reconciler with one global awaited task failed the blocked-writer regression; that change was removed. The transport timing assertions in `tests/stream-281.test.ts` now require the immediate FREE_DRAFT trace and terminal GET resynchronization, replacing a terminal-snapshot-only expectation. This permits bounded SSE disconnects; all grant, citation, budget and leak assertions remain in force. No safety threshold was loosened. This bundle is not final H workload acceptance.

Final implementation benchmark source: `d3893ae9b955efc26e4f6dead4c49522e2c433cb`. Fresh 3,000-run full hydration: 34,372.8 ms before indexes, 313.3 ms after; selection plus no-op reconcile 5.3–10.8 ms across five samples. At 10,000 runs, index migration took 147.9 ms, separately from selection. Timings vary with host load; the earlier exploratory run was 19,163.4 → 225.5 ms and is not the committed headline. The fresh committed measurement is authoritative for this packet.

Local gates on the implementation: 104 Vitest files / 764 tests passed, 17 Python tests passed, and 20 fixture chaos episodes plus four escrow probes reported zero invariant violations, zero double charges and zero stuck reservations. The complete gate is rerun for shipping. No provider cancellation or retained-engine memory-stability result is inferred from this fixture suite.
