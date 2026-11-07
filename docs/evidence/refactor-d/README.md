# Lane D — local synthetic history evidence

Measured on MacBook-Pro-7.local, Apple M5, Node v26.3.1. This is a synthetic
in-memory SQLite read benchmark, not live provider, ledger, installed app or
same-engine soak acceptance. No network payments or persistent caches.

Reproduce: `HISTORY_BENCH=1 npx vitest run tests/history-summary.test.ts`.
The committed test freezes the old listPastRuns body and uses unchanged getRun
as its oracle. Both implementations read the same 2,000 retained UC3-derived
snapshots, normalized intents/receipts/grants and first events. Every fifth row
is pinned, every seventh hidden; every eleventh lacks normalized events and
newer optional snapshot fields. Resource IDs collide between intents. Hidden
runs retain receipts. Three warmups then 30 calls each, old then new; p95 is the
29th sorted sample. CPU is process user+system time divided by calls. Host was
shared; targeted parity checks overlapped part of this measurement.

| Measurement | Old | SQL projection |
| --- | ---: | ---: |
| History p95 | 662.48 ms | 76.27 ms |
| CPU per call | 559.91 ms | 73.08 ms |

CPU reduction: 86.95%. Both performance targets pass. Raw values: history.json.
The prior 34.4 s → 313 ms packet is not this lane's baseline.

Parity contract: newest run rowid first, hidden overrides pinned, all visible
pinned rows plus the latest N visible unpinned rows in that same global order.
Spend is gross charged intent amounts including refunds and failed proofs,
never snapshot spentMinor. Event time is the first normalized event by id,
not minimum time or snapshot event time; absent normalized events produce ''.
Optional legacy fields stay optional. Selected scalar values, persisted spend,
intent amounts/statuses and first-event time fail closed. Unselected bodies
are deliberately outside the projection's validation boundary; it never reads
grants, receipts, delivered content or snapshot arrays into JS.

The exact 38 dead lines (Cast 26, CSS 3, SUBSTEPS/segments 9) are removed;
brand assets, generator and pixel sprite stay. The requested 100 net LOC
reduction is missed: validation and regression coverage add code. No gate,
test, timeout or threshold was loosened. SDK citation filtering is unchanged.
