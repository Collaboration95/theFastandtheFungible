# Sandbox scoreboard and cache corrections · 12 November 2026

Scope: D3-1/D3-2 from the DEPLOY-3 acceptance. Historical metadata was read from
`/srv/researchagent/api/app.db` with SQLite `mode=ro` over the existing IAP SSH
connection. No hosted question was asked and no stored data was changed.

The four rows were matched by the hold creation timestamps in the supplied
`scoreboard-unanchored-diagnostic.txt`. Receipt counts use the scoreboard's raw
receipt/intent join and exclude cancelled escrows. All four also have zero
receipts and zero intents; none hides a settled purchase.

| Run prefix | Hold created (ms) | Phase | Settled purchases | DONE events | Resulting bucket |
| --- | --- | --- | --- | --- | --- |
| 3a369d69 | 1794355978274 | STOPPED | 0 | 0 | stoppedBeforeAnswer |
| b6ff787c | 1794362230491 | STOPPED | 0 | 0 | stoppedBeforeAnswer |
| 53ba6469 | 1794367079215 | STOPPED | 0 | 0 | stoppedBeforeAnswer |
| 03f14483 | 1794374190579 | STOPPED | 0 | 0 | stoppedBeforeAnswer |

The first row has no saved answer; the other three retain an intermediate
answer, but no DONE answer/event. These drafts do not establish completion.
The classification follows the orchestrator's DONE-answer rule. A STOPPED or
FAILED run with a settled purchase or a prior DONE event remains unanchored
without a valid anchor. Orphan receipts also retain the missing-anchor violation.
Runs whose answer anchor is still being written retain existing pending handling.

`tests/hosted-stats.test.ts` covers stopped/failed without purchases, stopped/failed
with purchases, free DONE without an anchor, a prior DONE followed by a stop,
and orphan receipts. `tests/sandbox-numbers.test.tsx` pins the neutral line outside
the violation group. The P4/server parity test also pins the separate counter.

`tests/hosted-stats-cache.test.ts` checks both production configs, then runs native
nginx on ephemeral loopback ports with the actual VM config followed by the
actual front template. Only upstream addresses and local filesystem paths are
substituted. The upstream is a synthetic HTTP server emitting `no-store` and
`X-Content-Type-Options: nosniff`; no Docker build, hosted session or cloud
resource is involved.

Expected raw response headers, asserted for GET and HEAD:

- `/api/demo/stats`: exactly one `Cache-Control: public, max-age=60` at the VM
  and through both layers; `X-Content-Type-Options: nosniff` survives.
- `/api/demo/status`: two separate `Cache-Control: no-store` fields at the VM,
  three through both layers (the existing upstream and each proxy policy).
  Combined through both: `Cache-Control: no-store, no-store, no-store`.
- `/api/demo/stats/`: remains on the private API path with the same no-store
  headers; it does not match the public exception.

There are no server-level security `add_header` directives in either current
config. The config test requires any such headers to be repeated in the stats
location if they are added later, because location-level `add_header` replaces
inheritance. No gate, threshold or test assertion was loosened.
